import { readFile, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { ingestSpeciesListsFromFiles } from '../src/features/data-flow/1.ingest/species.ingest.ts'
import { searchSpecies } from '../src/features/data-flow/2.identify/species-search.ts'
import { speciesListsStore } from '../src/features/data-flow/2.identify/species-list.store.ts'

type CliOptions = {
  csvPath?: string
  query?: string
  limit?: number
  listId?: string
  json?: boolean
  approx?: boolean
  maxDistance?: number
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.query || opts.query.trim().length === 0 || opts.query === '--help') {
    printUsage()
    return
  }

  const csvPath = resolve(opts.csvPath || 'examples/SpeciesList_CountryPanamaCostaRica_TaxaInsecta_doi.org10.15468dl.6nxkw6.csv')
  const listId = opts.listId

  const indexed = await buildIndexedFile(csvPath)

  await ingestSpeciesListsFromFiles({ files: [indexed as any] })

  const id = listId || indexed.name
  const lists = speciesListsStore.get()
  if (!lists || !lists[id]) {
    console.log('🚨 species-search: species list not found after ingest', { id, available: Object.keys(lists || {}) })
    return
  }

  let results = searchSpecies({ speciesListId: id, query: opts.query, limit: opts.limit || 20 })

  if ((opts.approx || results.length === 0) && lists?.[id]?.records?.length) {
    const fallback = approximateSearch({
      records: lists[id].records,
      query: opts.query,
      limit: opts.limit || 20,
      maxDistance: opts.maxDistance ?? 2,
    })
    if (fallback.length) results = fallback
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  console.log('✅ species-search results', {
    query: opts.query,
    listId: id,
    csvPath,
    count: results.length,
  })

  for (const r of results) {
    const line = [
      r.scientificName,
      label(r.taxonRank),
      kv('order', r.order),
      kv('family', r.family),
      kv('genus', r.genus),
      kv('species', r.species),
    ]
      .filter(Boolean)
      .join('  |  ')
    console.log(' -', line)
  }
}

function label(value: unknown) {
  if (value == null || String(value).trim() === '') return ''
  return String(value)
}

function kv(k: string, v: unknown) {
  if (v == null || String(v).trim() === '') return ''
  return `${k}: ${v}`
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {}
  let i = 0
  while (i < argv.length) {
    const a = argv[i]
    if (a === '--csv') {
      opts.csvPath = argv[i + 1]
      i += 2
      continue
    }
    if (a === '--limit') {
      const n = Number(argv[i + 1])
      if (!Number.isNaN(n)) opts.limit = n
      i += 2
      continue
    }
    if (a === '--list-id') {
      opts.listId = argv[i + 1]
      i += 2
      continue
    }
    if (a === '--json') {
      opts.json = true
      i += 1
      continue
    }
    if (a === '--approx') {
      opts.approx = true
      i += 1
      continue
    }
    if (a === '--maxdist') {
      const n = Number(argv[i + 1])
      if (!Number.isNaN(n)) opts.maxDistance = n
      i += 2
      continue
    }
    if (!opts.query) {
      opts.query = a
      i += 1
      continue
    }
    i += 1
  }
  return opts
}

async function buildIndexedFile(path: string) {
  const abs = resolve(path)
  const data = await readFile(abs)
  const st = await stat(abs)
  const name = basename(abs)
  const file = new File([data], name, { type: 'text/csv' })
  // Ensure path matches expected species folder heuristic in ingest
  const ingestPath = `species/${name}`
  return { file, handle: undefined, path: ingestPath, name, size: st.size }
}

function printUsage() {
  console.log(
    `\nUsage: bun run species:search "<query>" [--csv <path>] [--limit <n>] [--list-id <id>] [--json] [--approx] [--maxdist <n>]\n`,
  )
  console.log('Examples:')
  console.log('  bun run species:search "hemiptera"')
  console.log('  bun run species:search "hempitera" --csv examples/species-example.csv --approx --maxdist 2')
  console.log('  bun run species:search "Coccinellidae" --limit 50 --json')
  console.log('')
}

main().catch((err) => {
  console.error('🚨 species-search failed', err)
  process.exitCode = 1
})

type ApproxParams = { records: any[]; query: string; limit: number; maxDistance: number }

function approximateSearch(params: ApproxParams) {
  const { records, query, limit, maxDistance } = params
  const q = (query || '').trim().toLowerCase()
  if (!q) return [] as any[]

  const rankOrder: Record<string, number> = {
    genus: 0,
    species: 1,
    family: 2,
    order: 3,
    class: 4,
    phylum: 5,
    kingdom: 6,
  }

  type Candidate = { rec: any; distance: number; rank?: string }
  const out: Candidate[] = []

  for (const rec of records) {
    let best: Candidate | undefined
    for (const rank of ['species', 'genus', 'family', 'order', 'class', 'phylum', 'kingdom'] as const) {
      const val = String((rec as any)?.[rank] || '')
        .trim()
        .toLowerCase()
      if (!val) continue
      const d = damerauLevenshtein(q, val, maxDistance)
      if (d > maxDistance) continue
      if (!best || d < best.distance || (d === best.distance && (rankOrder[rank] ?? 99) < (rankOrder[best.rank || ''] ?? 99))) {
        best = { rec, distance: d, rank }
      }
    }
    if (!best && (rec?.scientificName || rec?.vernacularName)) {
      const val = String(rec.scientificName || rec.vernacularName || '')
        .trim()
        .toLowerCase()
      if (val) {
        const d = damerauLevenshtein(q, val, maxDistance)
        if (d <= maxDistance) best = { rec, distance: d, rank: undefined }
      }
    }
    if (best) out.push(best)
  }

  out.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    const ar = a.rank ? rankOrder[a.rank] ?? 99 : 99
    const br = b.rank ? rankOrder[b.rank] ?? 99 : 99
    if (ar !== br) return ar - br
    return (a.rec?.scientificName || '').localeCompare(b.rec?.scientificName || '')
  })

  return out.slice(0, limit).map((c) => c.rec)
}

// Damerau–Levenshtein with early exit when distance exceeds max
function damerauLevenshtein(a: string, b: string, max: number) {
  const al = a.length
  const bl = b.length
  if (a === b) return 0
  if (!al) return Math.min(bl, max + 1)
  if (!bl) return Math.min(al, max + 1)

  const prev = new Array<number>(bl + 1)
  const curr = new Array<number>(bl + 1)
  const prev2 = new Array<number>(bl + 1)

  for (let j = 0; j <= bl; j++) prev[j] = j

  for (let i = 1; i <= al; i++) {
    curr[0] = i
    let rowMin = curr[0]
    const ai = a.charCodeAt(i - 1)
    for (let j = 1; j <= bl; j++) {
      const bj = b.charCodeAt(j - 1)
      const cost = ai === bj ? 0 : 1
      let val = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      )
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
        val = Math.min(val, prev2[j - 2] + 1) // transposition
      }
      curr[j] = val
      if (val < rowMin) rowMin = val
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= bl; j++) {
      prev2[j] = prev[j]
      prev[j] = curr[j]
    }
  }
  return prev[bl]
}

import { atom } from 'nanostores'
import fuzzysort from 'fuzzysort'
import { csvToObjects } from '~/utils/csv'

export type IndexedFile = {
  file?: File
  handle?: { getFile?: () => Promise<File> }
  path: string
  name: string
  size: number
}

// Darwin Core-aligned subset used by the app. We keep additional file columns under extras.
export type TaxonRecord = {
  taxonID?: string | number
  scientificName: string
  taxonRank?: string
  taxonomicStatus?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  vernacularName?: string

  // passthroughs (optional)
  acceptedTaxonKey?: string | number
  acceptedScientificName?: string
  iucnRedListCategory?: string

  // raw source row (non-strict) for future export/mapping
  extras?: Record<string, unknown>
}

export type SpeciesList = {
  id: string
  fileName: string
  name: string
  doi: string
  sourcePath: string
  recordCount: number
  records: TaxonRecord[]
}

export const speciesListsStore = atom<Record<string, SpeciesList>>({})

export async function ingestSpeciesListsFromFiles(params: { files: IndexedFile[] }) {
  const { files } = params
  if (!files?.length) return

  const lists: Record<string, SpeciesList> = { ...(speciesListsStore.get() || {}) }

  for (const f of files) {
    const pathLower = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    const isSpeciesFolder = pathLower.includes('/species/') || pathLower.startsWith('species/')
    const isCsv = pathLower.endsWith('.csv') || pathLower.endsWith('.tsv')
    if (!isSpeciesFolder || !isCsv) continue

    try {
      const rows = await readSpeciesCsvRows({ indexedFile: f })
      if (!Array.isArray(rows) || rows.length === 0) continue

      const records = rows.map((row) => mapRowToTaxonRecord(row)).filter((r) => !!r?.scientificName)

      // Dedupe by taxonID || scientificName
      const seen: Record<string, boolean> = {}
      const unique: TaxonRecord[] = []

      for (const r of records) {
        const key = String(r?.taxonID ?? r?.scientificName ?? '')
          .trim()
          .toLowerCase()
        if (!key || seen[key]) continue
        seen[key] = true
        unique.push(r)
      }

      const id = f?.name || f?.path
      const fileName = f?.name || f?.path

      // example fileName: SpeciesList_CountryPanamaCostaRica_TaxaInsecta_doi.org10.15468dl.epzeza.csv
      // example fileName: CountryPanamaCostaRica_TaxaInsecta_doi.org10.15468dl.epzeza
      const baseName = fileName?.replace('SpeciesList_', '').replace('SpeciesList_', '.csv').split('_')
      const doi = baseName[2]
      const name = baseName[0] + ' - ' + baseName[1]

      lists[id] = {
        id,
        name,
        doi,
        fileName,
        sourcePath: f.path,
        records: unique,
        recordCount: unique.length,
      }

      // Invalidate any cached index for this list so it rebuilds lazily
      delete speciesIndexCache[id]
    } catch (err) {
      console.log('🚨 species: failed to parse species list', { path: f?.path, err })
    }
  }

  speciesListsStore.set(lists)
}

async function readSpeciesCsvRows(params: { indexedFile: IndexedFile }) {
  const { indexedFile } = params

  const file = indexedFile?.file || (await indexedFile?.handle?.getFile?.())
  if (!file) return [] as any[]

  const text = await file.text()
  if (!text) return [] as any[]

  // const csvParser = await getCsvToObjects({ path: '~/utils/csv' })
  const rows = csvToObjects({ csvContent: text, hasHeaders: true }) as any[]
  const result = Array.isArray(rows) ? rows : []
  return result
}

// Simple in-memory index with prepared strings for fast searching
type SpeciesIndexItem = { ref: TaxonRecord; search: any }
const speciesIndexCache: Record<string, SpeciesIndexItem[] | undefined> = {}
// Exact-lookup index per list: lowercased token (any of the indexed ranks) -> array of records
const speciesExactIndexCache: Record<string, Record<string, TaxonRecord[]> | undefined> = {}

function ensureSpeciesIndexForList(list: SpeciesList | undefined): SpeciesIndexItem[] {
  if (!list) return []
  const cached = speciesIndexCache[list.id]
  if (cached) return cached
  const items: SpeciesIndexItem[] = []
  const exactIndex: Record<string, TaxonRecord[]> = {}
  for (const r of list.records) {
    // Build the combined string WITHOUT scientificName; prefer explicit rank columns
    const combined = [r.species, r.genus, r.family, r.order, r.class, r.phylum, r.kingdom, r.vernacularName].filter(Boolean).join(' | ')
    const prepared = fuzzysort.prepare(combined)
    items.push({ ref: r, search: prepared })
    // Build exact lookup keys across ranks, skipping unranked and non-accepted statuses when status present
    const isUnranked = (r?.taxonRank ?? '').toLowerCase() === 'unranked'
    const status = (r?.taxonomicStatus ?? '').toLowerCase()
    const statusOk = !status || status === 'accepted'
    if (!isUnranked && statusOk) {
      addExact(exactIndex, r.species, r) // species epithet
      addExact(exactIndex, r.genus, r)
      addExact(exactIndex, r.family, r)
      addExact(exactIndex, r.order, r)
      addExact(exactIndex, r.class, r)
      addExact(exactIndex, r.phylum, r)
      addExact(exactIndex, r.kingdom, r)
    }
  }
  speciesIndexCache[list.id] = items
  speciesExactIndexCache[list.id] = exactIndex
  return items
}

export function searchSpecies(params: { speciesListId?: string; query: string; limit?: number }) {
  const { speciesListId, query, limit = 20 } = params
  const trimmed = (query ?? '').trim()
  if (!trimmed) return [] as TaxonRecord[]
  const allLists = speciesListsStore.get() || {}
  const list = speciesListId ? allLists[speciesListId] : undefined
  const index = ensureSpeciesIndexForList(list)
  if (!index.length) return []

  const results = fuzzysort.go(trimmed, index as any, {
    key: 'search' as any,
    limit,
    threshold: -10000,
  }) as unknown as Array<{ obj: SpeciesIndexItem }>

  console.log('results: ', results)
  // Fuzzy candidates (we will filter out unranked/non-accepted below)
  let mapped: TaxonRecord[] = results.map((r) => r.obj.ref)

  // Always include exact matches across indexed ranks (scientificName/genus/family/order/vernacularName)
  const exactIndex = speciesExactIndexCache[list?.id || ''] || {}
  const exactLower = trimmed.toLowerCase()
  let exactMatches = (exactIndex[exactLower] ?? []) as TaxonRecord[]

  // Filter out unranked or non-accepted where status present
  const acceptFilter = (r: TaxonRecord) => {
    const isUnranked = (r?.taxonRank ?? '').toLowerCase() === 'unranked'
    const status = (r?.taxonomicStatus ?? '').toLowerCase()
    const statusOk = !status || status === 'accepted'
    return !isUnranked && statusOk
  }
  exactMatches = exactMatches.filter(acceptFilter)
  mapped = mapped.filter(acceptFilter)

  const combinedPre: TaxonRecord[] = dedupeByKey([...exactMatches, ...mapped])

  // Sort: exact matches first; within exact, rank-priority when the matched rank equals the query.
  const rankOrder: Record<string, number> = {
    genus: 0,
    species: 1,
    family: 2,
    order: 3,
    class: 4,
    phylum: 5,
    kingdom: 6,
  }

  function matchedRankFor(record: TaxonRecord, qLower: string): string | undefined {
    if ((record?.genus ?? '').toLowerCase() === qLower) return 'genus'
    if ((record?.species ?? '').toLowerCase() === qLower) return 'species'
    if ((record?.family ?? '').toLowerCase() === qLower) return 'family'
    if ((record?.order ?? '').toLowerCase() === qLower) return 'order'
    if ((record?.class ?? '').toLowerCase() === qLower) return 'class'
    if ((record?.phylum ?? '').toLowerCase() === qLower) return 'phylum'
    if ((record?.kingdom ?? '').toLowerCase() === qLower) return 'kingdom'
    return undefined
  }

  const exactSet = new Set<string>((exactMatches || []).map((r) => String(r?.taxonID ?? r?.scientificName ?? '').toLowerCase()))
  const combined = [...combinedPre].sort((a, b) => {
    const aKey = String(a?.taxonID ?? a?.scientificName ?? '').toLowerCase()
    const bKey = String(b?.taxonID ?? b?.scientificName ?? '').toLowerCase()
    const aExact = exactSet.has(aKey)
    const bExact = exactSet.has(bKey)
    if (aExact && !bExact) return -1
    if (!aExact && bExact) return 1
    if (aExact && bExact) {
      const ar = matchedRankFor(a, exactLower)
      const br = matchedRankFor(b, exactLower)
      const ai = ar != null ? rankOrder[ar] ?? 99 : 99
      const bi = br != null ? rankOrder[br] ?? 99 : 99
      if (ai !== bi) return ai - bi
      return (a?.scientificName || '').localeCompare(b?.scientificName || '')
    }
    return 0
  })

  const take = Math.max(limit, exactMatches.length)

  if (trimmed)
    console.log('🌀 species.search', {
      listId: speciesListId,
      q: trimmed,
      indexSize: index.length,
      exactCount: exactMatches.length,
      resultCount: combined.length,
    })

  return combined.slice(0, take)
}

// Case-insensitive field access helpers for CSV rows
function buildLowerKeyMap(row: any) {
  const map: Record<string, unknown> = {}
  if (row && typeof row === 'object') {
    for (const key of Object.keys(row)) map[key.toLowerCase()] = row[key]
  }
  return map
}

function getStringCI(lowerMap: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = lowerMap[k.toLowerCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function mapRowToTaxonRecord(row: any): TaxonRecord {
  const lower = buildLowerKeyMap(row)

  // Primary scientific name with common synonyms/fallbacks
  // We ignore scientificName/canonical/binomial for matching/indexing. Keep it only for label when species is absent.
  let scientificName =
    getStringCI(lower, [
      'scientificName',
      'scientificname',
      'acceptedScientificName',
      'acceptscientificname',
      'canonicalName',
      'canonicalname',
      'binomial',
      'name',
    ]) || ''

  const genus = getStringCI(lower, ['genus'])
  const family = getStringCI(lower, ['family'])
  const order = getStringCI(lower, ['order'])
  const species = getStringCI(lower, ['species'])
  const vernacularName = getStringCI(lower, ['vernacularName', 'vernacularname', 'commonName', 'common_name', 'vernacular_name'])

  // If the file row lacks a scientificName but has a genus/family/order, use the highest available rank as display name
  if (!scientificName) scientificName = species || genus || family || order || ''

  const record: TaxonRecord = {
    taxonID: (row?.taxonID ?? row?.taxonKey ?? lower['taxonid'] ?? lower['taxonkey']) as any,
    scientificName,
    taxonRank: getStringCI(lower, ['taxonRank', 'rank']),
    taxonomicStatus: getStringCI(lower, ['taxonomicStatus', 'taxonomicstatus', 'status']),
    kingdom: getStringCI(lower, ['kingdom']),
    phylum: getStringCI(lower, ['phylum']),
    class: getStringCI(lower, ['class']),
    order,
    family,
    genus,
    species,
    vernacularName,
    acceptedTaxonKey: (row?.acceptedTaxonKey ?? lower['acceptedtaxonkey'] ?? lower['acceptednameusageid']) as any,
    acceptedScientificName: getStringCI(lower, [
      'acceptedScientificName',
      'acceptedscientificname',
      'acceptedNameUsage',
      'acceptednameusage',
    ]),
    iucnRedListCategory: getStringCI(lower, ['iucnRedListCategory', 'iucnredlistcategory', 'iucn_category']),
    extras: row,
  }
  return record
}

function addExact(index: Record<string, TaxonRecord[]>, value: string | undefined, ref: TaxonRecord) {
  const key = (value ?? '').trim().toLowerCase()
  if (!key) return
  const bucket = index[key] || (index[key] = [])
  bucket.push(ref)
}

function dedupeByKey(records: TaxonRecord[]): TaxonRecord[] {
  const seen: Record<string, boolean> = {}
  const result: TaxonRecord[] = []
  for (const r of records) {
    const key = String(r?.taxonID ?? r?.scientificName ?? '')
      .trim()
      .toLowerCase()
    if (!key || seen[key]) continue
    seen[key] = true
    result.push(r)
  }
  return result
}

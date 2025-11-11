import { speciesListsStore, type SpeciesList, type TaxonRecord } from './species-list.store'
import { invalidateSpeciesIndexForListId } from './species-search'
import { csvToObjects } from '../../utils/csv'
import type { IndexedFile as FolderIndexedFile } from '../folder-processing/files.state'

export type IndexedFile = FolderIndexedFile

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

      const records = rows.flatMap((row) => mapRowToTaxonRecords(row))

      const seen: Record<string, boolean> = {}
      const unique: TaxonRecord[] = []

      for (const r of records) {
        const key = stableTaxonKey(r)
        if (!key || seen[key]) continue
        seen[key] = true
        unique.push(r)
      }

      const id = f?.name || f?.path
      const fileName = f?.name || f?.path

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

      invalidateSpeciesIndexForListId(id)
    } catch (err) {
      console.log('🚨 species: failed to parse species list', { path: f?.path, err })
    }
  }

  speciesListsStore.set(lists)
}

async function readSpeciesCsvRows(params: { indexedFile: IndexedFile }) {
  const { indexedFile } = params

  const file = indexedFile?.file || (await (indexedFile?.handle as any)?.getFile?.())
  if (!file) return [] as any[]

  const text = await file.text()
  if (!text) return [] as any[]

  const rows = csvToObjects({ csvContent: text, hasHeaders: true }) as any[]
  const result = Array.isArray(rows) ? rows : []
  return result
}

type LowerKeyMap = Record<string, unknown>

const FIELD_KEYS = {
  scientificName: ['scientificName', 'acceptedScientificName', 'canonicalName', 'binomial', 'name'],
  taxonRank: ['taxonRank'],
  taxonomicStatus: ['taxonomicStatus'],
  kingdom: ['kingdom'],
  phylum: ['phylum'],
  class: ['class'],
  order: ['order'],
  family: ['family'],
  genus: ['genus'],
  species: ['species'],
  acceptedScientificName: ['acceptedScientificName'],
  iucnRedListCategory: ['iucnRedListCategory'],
} as const

const NUMERIC_ID_KEYS = {
  taxonID: ['taxonID', 'taxonKey'],
  acceptedTaxonKey: ['acceptedTaxonKey', 'acceptedNameUsageID'],
} as const

const RANK_SPECIFIC_ID_KEYS: Record<string, readonly string[]> = {
  kingdom: ['kingdomKey'],
  phylum: ['phylumKey'],
  class: ['classKey'],
  order: ['orderKey'],
  family: ['familyKey'],
  genus: ['genusKey'],
  species: ['speciesKey'],
}

export function mapRowToTaxonRecords(row: any): TaxonRecord[] {
  const lower = buildLowerKeyMap(row)

  const kingdom = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.kingdom as unknown as string[]))
  const phylum = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.phylum as unknown as string[]))
  const className = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.class as unknown as string[]))
  const order = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.order as unknown as string[]))
  const family = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.family as unknown as string[]))
  const genus = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.genus as unknown as string[]))
  const species = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.species as unknown as string[]))

  const acceptedTaxonKey = getFirstDefined(row, lower, NUMERIC_ID_KEYS.acceptedTaxonKey) as any
  const iucnRedListCategory = getStringCI(lower, FIELD_KEYS.iucnRedListCategory as unknown as string[])
  const taxonomicStatus = getStringCI(lower, FIELD_KEYS.taxonomicStatus as unknown as string[])
  const acceptedScientificName = getStringCI(lower, FIELD_KEYS.acceptedScientificName as unknown as string[])
  const extras = buildExtrasFiltered(row)

  const rankPairs: Array<{ rank: string; value?: string }> = [
    { rank: 'kingdom', value: kingdom },
    { rank: 'phylum', value: phylum },
    { rank: 'class', value: className },
    { rank: 'order', value: order },
    { rank: 'family', value: family },
    { rank: 'genus', value: genus },
    { rank: 'species', value: species },
  ]

  const out: TaxonRecord[] = []

  const rankOrder = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'] as const

  for (const { rank, value } of rankPairs) {
    const rankValue = (value ?? '').trim()
    if (!rankValue) continue

    const rankId = getFirstDefined(row, lower, RANK_SPECIFIC_ID_KEYS[rank] || []) as any
    const taxonID = rankId != null && rankId !== '' ? rankId : (getFirstDefined(row, lower, NUMERIC_ID_KEYS.taxonID) as any)

    const rankIndex = rankOrder.indexOf(rank as any)
    const record: TaxonRecord = {
      taxonID,
      // scientificName only meaningful at species level; keep empty otherwise
      scientificName: rank === 'species' ? species || '' : '',
      taxonRank: rank,
      taxonomicStatus,
      // Only include fields up to and including the record's rank
      kingdom: rankIndex >= 0 ? kingdom : undefined,
      phylum: rankIndex >= 1 ? phylum : undefined,
      class: rankIndex >= 2 ? className : undefined,
      order: rankIndex >= 3 ? order : undefined,
      family: rankIndex >= 4 ? family : undefined,
      genus: rankIndex >= 5 ? genus : undefined,
      species: rankIndex >= 6 ? species : undefined,
      acceptedTaxonKey,
      acceptedScientificName,
      iucnRedListCategory,
      extras,
    }

    out.push(record)
  }

  return out
}

function getFirstDefined(row: any, lower: LowerKeyMap, keys: readonly string[]) {
  for (const k of keys) {
    const v = row?.[k] ?? (lower as any)?.[k.toLowerCase()]
    if (v != null && v !== '') return v
  }
  return undefined
}

const EXTRAS_WHITELIST = [
  'numberOfOccurrences',
  'kingdomKey',
  'phylumKey',
  'classKey',
  'orderKey',
  'familyKey',
  'genusKey',
  'speciesKey',
  'taxonomicStatus',
  'acceptedScientificName',
] as const

function buildExtrasFiltered(row: any) {
  const extras: Record<string, unknown> = {}
  if (!row || typeof row !== 'object') return extras

  const canonicalLower = new Set<string>([
    ...Object.values(FIELD_KEYS)
      .flat()
      .map((k) => k.toLowerCase()),
    ...Object.values(NUMERIC_ID_KEYS)
      .flat()
      .map((k) => k.toLowerCase()),
  ])

  for (const [key, value] of Object.entries(row)) {
    const lowerKey = key.toLowerCase()
    if (canonicalLower.has(lowerKey)) continue
    if (value == null) continue
    if (typeof value === 'string' && !value.trim()) continue
    extras[key] = value
  }

  for (const k of EXTRAS_WHITELIST) {
    const v = (row as any)?.[k]
    if (v != null && !(k in extras)) extras[k] = v
  }

  return extras
}

function buildLowerKeyMap(row: any) {
  const map: LowerKeyMap = {}
  if (row && typeof row === 'object') {
    for (const key of Object.keys(row)) map[key.toLowerCase().trim()] = (row as any)[key]
  }
  return map
}

function getStringCI(lowerMap: LowerKeyMap, keys: string[]) {
  for (const k of keys) {
    const v = (lowerMap as any)[k.toLowerCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function normalizeTaxonValue(value: string | undefined) {
  const v = (value ?? '').trim()
  if (!v) return undefined
  const lower = v.toLowerCase()
  if (lower === 'na' || lower === 'n/a' || lower === 'null' || lower === 'undefined' || lower === 'na na') return undefined
  return v
}

function stableTaxonKey(record: TaxonRecord) {
  const parts: string[] = []

  const kingdom = String(record?.kingdom ?? '').trim().toLowerCase()
  if (!kingdom) return ''
  parts.push(kingdom)

  const rank = String(record?.taxonRank ?? '').trim().toLowerCase()
  if (rank === 'kingdom') return parts.join(':')

  const phylum = String(record?.phylum ?? '').trim().toLowerCase()
  if (phylum) parts.push(phylum)
  if (rank === 'phylum') return parts.join(':')

  const className = String(record?.class ?? '').trim().toLowerCase()
  if (className) parts.push(className)
  if (rank === 'class') return parts.join(':')

  const order = String(record?.order ?? '').trim().toLowerCase()
  if (order) parts.push(order)
  if (rank === 'order') return parts.join(':')

  const family = String(record?.family ?? '').trim().toLowerCase()
  if (family) parts.push(family)
  if (rank === 'family') return parts.join(':')

  const genus = String(record?.genus ?? '').trim().toLowerCase()
  if (genus) parts.push(genus)
  if (rank === 'genus') return parts.join(':')

  const species = String(record?.species ?? '').trim().toLowerCase()
  if (species) parts.push(species)
  if (rank === 'species') return parts.join(':')

  return parts.join(':')
}

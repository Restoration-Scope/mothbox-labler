import { speciesListsStore, type SpeciesList, type TaxonRecord } from './species-list.store'
import { invalidateSpeciesIndexForListId } from './species-search'
import { csvToObjects } from '~/utils/csv'
import type { IndexedFile as FolderIndexedFile } from '~/features/folder-processing/files.state'

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

      const records = rows.map((row) => mapRowToTaxonRecord(row)).filter((r) => !!r?.scientificName)

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

function mapRowToTaxonRecord(row: any): TaxonRecord {
  const lower = buildLowerKeyMap(row)

  const genus = getStringCI(lower, FIELD_KEYS.genus as unknown as string[])
  const family = getStringCI(lower, FIELD_KEYS.family as unknown as string[])
  const order = getStringCI(lower, FIELD_KEYS.order as unknown as string[])
  const species = getStringCI(lower, FIELD_KEYS.species as unknown as string[])

  let scientificName = getStringCI(lower, FIELD_KEYS.scientificName as unknown as string[]) || ''
  if (!scientificName) scientificName = species || genus || family || order || ''

  const record: TaxonRecord = {
    taxonID: getFirstDefined(row, lower, NUMERIC_ID_KEYS.taxonID) as any,
    scientificName,
    taxonRank: getStringCI(lower, FIELD_KEYS.taxonRank as unknown as string[]),
    kingdom: getStringCI(lower, FIELD_KEYS.kingdom as unknown as string[]),
    phylum: getStringCI(lower, FIELD_KEYS.phylum as unknown as string[]),
    class: getStringCI(lower, FIELD_KEYS.class as unknown as string[]),
    order,
    family,
    genus,
    species,
    acceptedTaxonKey: getFirstDefined(row, lower, NUMERIC_ID_KEYS.acceptedTaxonKey) as any,
    iucnRedListCategory: getStringCI(lower, FIELD_KEYS.iucnRedListCategory as unknown as string[]),
    extras: buildExtrasFiltered(row),
  }
  return record
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

import fuzzysort from 'fuzzysort'
import type { TaxonRecord } from '~/stores/species-lists'

export type SpeciesListRow = {
  taxonKey?: string | number
  scientificName?: string
  acceptedTaxonKey?: string | number
  acceptedScientificName?: string
  numberOfOccurrences?: number
  taxonRank?: string
  taxonomicStatus?: string
  kingdom?: string
  kingdomKey?: string | number
  phylum?: string
  phylumKey?: string | number
  class?: string
  classKey?: string | number
  order?: string
  orderKey?: string | number
  family?: string
  familyKey?: string | number
  genus?: string
  genusKey?: string | number
  species?: string
  speciesKey?: string | number
  iucnRedListCategory?: string
  // passthrough: allow extra columns safely
  [key: string]: unknown
}

export type SpeciesIndexItem = { ref: TaxonRecord; search: any }

export type BuiltSpeciesIndex = {
  index: SpeciesIndexItem[]
  exactMap: Record<string, TaxonRecord[]>
}

export function buildSpeciesIndex(params: { rows: SpeciesListRow[] }): BuiltSpeciesIndex {
  const { rows } = params

  const index: SpeciesIndexItem[] = []
  const exactMap: Record<string, TaxonRecord[]> = {}

  if (!Array.isArray(rows) || rows.length === 0) return { index, exactMap }

  for (const row of rows) {
    if (!row) continue

    const isUnranked = (row?.taxonRank ?? '').toString().toLowerCase() === 'unranked'
    const status = (row?.taxonomicStatus ?? '').toString().toLowerCase()
    const isAccepted = !status || status === 'accepted'
    if (isUnranked || !isAccepted) continue

    const record = mapRowToTaxonRecord(row)
    if (!record?.scientificName) continue

    const combined = buildCombinedSearchString(record)
    const prepared = fuzzysort.prepare(combined)
    index.push({ ref: record, search: prepared })

    addExact(exactMap, record.species, record)
    addExact(exactMap, record.genus, record)
    addExact(exactMap, record.family, record)
    addExact(exactMap, record.order, record)
    addExact(exactMap, record.class, record)
    addExact(exactMap, record.phylum, record)
    addExact(exactMap, record.kingdom, record)
  }

  return { index, exactMap }
}

export function searchSpeciesIndex(params: {
  index: SpeciesIndexItem[]
  exactMap: Record<string, TaxonRecord[]>
  query: string
  limit?: number
}): TaxonRecord[] {
  const { index, exactMap, query, limit = 20 } = params
  const q = (query ?? '').trim()
  if (!q) return []
  if (!Array.isArray(index) || index.length === 0) return []

  let fuzzy: TaxonRecord[] = fuzzysort
    .go(q, index as any, { key: 'search' as any, limit, threshold: -10000 })
    .map((r: any) => r?.obj?.ref as TaxonRecord)

  const exactLower = q.toLowerCase()
  let exact: TaxonRecord[] = Array.isArray(exactMap?.[exactLower]) ? exactMap[exactLower] : []

  const filterAccepted = (r: TaxonRecord) => {
    const rank = (r?.taxonRank ?? '').toString().toLowerCase()
    const status = (r as any)?.taxonomicStatus?.toString().toLowerCase?.() ?? ''
    const isAccepted = !status || status === 'accepted'
    return rank !== 'unranked' && isAccepted
  }
  exact = exact.filter(filterAccepted)
  fuzzy = fuzzy.filter(filterAccepted)

  const combined = dedupeByKey([...exact, ...fuzzy])
  const take = Math.max(limit, exact.length)
  return combined.slice(0, take)
}

export function mapRowToTaxonRecord(row: SpeciesListRow): TaxonRecord {
  const scientificName = computeDisplayScientificName(row)
  const record: TaxonRecord = {
    taxonID: row?.taxonKey,
    scientificName,
    taxonRank: row?.taxonRank,
    taxonomicStatus: row?.taxonomicStatus,
    kingdom: safeString(row?.kingdom),
    phylum: safeString(row?.phylum),
    class: safeString(row?.class),
    order: safeString(row?.order),
    family: safeString(row?.family),
    genus: safeString(row?.genus),
    species: safeString(row?.species),
    acceptedTaxonKey: row?.acceptedTaxonKey,
    acceptedScientificName: safeString(row?.acceptedScientificName),
    iucnRedListCategory: safeString(row?.iucnRedListCategory),
    extras: row as any,
  }
  return record
}

function computeDisplayScientificName(row: SpeciesListRow) {
  const species = safeString(row?.species)
  const genus = safeString(row?.genus)
  const family = safeString(row?.family)
  const order = safeString(row?.order)
  const klass = safeString(row?.class)
  const phylum = safeString(row?.phylum)
  const kingdom = safeString(row?.kingdom)
  const fallback = safeString(row?.scientificName) || safeString(row?.acceptedScientificName)
  const display = species || genus || family || order || klass || phylum || kingdom || fallback || ''
  return display
}

function buildCombinedSearchString(r: TaxonRecord) {
  const combined = [r.species, r.genus, r.family, r.order, r.class, r.phylum, r.kingdom, r.vernacularName].filter(Boolean).join(' | ')
  return combined
}

function addExact(map: Record<string, TaxonRecord[]>, value: string | undefined, ref: TaxonRecord) {
  const key = (value ?? '').trim().toLowerCase()
  if (!key) return
  const bucket = map[key] || (map[key] = [])
  bucket.push(ref)
}

function dedupeByKey(records: TaxonRecord[]) {
  const seen: Record<string, boolean> = {}
  const out: TaxonRecord[] = []
  for (const r of records) {
    const key = String(r?.taxonID ?? r?.scientificName ?? '')
      .trim()
      .toLowerCase()
    if (!key || seen[key]) continue
    seen[key] = true
    out.push(r)
  }
  return out
}

function safeString(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

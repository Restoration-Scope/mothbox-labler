import fuzzysort from 'fuzzysort'
import type { TaxonRecord } from '~/stores/species/species-lists'

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
    const statusFromExtras = ((r as any)?.extras as any)?.taxonomicStatus as any
    const status = typeof statusFromExtras === 'string' ? statusFromExtras.toLowerCase() : ''
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
    kingdom: safeString(row?.kingdom),
    phylum: safeString(row?.phylum),
    class: safeString(row?.class),
    order: safeString(row?.order),
    family: safeString(row?.family),
    genus: safeString(row?.genus),
    species: safeString(row?.species),
    acceptedTaxonKey: row?.acceptedTaxonKey,
    iucnRedListCategory: safeString(row?.iucnRedListCategory),
    extras: buildExtrasFiltered(row as any),
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

const EXTRAS_WHITELIST = [
  'numberOfOccurrences',
  'kingdomKey',
  'phylumKey',
  'classKey',
  'orderKey',
  'familyKey',
  'genusKey',
  'speciesKey',
  // mirror ingest: keep these in extras
  'taxonomicStatus',
  'acceptedScientificName',
] as const

function buildExtrasFiltered(row: any) {
  const extras: Record<string, unknown> = {}
  if (!row || typeof row !== 'object') return extras

  const canonicalKeys = new Set<string>([
    'taxonkey',
    'scientificname',
    'acceptedscientificname',
    'numberofoccurrences',
    'taxonrank',
    'taxonomicstatus',
    'kingdom',
    'kingdomkey',
    'phylum',
    'phylumkey',
    'class',
    'classkey',
    'order',
    'orderkey',
    'family',
    'familykey',
    'genus',
    'genuskey',
    'species',
    'specieskey',
    'acceptedtaxonkey',
    'iucnredlistcategory',
  ])

  for (const [key, value] of Object.entries(row)) {
    const lowerKey = key.toLowerCase()
    if (canonicalKeys.has(lowerKey)) continue
    if (value == null) continue
    if (typeof value === 'string' && !value.trim()) continue
    extras[key] = value
  }

  // Ensure whitelisted extras are present even if empty in the loop above
  for (const k of EXTRAS_WHITELIST) {
    const v = (row as any)?.[k]
    if (v != null && !(k in extras)) extras[k] = v
  }

  return extras
}

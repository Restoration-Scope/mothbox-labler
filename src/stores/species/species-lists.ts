import { atom } from 'nanostores'
import fuzzysort from 'fuzzysort'
import { csvToObjects } from '~/utils/csv'

// Ingest types moved to species.ingest.ts; keep minimal local types only if needed

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

// Invalidation API used by species.ingest.ts
export function invalidateSpeciesIndexForListId(listId: string) {
  if (!listId) return
  delete speciesIndexCache[listId]
  delete speciesExactIndexCache[listId]
}

// CSV reading and mapping moved to species.ingest.ts

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

// mapping helpers moved to species.ingest.ts

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

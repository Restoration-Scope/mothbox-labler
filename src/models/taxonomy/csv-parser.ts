/**
 * CSV parsing for species lists.
 * Converts CSV rows into TaxonRecord objects using the unified builder.
 */

import type { TaxonRecord } from './types'
import { normalizeTaxonValue } from './normalize'
import { buildTaxonRecord, type TaxonMetadata } from './builder'

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

/**
 * Converts a CSV row into one or more TaxonRecord objects.
 * Creates a record for each taxonomic rank present in the row.
 * Uses the unified builder to ensure consistency with JSON ingestion.
 */
export function mapRowToTaxonRecords(row: any): TaxonRecord[] {
  const lower = buildLowerKeyMap(row)

  // Extract taxonomy fields using case-insensitive matching
  const kingdom = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.kingdom as unknown as string[]))
  const phylum = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.phylum as unknown as string[]))
  const className = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.class as unknown as string[]))
  const order = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.order as unknown as string[]))
  const family = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.family as unknown as string[]))
  const genus = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.genus as unknown as string[]))
  const species = normalizeTaxonValue(getStringCI(lower, FIELD_KEYS.species as unknown as string[]))

  // Extract metadata fields
  const acceptedTaxonKey = getFirstDefined(row, lower, NUMERIC_ID_KEYS.acceptedTaxonKey) as any
  const iucnRedListCategory = getStringCI(lower, FIELD_KEYS.iucnRedListCategory as unknown as string[])
  const taxonomicStatus = getStringCI(lower, FIELD_KEYS.taxonomicStatus as unknown as string[])
  const acceptedScientificName = getStringCI(lower, FIELD_KEYS.acceptedScientificName as unknown as string[])
  const extras = buildExtrasFiltered(row)

  // Build records for each rank present
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

    // Get rank-specific ID or fallback to general taxonID
    const rankId = getFirstDefined(row, lower, RANK_SPECIFIC_ID_KEYS[rank] || []) as any
    const taxonID = rankId != null && rankId !== '' ? rankId : (getFirstDefined(row, lower, NUMERIC_ID_KEYS.taxonID) as any)

    const rankIndex = rankOrder.indexOf(rank as any)

    // Build metadata for this rank
    const metadata: TaxonMetadata = {
      taxonID,
      acceptedTaxonKey,
      acceptedScientificName,
      taxonomicStatus,
      iucnRedListCategory,
      extras,
    }

    // Use unified builder - only include fields up to and including this rank
    const record = buildTaxonRecord({
      kingdom: rankIndex >= 0 ? kingdom : undefined,
      phylum: rankIndex >= 1 ? phylum : undefined,
      class: rankIndex >= 2 ? className : undefined,
      order: rankIndex >= 3 ? order : undefined,
      family: rankIndex >= 4 ? family : undefined,
      genus: rankIndex >= 5 ? genus : undefined,
      species: rankIndex >= 6 ? species : undefined,
      metadata,
      isError: false,
    })

    if (record) {
      // Override taxonRank to match the current rank being processed
      record.taxonRank = rank
      // For non-species ranks, clear scientificName (it's only meaningful at species level)
      if (rank !== 'species') {
        record.scientificName = ''
      }
      out.push(record)
    }
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




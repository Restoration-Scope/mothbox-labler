/**
 * Centralized stable key generation for taxonomy records.
 * This is the SINGLE source of truth for generating unique keys for deduplication and matching.
 */

import type { TaxonRecord } from './types'
import { normalizeTaxonValue } from './normalize'

/**
 * Generates a stable, unique key for a TaxonRecord based on its taxonomy hierarchy.
 * The key includes all taxonomy levels up to and including the record's taxonRank.
 *
 * Format: "kingdom:phylum:class:order:family:genus:species" (lowercase, colon-separated)
 *
 * Rules:
 * - Returns empty string if kingdom is missing (invalid record)
 * - Stops at the record's taxonRank level
 * - All values are lowercased and trimmed
 *
 * @example
 * // For a species-level record:
 * stableTaxonKey({ kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta',
 *                  order: 'Lepidoptera', family: 'Noctuidae', genus: 'Agrotis',
 *                  species: 'ipsilon', taxonRank: 'species' })
 * // Returns: "animalia:arthropoda:insecta:lepidoptera:noctuidae:agrotis:ipsilon"
 *
 * @example
 * // For an order-level record:
 * stableTaxonKey({ kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta',
 *                  order: 'Lepidoptera', taxonRank: 'order' })
 * // Returns: "animalia:arthropoda:insecta:lepidoptera"
 */
export function stableTaxonKey(record: TaxonRecord | undefined | null): string {
  if (!record) return ''

  const parts: string[] = []

  const kingdom = normalizeTaxonValue(record.kingdom)
  if (!kingdom) return ''
  parts.push(kingdom.toLowerCase())

  const rank = normalizeTaxonValue(record.taxonRank)
  if (rank === 'kingdom') return parts.join(':')

  const phylum = normalizeTaxonValue(record.phylum)
  if (phylum) {
    parts.push(phylum.toLowerCase())
    if (rank === 'phylum') return parts.join(':')
  }

  const classValue = normalizeTaxonValue(record.class)
  if (classValue) {
    parts.push(classValue.toLowerCase())
    if (rank === 'class') return parts.join(':')
  }

  const order = normalizeTaxonValue(record.order)
  if (order) {
    parts.push(order.toLowerCase())
    if (rank === 'order') return parts.join(':')
  }

  const family = normalizeTaxonValue(record.family)
  if (family) {
    parts.push(family.toLowerCase())
    if (rank === 'family') return parts.join(':')
  }

  const genus = normalizeTaxonValue(record.genus)
  if (genus) {
    parts.push(genus.toLowerCase())
    if (rank === 'genus') return parts.join(':')
  }

  const species = normalizeTaxonValue(record.species)
  if (species) {
    parts.push(species.toLowerCase())
    if (rank === 'species') return parts.join(':')
  }

  return parts.join(':')
}

/**
 * Deduplicates an array of TaxonRecords using stableTaxonKey.
 * Preserves order, keeping the first occurrence of each unique key.
 */
export function dedupeByTaxonKey(records: TaxonRecord[]): TaxonRecord[] {
  const seen = new Set<string>()
  const result: TaxonRecord[] = []

  for (const record of records) {
    const key = stableTaxonKey(record)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(record)
  }

  return result
}

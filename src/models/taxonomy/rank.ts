/**
 * Centralized rank determination and hierarchy utilities.
 * Single source of truth for determining scientific names and ranks from taxonomy data.
 */

import type { TaxonRecord, TaxonomyRank, ExtractedTaxonomy, ScientificNameAndRank, MissingRank, RANK_HIERARCHY } from './types'

/**
 * Determines the scientific name and taxon rank from extracted taxonomy fields.
 * Returns the deepest (most specific) taxonomic level that has a value.
 *
 * Priority order: species > genus > family > order > class > phylum > kingdom
 */
export function determineScientificNameAndRank(params: { taxonomy: ExtractedTaxonomy }): ScientificNameAndRank {
  const { taxonomy } = params
  const { species, genus, family, order, klass, phylum, kingdom } = taxonomy

  if (species) return { scientificName: species, taxonRank: 'species' }
  if (genus) return { scientificName: genus, taxonRank: 'genus' }
  if (family) return { scientificName: family, taxonRank: 'family' }
  if (order) return { scientificName: order, taxonRank: 'order' }
  if (klass) return { scientificName: klass, taxonRank: 'class' }
  if (phylum) return { scientificName: phylum, taxonRank: 'phylum' }
  if (kingdom) return { scientificName: kingdom, taxonRank: 'kingdom' }

  return { scientificName: undefined, taxonRank: undefined }
}

/**
 * Returns the deepest taxonomic level value from a TaxonRecord.
 * Skips values that look like morphospecies codes.
 *
 * @see looksLikeMorphospeciesCode in morphospecies.ts for code detection logic
 */
export function getDeepestTaxonomicLevel(params: { taxon?: TaxonRecord }): string | undefined {
  const { taxon } = params
  if (!taxon) return undefined

  // Check in order from deepest to shallowest
  if (taxon.species && !looksLikeMorphoCode(taxon.species)) return taxon.species
  if (taxon.genus) return taxon.genus
  if (taxon.family) return taxon.family
  if (taxon.order) return taxon.order
  if (taxon.class) return taxon.class
  if (taxon.phylum) return taxon.phylum
  if (taxon.kingdom) return taxon.kingdom

  return undefined
}

/**
 * Quick check if a value looks like a morphospecies code.
 * Used internally to skip invalid species values.
 */
function looksLikeMorphoCode(value: string): boolean {
  if (!value) return false

  const trimmed = value.trim()
  if (!trimmed) return false

  // Pure numbers are definitely morphospecies codes
  if (/^\d+$/.test(trimmed)) return true

  // Very short values with numbers are likely codes (e.g., "sp1", "A1")
  if (trimmed.length <= 4 && /\d/.test(trimmed)) return true

  // Values that are mostly numbers with some letters (e.g., "111a", "42b")
  const digitCount = (trimmed.match(/\d/g) || []).length
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length
  if (digitCount > 0 && digitCount >= letterCount) return true

  return false
}

/**
 * Gets the value for a specific rank from a TaxonRecord.
 */
export function getRankValue(taxon: TaxonRecord | undefined, rank: TaxonomyRank): string | undefined {
  if (!taxon) return undefined

  if (rank === 'kingdom') return taxon.kingdom
  if (rank === 'phylum') return taxon.phylum
  if (rank === 'class') return taxon.class
  if (rank === 'order') return taxon.order
  if (rank === 'family') return taxon.family
  if (rank === 'genus') return taxon.genus
  if (rank === 'species') return taxon.species

  return undefined
}

/**
 * Sets the value for a specific rank on a TaxonRecord (mutates the record).
 */
export function setRankValue(taxon: TaxonRecord, rank: TaxonomyRank, value: string): void {
  if (rank === 'kingdom') taxon.kingdom = value
  else if (rank === 'phylum') taxon.phylum = value
  else if (rank === 'class') taxon.class = value
  else if (rank === 'order') taxon.order = value
  else if (rank === 'family') taxon.family = value
  else if (rank === 'genus') taxon.genus = value
  else if (rank === 'species') taxon.species = value
}

/**
 * Checks if a TaxonRecord has an ID for a specific rank in its extras.
 */
export function hasRankId(taxon: TaxonRecord | undefined, rank: TaxonomyRank): boolean {
  if (!taxon) return false

  const extras = taxon.extras as Record<string, unknown> | undefined
  const keyField = `${rank}Key`
  const idValue = extras?.[keyField]

  if (idValue == null) return false

  const strValue = String(idValue).trim().toUpperCase()
  if (strValue === '' || strValue === 'NA') return false

  return true
}

/**
 * Gets the ID for a specific rank from a TaxonRecord's extras.
 */
export function getRankId(taxon: TaxonRecord | undefined, rank: TaxonomyRank): string | number | undefined {
  if (!taxon) return undefined

  const extras = taxon.extras as Record<string, unknown> | undefined
  const keyField = `${rank}Key`
  const raw = extras?.[keyField]

  if (raw == null) return undefined

  const strValue = String(raw).trim().toUpperCase()
  if (strValue === '' || strValue === 'NA') return undefined

  return raw as string | number
}

const RANK_HIERARCHY_ARRAY: TaxonomyRank[] = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']

/**
 * Detects missing ranks (name or ID) in a TaxonRecord's hierarchy.
 * Returns ranks that should be filled based on the record's taxonRank.
 */
export function detectMissingRanks(taxon: TaxonRecord): MissingRank[] {
  const taxonRank = (taxon?.taxonRank ?? '').toLowerCase() as TaxonomyRank
  const rankIndex = RANK_HIERARCHY_ARRAY.indexOf(taxonRank)
  if (rankIndex === -1) return []

  const expectedRanks = RANK_HIERARCHY_ARRAY.slice(0, rankIndex)
  const missing: MissingRank[] = []

  for (const rank of expectedRanks) {
    const nameValue = getRankValue(taxon, rank)
    const hasName = !!nameValue?.trim()
    const hasId = hasRankId(taxon, rank)

    if (!hasName || !hasId) {
      missing.push({
        rank,
        missingName: !hasName,
        missingId: !hasId,
      })
    }
  }

  return missing
}

/**
 * Checks if a TaxonRecord has any gaps in its taxonomy hierarchy.
 */
export function hasTaxonomyGaps(taxon: TaxonRecord): boolean {
  const missing = detectMissingRanks(taxon)
  return missing.length > 0
}

/**
 * Merges gap-fill values into a TaxonRecord.
 * Creates a new record with the filled values.
 */
export function mergeTaxonWithGapFill(params: { taxon: TaxonRecord; values: Record<string, { name: string; id: string }> }): TaxonRecord {
  const { taxon, values } = params

  const merged: TaxonRecord = { ...taxon }
  const extras: Record<string, unknown> = { ...(taxon?.extras ?? {}) }

  for (const [rank, { name, id }] of Object.entries(values)) {
    const trimmedName = name.trim()
    const trimmedId = id.trim()

    if (trimmedName) {
      setRankValue(merged, rank as TaxonomyRank, trimmedName)
    }

    if (trimmedId) {
      const keyField = `${rank}Key`
      const idValue = isNaN(Number(trimmedId)) ? trimmedId : Number(trimmedId)
      extras[keyField] = idValue
    }
  }

  merged.extras = extras

  return merged
}

/**
 * Builds a "genus species" formatted name from genus and species values.
 * Avoids duplication if species already contains the genus.
 */
export function buildGenusSpeciesName(params: { genus?: string; species: string }): string {
  const { genus, species } = params

  if (!genus) return species

  // Check if species already starts with genus to avoid "Pygoda Pygoda irrorate"
  if (species.toLowerCase().startsWith(genus.toLowerCase())) return species

  return `${genus} ${species}`.trim()
}

/**
 * Returns a human-readable label for a taxonomy field key.
 */
export function getTaxonomyFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    kingdom: 'Kingdom',
    phylum: 'Phylum',
    class: 'Class',
    order: 'Order',
    family: 'Family',
    genus: 'Genus',
    species: 'Species',
    morphospecies: 'Morphospecies',
    scientificName: 'Scientific name',
    name: 'Name',
    commonName: 'Common name',
  }

  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1)
}


/**
 * Centralized morphospecies detection and handling.
 * Single source of truth for determining what constitutes a morphospecies.
 */

import type { TaxonRecord, ExtractedTaxonomy } from './types'

/**
 * Normalizes a morphospecies key for consistent lookup and storage.
 * Single source of truth for morphospecies key normalization.
 */
export function normalizeMorphoKey(input: string): string {
  const text = (input ?? '').trim().toLowerCase()
  return text
}

/**
 * Checks if a value looks like a morphospecies code rather than a valid species name.
 *
 * Morphospecies codes are typically:
 * - Pure numbers (e.g., "111", "42")
 * - Short alphanumeric codes (e.g., "A1", "sp1")
 * - Contain numbers without being a valid species epithet
 *
 * @example
 * looksLikeMorphospeciesCode("111")     // true
 * looksLikeMorphospeciesCode("sp1")     // true
 * looksLikeMorphospeciesCode("A1")      // true
 * looksLikeMorphospeciesCode("111a")    // true
 * looksLikeMorphospeciesCode("ipsilon") // false
 * looksLikeMorphospeciesCode("Agrotis") // false
 */
export function looksLikeMorphospeciesCode(value: string | undefined | null): boolean {
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
 * Extracts morphospecies value from a JSON shape during ingestion.
 * Used when loading _identified.json files.
 *
 * Logic (in priority order):
 * - If isError, returns undefined
 * - First check for dedicated morphospecies field (new format)
 * - Fall back to inference from species field (if present but taxon.species is empty)
 * - Fall back to inference from label field (if no scientificName)
 */
export function extractMorphospeciesFromShape(params: {
  shape: any
  taxonomy: ExtractedTaxonomy
  taxon: { scientificName?: string; species?: string } | undefined
  isError: boolean
}): string | undefined {
  const { shape, taxonomy, taxon, isError } = params
  const { species } = taxonomy

  if (isError) return undefined

  // First check for dedicated morphospecies field (new format, preferred)
  const dedicatedMorphospecies = typeof shape?.morphospecies === 'string' ? shape.morphospecies.trim() : undefined
  if (dedicatedMorphospecies) return dedicatedMorphospecies

  // Fall back to inference logic for backward compatibility with old JSON files
  const labelValue = typeof shape?.label === 'string' ? shape.label : undefined

  // If species field has a value but taxon.species is empty, it's a morphospecies
  const hasMorphospeciesInSpeciesField = !!species && !taxon?.species
  const morphospeciesValue = hasMorphospeciesInSpeciesField ? species : undefined

  // If no scientificName but has label, use label as morphospecies
  if (!taxon?.scientificName && labelValue) return labelValue

  return morphospeciesValue
}

/**
 * Returns the species value from a detection for export.
 * Only returns actual taxonomic species - morphospecies goes in a separate column.
 * Sanitizes the value to prevent morphospecies codes from leaking into species column.
 */
export function getSpeciesValueForExport(params: { taxon?: TaxonRecord; morphospecies?: string }): string {
  const { taxon, morphospecies } = params

  // Don't include morphospecies in species column - it has its own column
  if (morphospecies) return ''

  const rawSpecies = taxon?.species || ''

  // Sanitize: if species looks like a morphospecies code, don't export it
  if (looksLikeMorphospeciesCode(rawSpecies)) return ''

  // Sanitize: if species equals the morphospecies value (data inconsistency), clear it
  if (rawSpecies && rawSpecies === morphospecies) return ''

  return rawSpecies
}

/**
 * Returns a valid scientific name for export (GBIF-compatible).
 * Scientific names should never contain numbers (morphospecies codes like "111" are not valid).
 */
export function getValidScientificNameForExport(params: { taxon?: TaxonRecord; morphospecies?: string; label?: string }): string {
  const { taxon, morphospecies, label } = params

  // Don't export morphospecies as scientificName
  if (morphospecies) {
    // Return higher-level taxon name if available
    if (taxon?.genus) return taxon.genus
    if (taxon?.family) return taxon.family
    if (taxon?.order) return taxon.order
    return ''
  }

  const candidate = taxon?.scientificName || ''

  // Sanitize: don't export morphospecies codes or values with numbers
  if (looksLikeMorphospeciesCode(candidate)) return ''

  if (candidate) return candidate

  // Fallback to label if valid (not a morphospecies code)
  const labelValue = label || ''
  if (labelValue && !looksLikeMorphospeciesCode(labelValue)) return labelValue

  return ''
}

// Legacy wrapper functions for backward compatibility with old { detection } signature
type DetectionLike = {
  taxon?: TaxonRecord
  morphospecies?: string
  label?: string
  isError?: boolean
  speciesListDOI?: string
}

/**
 * @deprecated Use getSpeciesValueForExport with { taxon, morphospecies } signature instead
 */
export function getSpeciesValue(params: { detection: DetectionLike }): string {
  const { detection } = params
  return getSpeciesValueForExport({
    taxon: detection?.taxon,
    morphospecies: detection?.morphospecies,
  })
}

/**
 * @deprecated Use getValidScientificNameForExport with { taxon, morphospecies, label } signature instead
 */
export function getValidScientificName(params: { detection: DetectionLike }): string {
  const { detection } = params
  return getValidScientificNameForExport({
    taxon: detection?.taxon,
    morphospecies: detection?.morphospecies,
    label: detection?.label,
  })
}

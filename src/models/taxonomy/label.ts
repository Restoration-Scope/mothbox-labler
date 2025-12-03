import type { TaxonRecord } from './types'
import { hasTaxonFields } from './validate'

/**
 * Computes the final display label for a detection based on taxon and morphospecies.
 * Single source of truth for label derivation logic.
 */
export function computeFinalLabel(params: { taxon?: TaxonRecord; label?: string; morphospecies?: string }): string {
  const { taxon, label, morphospecies } = params

  // If taxon is provided, derive label from taxon (even if morphospecies exists)
  // Morphospecies is preserved as metadata, but label reflects the taxonomy
  if (hasTaxonFields(taxon)) {
    if (taxon?.taxonRank === 'species') return taxon?.scientificName ?? ''
    return taxon?.genus || taxon?.family || taxon?.order || taxon?.scientificName || label?.trim() || ''
  }

  // No taxon: use morphospecies if present, otherwise use provided label
  if (morphospecies) return morphospecies
  return label?.trim() || ''
}




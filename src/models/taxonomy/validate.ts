import type { TaxonRecord } from './types'

/**
 * Checks if a taxon has any meaningful taxonomic fields populated.
 * Single source of truth for determining if a taxon object contains data.
 */
export function hasTaxonFields(taxon: TaxonRecord | undefined): boolean {
  return !!taxon && (!!taxon.taxonRank || !!taxon.genus || !!taxon.family || !!taxon.order || !!taxon.species)
}

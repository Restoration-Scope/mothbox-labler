import type { DetectionEntity } from '~/stores/entities/detections'
import type { TaxonRecord } from '~/features/species-identification/species-list.store'

/**
 * Derives the name column value from a detection's taxonomy.
 * Logic:
 * - If there's both genus and species (or morphospecies), use "genus species"
 * - If there's a morphospecies, use it
 * - Otherwise, use the deepest taxonomic level identified (species > genus > family > order > class > phylum > kingdom)
 * - Fallback to label if nothing else is available
 */
export function deriveTaxonName(params: { detection: DetectionEntity }): string {
  const { detection } = params
  const taxon = detection?.taxon

  const hasGenus = !!taxon?.genus
  const hasSpecies = !!taxon?.species || !!detection?.morphospecies
  if (hasGenus && hasSpecies) {
    const speciesValue = getSpeciesValue({ detection })
    return buildGenusSpeciesName({ genus: taxon.genus, species: speciesValue })
  }

  if (detection?.morphospecies) return detection.morphospecies

  const deepestLevel = getDeepestTaxonomicLevel({ taxon })
  if (deepestLevel) return deepestLevel

  return detection?.label || ''
}

/**
 * Creates a TaxonRecord with a computed name field
 */
export function taxonWithName(params: { taxon: TaxonRecord; detection: DetectionEntity }): TaxonRecord & { name: string } {
  const { taxon, detection } = params
  return {
    ...taxon,
    name: deriveTaxonName({ detection }),
  }
}

/**
 * Extracts all taxonomy fields from a detection, handling isError case.
 * Returns null for taxonomy fields when isError is true, otherwise returns the taxon field value.
 */
export function extractTaxonomyFields(params: { detection: DetectionEntity }) {
  const { detection } = params
  const isError = detection?.isError === true
  const taxon = detection?.taxon

  return {
    kingdom: isError ? null : taxon?.kingdom || null,
    phylum: isError ? null : taxon?.phylum || null,
    class: isError ? null : taxon?.class || null,
    order: isError ? null : taxon?.order || null,
    family: isError ? null : taxon?.family || null,
    genus: isError ? null : taxon?.genus || null,
    species: isError ? null : getSpeciesValue({ detection }) || null,
  }
}

/**
 * Extracts taxon metadata fields from a detection, handling isError case.
 * Returns undefined for metadata fields when isError is true.
 */
export function extractTaxonMetadata(params: { detection: DetectionEntity }) {
  const { detection } = params
  const isError = detection?.isError === true
  const taxon = detection?.taxon

  return {
    taxonID: isError ? undefined : (taxon?.taxonID as string | undefined),
    acceptedTaxonKey: isError ? undefined : (taxon?.acceptedTaxonKey as string | undefined),
    acceptedScientificName: isError ? undefined : (taxon?.acceptedScientificName as string | undefined),
    vernacularName: isError ? undefined : (taxon?.vernacularName as string | undefined),
    taxonRank: isError ? undefined : (taxon?.taxonRank as string | undefined),
    speciesListDOI: isError ? undefined : ((detection as any)?.speciesListDOI as string | undefined),
  }
}

/**
 * Returns the species value from a detection, preferring morphospecies over taxon.species.
 * Handles morphospecies correctly for export/write operations.
 */
export function getSpeciesValue(params: { detection: DetectionEntity }): string {
  const { detection } = params
  return detection?.morphospecies || detection?.taxon?.species || ''
}

/**
 * Returns the deepest taxonomic level from a taxon record.
 * Checks in order: species > genus > family > order > class > phylum > kingdom
 */
function getDeepestTaxonomicLevel(params: { taxon?: TaxonRecord }): string | undefined {
  const { taxon } = params
  if (taxon?.species) return taxon.species
  if (taxon?.genus) return taxon.genus
  if (taxon?.family) return taxon.family
  if (taxon?.order) return taxon.order
  if (taxon?.class) return taxon.class
  if (taxon?.phylum) return taxon.phylum
  if (taxon?.kingdom) return taxon.kingdom
  return undefined
}

/**
 * Builds a "genus species" formatted name from genus and species values.
 */
function buildGenusSpeciesName(params: { genus?: string; species: string }): string {
  const { genus, species } = params
  return `${genus} ${species}`.trim()
}

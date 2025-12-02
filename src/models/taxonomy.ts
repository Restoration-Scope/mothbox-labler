import type { DetectionEntity } from '~/stores/entities/detections'
import type { TaxonRecord } from '~/features/species-identification/species-list.store'

/**
 * Derives the name column value from a detection's taxonomy.
 * Logic:
 * - If there's a morphospecies, use it (morphospecies takes precedence over genus+species combination)
 * - If there's both genus and species (but no morphospecies), use "genus species"
 * - Otherwise, use the deepest taxonomic level identified (species > genus > family > order > class > phylum > kingdom)
 * - Fallback to label if nothing else is available
 */
export function deriveTaxonName(params: { detection: DetectionEntity }): string {
  const { detection } = params
  const taxon = detection?.taxon

  // If there's a morphospecies and a genus, combine them
  if (detection?.morphospecies && taxon?.genus) {
    return `${taxon.genus} ${detection.morphospecies}`
  }

  // If there's just a morphospecies (no genus), use it alone
  if (detection?.morphospecies) return detection.morphospecies

  const hasGenus = !!taxon?.genus
  const hasSpecies = !!taxon?.species
  if (hasGenus && hasSpecies && taxon?.genus && taxon?.species) {
    return buildGenusSpeciesName({ genus: taxon.genus, species: taxon.species })
  }

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
 * Returns the species value from a detection for export.
 * Only returns actual taxonomic species - morphospecies goes in a separate column.
 * Sanitizes the value to prevent morphospecies codes from leaking into species column.
 */
export function getSpeciesValue(params: { detection: DetectionEntity }): string {
  const { detection } = params

  // Don't include morphospecies in species column - it has its own column
  if (detection?.morphospecies) return ''

  const rawSpecies = detection?.taxon?.species || ''

  // Sanitize: if species looks like a morphospecies code, don't export it
  if (looksLikeMorphospeciesCode(rawSpecies)) return ''

  // Sanitize: if species equals the morphospecies value (data inconsistency), clear it
  if (rawSpecies && rawSpecies === detection?.morphospecies) return ''

  return rawSpecies
}

/**
 * Checks if a value looks like a morphospecies code rather than a valid species name.
 * Morphospecies codes are typically:
 * - Pure numbers (e.g., "111", "42")
 * - Short alphanumeric codes (e.g., "A1", "sp1")
 * - Contain numbers without being a valid species epithet
 */
function looksLikeMorphospeciesCode(value: string): boolean {
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
 * Returns the deepest taxonomic level from a taxon record.
 * Checks in order: species > genus > family > order > class > phylum > kingdom
 * Skips values that look like morphospecies codes.
 */
function getDeepestTaxonomicLevel(params: { taxon?: TaxonRecord }): string | undefined {
  const { taxon } = params

  // Skip species if it looks like a morphospecies code
  if (taxon?.species && !looksLikeMorphospeciesCode(taxon.species)) return taxon.species
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
 * Avoids duplication if species already contains the genus (e.g., "Pygoda irrorate" stays as-is, not "Pygoda Pygoda irrorate")
 */
function buildGenusSpeciesName(params: { genus?: string; species: string }): string {
  const { genus, species } = params

  if (!genus) return species

  // Check if species already starts with genus to avoid "Pygoda Pygoda irrorate"
  if (species.toLowerCase().startsWith(genus.toLowerCase())) return species

  return `${genus} ${species}`.trim()
}

/**
 * Returns a valid scientific name for export (GBIF-compatible).
 * Scientific names should never contain numbers (morphospecies codes like "111" are not valid).
 */
export function getValidScientificName(params: { detection: DetectionEntity }): string {
  const { detection } = params

  // Don't export morphospecies as scientificName
  if (detection?.morphospecies) {
    // Return higher-level taxon name if available
    const taxon = detection?.taxon
    if (taxon?.genus) return taxon.genus
    if (taxon?.family) return taxon.family
    if (taxon?.order) return taxon.order

    return ''
  }

  const candidate = detection?.taxon?.scientificName || ''

  // Sanitize: don't export morphospecies codes or values with numbers
  if (looksLikeMorphospeciesCode(candidate)) return ''

  if (candidate) return candidate

  // Fallback to label if valid (not a morphospecies code)
  const label = detection?.label || ''
  if (label && !looksLikeMorphospeciesCode(label)) return label

  return ''
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

/**
 * Aggregates taxonomy information from multiple detections.
 * Returns an object with all taxonomy fields that appear in at least one detection.
 */
export function aggregateTaxonomyFromDetections(params: { detections: DetectionEntity[] }) {
  const { detections } = params
  if (!detections.length) return null

  let kingdom: string | null = null
  let phylum: string | null = null
  let classValue: string | null = null
  let order: string | null = null
  let family: string | null = null
  let genus: string | null = null
  let species: string | null = null
  let morphospecies: string | null = null
  let scientificName: string | null = null
  let name: string | null = null
  let commonName: string | null = null

  for (const detection of detections) {
    const taxonomyFields = extractTaxonomyFields({ detection })
    const taxonMetadata = extractTaxonMetadata({ detection })
    const nameValue = deriveTaxonName({ detection })
    const speciesValue = getSpeciesValue({ detection })
    const morphoValue = detection?.morphospecies || ''

    if (taxonomyFields.kingdom) kingdom = taxonomyFields.kingdom
    if (taxonomyFields.phylum) phylum = taxonomyFields.phylum
    if (taxonomyFields.class) classValue = taxonomyFields.class
    if (taxonomyFields.order) order = taxonomyFields.order
    if (taxonomyFields.family) family = taxonomyFields.family
    if (taxonomyFields.genus) genus = taxonomyFields.genus
    if (speciesValue) species = speciesValue
    if (morphoValue) morphospecies = morphoValue
    if (taxonMetadata.acceptedScientificName || detection?.taxon?.scientificName) {
      scientificName = taxonMetadata.acceptedScientificName || detection?.taxon?.scientificName || null
    }
    if (nameValue) name = nameValue
    if (taxonMetadata.vernacularName) commonName = taxonMetadata.vernacularName
  }

  return {
    kingdom,
    phylum,
    class: classValue,
    order,
    family,
    genus,
    species,
    morphospecies,
    scientificName,
    name,
    commonName,
  }
}

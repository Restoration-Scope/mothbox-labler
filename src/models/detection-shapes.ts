import type { PhotoEntity } from '~/stores/entities/photos'
import type { DetectionEntity } from '~/stores/entities/detections'
import { extractTaxonomyFields, extractTaxonMetadata } from '~/models/taxonomy'

/**
 * Builds an IdentifiedJSONShape object from a detection for JSON export.
 * Returns the shape structure used in _identified.json files (progress persistence).
 */
export function buildIdentifiedJsonShapeFromDetection(params: { detection: DetectionEntity; identifierHuman?: string }) {
  const { detection, identifierHuman } = params

  const baseFields = buildDetectionBaseFields({ detection })
  const taxonomicFields = extractTaxonomyFields({ detection })
  const taxonMetadataFields = buildTaxonMetadataFields({ detection })
  const identityFields = buildDetectionIdentityFields({ detection, identifierHuman })

  const shape: any = {
    ...baseFields,
    ...taxonomicFields,
    ...taxonMetadataFields,
    ...identityFields,
  }

  return shape
}

/**
 * Converts an IdentifiedJSONShape (from _identified.json) back to a DetectionEntity.
 * Handles morphospecies extraction (species field when no taxon.species).
 * Used when loading saved progress.
 */
export function buildDetectionFromIdentifiedJsonShape(params: { shape: any; photo: PhotoEntity; existingDetection?: DetectionEntity }) {
  const { shape, photo, existingDetection } = params

  const patchFileName = shape?.patch_path?.replace(/^patches\//, '') || ''
  const detectionId = patchFileName
  const isError = shape?.is_error === true || String(shape?.label || '').toUpperCase() === 'ERROR'

  const extractedTaxonomy = extractTaxonomyFromShape({ shape })
  const scientificNameAndRank = determineScientificNameAndRank({ taxonomy: extractedTaxonomy })
  const taxon = buildTaxonFromShape({ shape, taxonomy: extractedTaxonomy, scientificNameAndRank, isError })
  const morphospecies = extractMorphospeciesFromShape({ shape, taxonomy: extractedTaxonomy, taxon, isError })
  const identifiedAt = extractIdentifiedAtTimestamp({ shape, existingDetection })

  const detection: DetectionEntity = {
    id: detectionId,
    patchId: detectionId,
    photoId: existingDetection?.photoId || (photo as any).id,
    nightId: (photo as any).nightId,
    label: isError ? 'ERROR' : taxon?.scientificName || safeLabel(shape?.label) || existingDetection?.label,
    taxon: (taxon as any) ?? (isError ? undefined : existingDetection?.taxon),
    score: safeNumber(shape?.score) ?? existingDetection?.score,
    direction: safeNumber(shape?.direction) ?? existingDetection?.direction,
    shapeType: safeLabel(shape?.shape_type) ?? existingDetection?.shapeType,
    points: Array.isArray(shape?.points) ? (shape.points as any) : existingDetection?.points,
    detectedBy: 'user',
    identifiedAt,
    clusterId: safeNumber(shape?.clusterID) ?? existingDetection?.clusterId,
    isError: isError ? true : undefined,
    morphospecies,
    speciesListDOI: shape?.species_list ?? existingDetection?.speciesListDOI,
  }

  return detection
}

/**
 * Builds the base detection fields object from a detection.
 * Returns the non-taxonomy fields (patch_path, label, score, direction, shape_type, points, clusterID) for JSON export.
 */
function buildDetectionBaseFields(params: { detection: DetectionEntity }) {
  const { detection } = params

  return {
    patch_path: `patches/${detection.patchId}`,
    label: detection.label,
    score: detection.score,
    direction: detection.direction,
    shape_type: detection.shapeType,
    points: detection.points,
    clusterID: typeof (detection as any)?.clusterId === 'number' ? (detection as any)?.clusterId : undefined,
  }
}

/**
 * Builds the detection identity fields object from a detection.
 * Returns the identity fields (is_error, identifier_human, timestamp_ID_human) for JSON export.
 */
function buildDetectionIdentityFields(params: { detection: DetectionEntity; identifierHuman?: string }) {
  const { detection, identifierHuman } = params

  return {
    is_error: (detection as any)?.isError ? true : undefined,
    identifier_human: detection?.detectedBy === 'user' ? identifierHuman : undefined,
    timestamp_ID_human: detection?.identifiedAt ?? Date.now(),
  }
}

/**
 * Builds the taxon metadata fields object from a detection.
 * Returns the metadata fields (taxonID, acceptedTaxonKey, etc.) for JSON export.
 */
function buildTaxonMetadataFields(params: { detection: DetectionEntity }) {
  const { detection } = params
  const taxonMetadata = extractTaxonMetadata({ detection })

  return {
    taxonID: taxonMetadata.taxonID,
    acceptedTaxonKey: taxonMetadata.acceptedTaxonKey,
    acceptedScientificName: taxonMetadata.acceptedScientificName,
    vernacularName: taxonMetadata.vernacularName,
    taxonRank: taxonMetadata.taxonRank,
    species_list: taxonMetadata.speciesListDOI || undefined,
  }
}

function extractTaxonomyFromShape(params: { shape: any }) {
  const { shape } = params

  return {
    kingdom: safeLabel(shape?.kingdom),
    phylum: safeLabel(shape?.phylum),
    klass: safeLabel(shape?.class),
    order: safeLabel(shape?.order),
    family: safeLabel(shape?.family),
    genus: safeLabel(shape?.genus),
    species: safeLabel(shape?.species),
  }
}

function determineScientificNameAndRank(params: { taxonomy: ReturnType<typeof extractTaxonomyFromShape> }) {
  const { taxonomy } = params
  const { species, genus, family, order, klass, phylum, kingdom } = taxonomy

  if (species) return { scientificName: species, taxonRank: 'species' as const }
  if (genus) return { scientificName: genus, taxonRank: 'genus' as const }
  if (family) return { scientificName: family, taxonRank: 'family' as const }
  if (order) return { scientificName: order, taxonRank: 'order' as const }
  if (klass) return { scientificName: klass, taxonRank: 'class' as const }
  if (phylum) return { scientificName: phylum, taxonRank: 'phylum' as const }
  if (kingdom) return { scientificName: kingdom, taxonRank: 'kingdom' as const }

  return { scientificName: undefined, taxonRank: undefined }
}

function buildTaxonFromShape(params: {
  shape: any
  taxonomy: ReturnType<typeof extractTaxonomyFromShape>
  scientificNameAndRank: ReturnType<typeof determineScientificNameAndRank>
  isError: boolean
}) {
  const { shape, taxonomy, scientificNameAndRank, isError } = params
  const { kingdom, phylum, klass, order, family, genus, species } = taxonomy
  const { scientificName, taxonRank } = scientificNameAndRank

  const hasTaxon = !!(scientificName || kingdom || phylum || klass || order || family || genus || species)

  if (isError || !hasTaxon) return undefined

  const taxonBase = {
    scientificName: scientificName || '',
    taxonRank,
    kingdom,
    phylum,
    class: klass,
    order,
    family,
    genus,
    species: undefined, // Species will be handled separately for morphospecies
  }

  return {
    ...taxonBase,
    taxonID: shape?.taxonID ?? undefined,
    acceptedTaxonKey: shape?.acceptedTaxonKey ?? undefined,
    acceptedScientificName: shape?.acceptedScientificName ?? undefined,
    vernacularName: shape?.vernacularName ?? undefined,
    taxonRank: shape?.taxonRank ?? taxonBase.taxonRank,
  }
}

function extractMorphospeciesFromShape(params: {
  shape: any
  taxonomy: ReturnType<typeof extractTaxonomyFromShape>
  taxon: ReturnType<typeof buildTaxonFromShape>
  isError: boolean
}) {
  const { shape, taxonomy, taxon, isError } = params
  const { species } = taxonomy

  const labelValue = safeLabel(shape?.label)
  const hasMorphospeciesInSpeciesField = !!species && !taxon?.species
  const morphospeciesValue = hasMorphospeciesInSpeciesField ? species : undefined

  if (isError) return undefined
  if (!taxon?.scientificName && labelValue) return labelValue

  return morphospeciesValue
}

function extractIdentifiedAtTimestamp(params: { shape: any; existingDetection?: DetectionEntity }) {
  const { shape, existingDetection } = params

  if (typeof shape?.timestamp_ID_human === 'number') return shape.timestamp_ID_human
  if (typeof shape?.human_identified_at === 'number') return shape.human_identified_at

  return existingDetection?.identifiedAt
}

function safeLabel(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

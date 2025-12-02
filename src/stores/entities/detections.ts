import { atom, computed } from 'nanostores'
import { scheduleSaveUserDetections } from '~/features/folder-processing/files.writer'
import { nightSummariesStore, type NightSummaryEntity } from '~/stores/entities/night-summaries'
import type { TaxonRecord } from '~/features/species-identification/species-list.store'
import { speciesListsStore } from '~/features/species-identification/species-list.store'
import { photosStore, type PhotoEntity } from '~/stores/entities/photos'
import { parseBotDetectionJsonSafely, extractPatchFilename } from '~/features/ingest/ingest-json'
import { projectSpeciesSelectionStore } from '~/stores/species/project-species-list'
import { deriveTaxonName, taxonWithName } from '~/models/taxonomy'
import { buildDetectionFromBotShape } from '~/models/detection-shapes'
import { searchSpecies } from '~/features/species-identification/species-search'
import { toast } from 'sonner'

export type DetectionEntity = {
  id: string
  patchId: string
  photoId: string
  nightId: string
  label?: string
  taxon?: TaxonRecord
  score?: number
  direction?: number
  shapeType?: string
  points?: number[][]
  detectedBy?: 'auto' | 'user'
  identifiedAt?: number
  isError?: boolean
  clusterId?: number
  // Deprecated: derive morphospecies from `morphospecies` presence
  isMorpho?: boolean
  // When user types free text identification, store the morphospecies string
  morphospecies?: string
  speciesListId?: string
  speciesListDOI?: string
  // Original label from bot detection JSON (e.g., "ORDER_Diptera")
  originalMothboxLabel?: string
}

export const detectionsStore = atom<Record<string, DetectionEntity>>({})

export function detectionStoreById(id: string) {
  return computed(detectionsStore, (all) => all?.[id])
}

function identifyDetectionsWithTaxon(params: { detectionIds: string[]; taxon: TaxonRecord; label?: string; isError?: boolean }) {
  const { detectionIds, taxon, label, isError: explicitIsError } = params
  const trimmed = (label ?? '').trim()
  // Check if taxon exists (has taxonRank or any rank fields), not just scientificName
  const hasTaxon = !!taxon && (!!taxon.taxonRank || !!taxon.genus || !!taxon.family || !!taxon.order || !!taxon.species)
  // For species-level, use scientificName; for higher ranks, use the rank value or label
  const finalLabel = hasTaxon
    ? taxon?.taxonRank === 'species'
      ? taxon?.scientificName ?? ''
      : taxon?.genus || taxon?.family || taxon?.order || taxon?.scientificName || trimmed
    : trimmed
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return
  if (!finalLabel && !explicitIsError) return

  const current = detectionsStore.get() || {}
  const selectionByProject = projectSpeciesSelectionStore.get() || {}
  const speciesLists = speciesListsStore.get() || {}
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    // Special-case: explicit ERROR selection (case-insensitive) marks detection as error and clears taxonomy
    const isError = explicitIsError || (!hasTaxon && trimmed.toUpperCase() === 'ERROR')

    // If user provides a custom text (no explicit taxon) and is not ERROR, treat it as a morphospecies (species level)
    // and inherit existing higher taxonomy (order/family/genus) from the detection, when present.
    let nextTaxon: TaxonRecord | undefined = existing?.taxon
    let nextMorphospecies: string | undefined = existing?.morphospecies
    if (hasTaxon) {
      // Merge taxonomy: preserve morphospecies and existing ranks when adding higher ranks
      const existingTaxon = (existing?.taxon ?? {}) as Partial<TaxonRecord>
      const newRank = (taxon?.taxonRank ?? '').toLowerCase()
      const isHigherRank = isRankHigherThanSpecies(newRank)

      // Check if new taxon has genus field set (even if rank is species, might be a genus-level match)
      const hasGenusField = !!taxon?.genus
      const hasFamilyField = !!taxon?.family
      const hasOrderField = !!taxon?.order
      const hasSpeciesField = !!taxon?.species

      // If it's a full species (has both genus and species), it's a replacement, not a merge
      const isFullSpecies = hasGenusField && hasSpeciesField && newRank === 'species'

      // Check if we're changing an existing rank (not just adding a new one)
      // Only check for rank changes if it's not a full species replacement
      const existingRankValue = getExistingRankValue(existingTaxon, newRank)
      const newRankValue = getNewRankValue(taxon, newRank)
      const isRankChanged =
        !isFullSpecies && existingRankValue !== undefined && newRankValue !== undefined && existingRankValue !== newRankValue

      // Debug: log when merging genus with morphospecies
      if (existing?.morphospecies && (isHigherRank || (hasGenusField && !isFullSpecies)) && !isRankChanged) {
        console.log('🌀 identifyDetectionsWithTaxon: merging taxon with morphospecies', {
          detectionId: id,
          existingMorphospecies: existing.morphospecies,
          newTaxon: { taxonRank: taxon?.taxonRank, genus: taxon?.genus, scientificName: taxon?.scientificName },
          isHigherRank,
          hasGenusField,
          isFullSpecies,
        })
      }

      if (isFullSpecies) {
        // Full species replacement: new taxon replaces everything (including morphospecies)
        // Normalize species field to contain only epithet, not full binomial
        nextTaxon = normalizeSpeciesField(taxon)
        nextMorphospecies = undefined
      } else if (isRankChanged) {
        // Changing a rank means we're changing our mind - reset everything below and clear morphospecies
        nextTaxon = mergeTaxonRanks({ existing: existingTaxon, newTaxon: taxon })
        // Normalize species field if rank is species
        if (newRank === 'species') nextTaxon = normalizeSpeciesField(nextTaxon)
        nextMorphospecies = undefined
      } else if (isHigherRank && existing?.morphospecies) {
        // Adding genus/family/order to morphospecies: merge and preserve morphospecies
        nextTaxon = mergeTaxonRanks({ existing: existingTaxon, newTaxon: taxon })
        // Clear species field when adding a genus - morphospecies is stored separately
        // For family/order, preserve morphospecies in species field
        if (newRank === 'genus') {
          nextTaxon.species = undefined
          // If scientificName is empty, set it to the genus name
          if (taxon?.genus && !nextTaxon.scientificName) {
            nextTaxon.scientificName = taxon.genus
          }
        } else {
          // For family/order, preserve morphospecies in species field
          nextTaxon.species = existing.morphospecies
        }
        nextMorphospecies = existing.morphospecies
      } else if (existing?.morphospecies && (hasGenusField || hasFamilyField || hasOrderField) && !isFullSpecies) {
        // If there's an existing morphospecies and the new taxon has higher ranks (but not a full species),
        // merge them and preserve the morphospecies (even if taxonRank is species)
        nextTaxon = mergeTaxonRanks({ existing: existingTaxon, newTaxon: taxon })
        // Preserve morphospecies as the species value
        nextTaxon.species = existing.morphospecies
        // Update taxonRank to reflect the highest rank in the merged taxon
        if (hasGenusField && !isHigherRank) nextTaxon.taxonRank = 'genus'
        else if (hasFamilyField && !isHigherRank) nextTaxon.taxonRank = 'family'
        else if (hasOrderField && !isHigherRank) nextTaxon.taxonRank = 'order'
        nextMorphospecies = existing.morphospecies
      } else if (newRank === 'species' && hasSpeciesField && !hasGenusField && !hasFamilyField && !hasOrderField) {
        // Manual species entry: has species field but missing genus/family/order fields
        // Check if existing detection has genus/family/order to preserve
        const hasExistingGenus = !!existingTaxon?.genus
        const hasExistingFamily = !!existingTaxon?.family
        const hasExistingOrder = !!existingTaxon?.order

        // Parse binomial to extract genus if present in species field
        const parsed = parseBinomialName(taxon.species)
        let taxonToMerge = taxon

        // If species field contains a full binomial, extract genus and epithet
        if (parsed?.genus) {
          taxonToMerge = {
            ...taxon,
            genus: parsed.genus,
            species: parsed.epithet,
            scientificName: taxon.scientificName || `${parsed.genus} ${parsed.epithet}`,
          }
        }

        if (hasExistingGenus || hasExistingFamily || hasExistingOrder) {
          // Merge species with existing taxonomy, preserving order/family/genus
          nextTaxon = mergeTaxonRanks({ existing: existingTaxon, newTaxon: taxonToMerge })
          // Ensure species field is normalized after merge
          nextTaxon = normalizeSpeciesField(nextTaxon)
          nextMorphospecies = undefined
        } else {
          // No existing taxonomy to preserve: normalize and store
          nextTaxon = normalizeSpeciesField(taxonToMerge)
          nextMorphospecies = undefined
        }
      } else {
        // No morphospecies or other cases: full replacement
        // Normalize species field if it's a species rank
        nextTaxon = newRank === 'species' ? normalizeSpeciesField(taxon) : taxon
        nextMorphospecies = undefined
      }
    } else if (!isError && trimmed) {
      const prev: Partial<TaxonRecord> = existing?.taxon ?? {}
      const hasOrderFamilyOrGenus = !!prev?.order || !!prev?.family || !!prev?.genus
      if (!hasOrderFamilyOrGenus) {
        // Do not assign morphospecies when no higher taxonomic context
        // Keep detection unchanged for this id
        continue
      }
      // Preserve existing taxon hierarchy; morphospecies is a temporary unaccepted concept
      // so the scientific/valid taxonomy stays the same
      nextTaxon = buildMorphospeciesTaxon({ existingTaxon: prev })
      nextMorphospecies = trimmed
    } else if (isError) {
      nextTaxon = undefined
      nextMorphospecies = undefined
    }

    const projectId = getProjectIdFromNightId(existing?.nightId)
    const speciesListId = projectId ? selectionByProject?.[projectId] : undefined
    const speciesListDOI = speciesListId ? (speciesLists?.[speciesListId]?.doi as string | undefined) : undefined

    // Compute name field for taxon if present
    const taxonWithNameField = nextTaxon
      ? taxonWithName({
          taxon: nextTaxon,
          detection: { ...existing, taxon: nextTaxon, morphospecies: nextMorphospecies },
        })
      : undefined

    const next: DetectionEntity = {
      ...existing,
      label: isError ? 'ERROR' : finalLabel,
      detectedBy: 'user',
      identifiedAt,
      taxon: taxonWithNameField,
      isError,
      // legacy flag no longer used; left undefined
      isMorpho: undefined,
      morphospecies: nextMorphospecies,
      speciesListId: speciesListId || existing?.speciesListId,
      speciesListDOI: speciesListDOI || existing?.speciesListDOI,
    }
    updated[id] = next
  }
  detectionsStore.set(updated)
  updateNightSummariesAndScheduleSave({ detectionIds, detections: updated })
}

export function labelDetections(params: { detectionIds: string[]; label?: string; taxon?: TaxonRecord }) {
  const { detectionIds, taxon, label } = params
  const trimmed = (label ?? '').trim()
  // Check if taxon exists (has taxonRank or any rank fields), not just scientificName
  const hasTaxon = !!taxon && (!!taxon.taxonRank || !!taxon.genus || !!taxon.family || !!taxon.order || !!taxon.species)
  // For species-level, use scientificName; for higher ranks, use the rank value or label
  const finalLabel = hasTaxon
    ? taxon?.taxonRank === 'species'
      ? taxon?.scientificName ?? ''
      : taxon?.genus || taxon?.family || taxon?.order || taxon?.scientificName || trimmed
    : trimmed
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return
  if (!finalLabel && trimmed.toUpperCase() !== 'ERROR') return

  const isError = !hasTaxon && trimmed.toUpperCase() === 'ERROR'

  if (hasTaxon) {
    identifyDetectionsWithTaxon({ detectionIds, taxon, label: finalLabel })
  } else if (isError) {
    identifyDetectionsWithTaxon({ detectionIds, taxon: {} as TaxonRecord, label: 'ERROR', isError: true })
  } else if (trimmed) {
    // Morphospecies case - need to handle separately as it doesn't have a taxon
    const current = detectionsStore.get() || {}
    const selectionByProject = projectSpeciesSelectionStore.get() || {}
    const speciesLists = speciesListsStore.get() || {}
    const updated: Record<string, DetectionEntity> = { ...current }
    for (const id of detectionIds) {
      const existing = current?.[id]
      if (!existing) continue
      const identifiedAt = Date.now()
      const prev: Partial<TaxonRecord> = existing?.taxon ?? {}
      const hasOrderFamilyOrGenus = !!prev?.order || !!prev?.family || !!prev?.genus
      if (!hasOrderFamilyOrGenus) {
        // Do not assign morphospecies when no higher taxonomic context
        // Keep detection unchanged for this id
        continue
      }
      // Preserve existing taxon hierarchy; morphospecies is a temporary unaccepted concept
      // so the scientific/valid taxonomy stays the same
      const nextTaxon = buildMorphospeciesTaxon({ existingTaxon: prev })
      const projectId = getProjectIdFromNightId(existing?.nightId)
      const speciesListId = projectId ? selectionByProject?.[projectId] : undefined
      const speciesListDOI = speciesListId ? (speciesLists?.[speciesListId]?.doi as string | undefined) : undefined
      const taxonWithNameField = taxonWithName({
        taxon: nextTaxon as TaxonRecord,
        detection: { ...existing, taxon: nextTaxon as TaxonRecord, morphospecies: trimmed },
      }) as TaxonRecord | undefined
      const next: DetectionEntity = {
        ...existing,
        label: trimmed,
        detectedBy: 'user',
        identifiedAt,
        taxon: taxonWithNameField,
        isError: false,
        isMorpho: undefined,
        morphospecies: trimmed,
        speciesListId: speciesListId || existing?.speciesListId,
        speciesListDOI: speciesListDOI || existing?.speciesListDOI,
      }
      updated[id] = next
    }
    detectionsStore.set(updated)
    updateNightSummariesAndScheduleSave({ detectionIds, detections: updated })
  }
}

export function acceptDetections(params: { detectionIds: string[] }) {
  const { detectionIds } = params
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return

  const current = detectionsStore.get() || {}
  const selectionByProject = projectSpeciesSelectionStore.get() || {}
  const errors: Array<{ detectionId: string; message: string }> = []

  // Group detections by (speciesListId, order) to batch process and avoid duplicate searches
  const detectionsByOrder = new Map<string, { ids: string[]; order: string; speciesListId: string }>()

  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue

    const order = existing?.taxon?.order
    if (!order) {
      errors.push({ detectionId: id, message: 'Cannot accept: detection missing order' })
      continue
    }

    const projectId = getProjectIdFromNightId(existing?.nightId)
    const speciesListId = projectId ? selectionByProject?.[projectId] : undefined

    if (!speciesListId) {
      errors.push({ detectionId: id, message: `Cannot accept: no species list selected for project` })
      continue
    }

    const key = `${speciesListId}:${order}`
    const group = detectionsByOrder.get(key)
    if (group) {
      group.ids.push(id)
    } else {
      detectionsByOrder.set(key, { ids: [id], order, speciesListId })
    }
  }

  // Show errors for failed detections
  for (const error of errors) {
    toast.error(error.message)
  }

  // Process each group: search once per order and apply to all detections with that order
  for (const { ids, order, speciesListId } of detectionsByOrder.values()) {
    const searchResults = searchSpecies({ speciesListId, query: order, limit: 1 })
    if (!searchResults || searchResults.length === 0) {
      for (const id of ids) {
        toast.error(`Cannot accept: order '${order}' not found in species list`)
      }
      continue
    }

    const orderTaxon = searchResults[0]
    if (!orderTaxon) {
      for (const id of ids) {
        toast.error(`Cannot accept: order '${order}' not found in species list`)
      }
      continue
    }

    // Use shared identification function to update all detections with this order
    identifyDetectionsWithTaxon({ detectionIds: ids, taxon: orderTaxon })
  }
}

export async function resetDetections(params: { detectionIds: string[] }) {
  const { detectionIds } = params
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return

  const current = detectionsStore.get() || {}
  const photos = photosStore.get() || {}

  // Group by photo to avoid redundant JSON parsing
  const idsByPhoto: Record<string, string[]> = {}
  for (const id of detectionIds) {
    const existing = current?.[id]
    const photoId = (existing as any)?.photoId as string | undefined
    if (!existing || !photoId) continue
    if (!idsByPhoto[photoId]) idsByPhoto[photoId] = []
    idsByPhoto[photoId].push(id)
  }

  const updated: Record<string, DetectionEntity> = { ...current }

  for (const [photoId, ids] of Object.entries(idsByPhoto)) {
    const photo = photos?.[photoId] as PhotoEntity | undefined
    const jsonFile = (photo as any)?.botDetectionFile
    let shapes: Array<any> = []
    if (jsonFile) {
      try {
        const parsed = await parseBotDetectionJsonSafely({ file: jsonFile as any })
        shapes = Array.isArray(parsed?.shapes) ? parsed!.shapes : []
      } catch {
        shapes = []
      }
    }

    for (const id of ids) {
      const existing = current?.[id]
      if (!existing) continue

      // Find matching bot shape by patch filename
      const match = shapes.find((s: any) => extractPatchFilename({ patchPath: (s as any)?.patch_path ?? '' }) === id)

      if (match) {
        const next = buildDetectionFromBotShape({ shape: match, existingDetection: existing })
        updated[id] = next
      } else {
        // Fallback: clear human flags and mark as auto without changing core fields
        const next: DetectionEntity = {
          ...existing,
          detectedBy: 'auto',
          identifiedAt: undefined,
          isError: undefined,
          isMorpho: undefined,
          morphospecies: undefined,
          speciesListId: undefined,
          speciesListDOI: undefined,
        }
        updated[id] = next
      }
    }
  }

  detectionsStore.set(updated)
  updateNightSummariesAndScheduleSave({ detectionIds, detections: updated })
}

function safeLabel(value: unknown) {
  const res = typeof value === 'string' ? value : undefined
  return res
}

function safeNumber(value: unknown) {
  const res = typeof value === 'number' ? value : undefined
  return res
}

function deriveTaxonFromShape(shape: any) {
  const kingdom = safeLabel(shape?.kingdom)
  const phylum = safeLabel(shape?.phylum)
  const klass = safeLabel(shape?.class)
  const order = safeLabel(shape?.order)
  const family = safeLabel(shape?.family)
  const genus = safeLabel(shape?.genus)
  const species = safeLabel(shape?.species)

  let scientificName: string | undefined
  let taxonRank: string | undefined
  if (species) {
    scientificName = species
    taxonRank = 'species'
  } else if (genus) {
    scientificName = genus
    taxonRank = 'genus'
  } else if (family) {
    scientificName = family
    taxonRank = 'family'
  } else if (order) {
    scientificName = order
    taxonRank = 'order'
  } else if (klass) {
    scientificName = klass
    taxonRank = 'class'
  } else if (phylum) {
    scientificName = phylum
    taxonRank = 'phylum'
  } else if (kingdom) {
    scientificName = kingdom
    taxonRank = 'kingdom'
  } else {
    scientificName = undefined
    taxonRank = undefined
  }

  if (!scientificName && !kingdom && !phylum && !klass && !order && !family && !genus && !species) return undefined as any

  const taxon = {
    scientificName: scientificName || '',
    taxonRank,
    kingdom,
    phylum,
    class: klass,
    order,
    family,
    genus,
    species,
  } as any
  return taxon
}

function buildMorphospeciesTaxon(params: { existingTaxon: Partial<TaxonRecord> }): TaxonRecord {
  const { existingTaxon } = params
  return {
    ...existingTaxon,
    scientificName: existingTaxon?.scientificName ?? '',
  } as TaxonRecord
}

function collectTouchedNightIds(params: { detectionIds: string[]; detections: Record<string, DetectionEntity> }): Set<string> {
  const { detectionIds, detections } = params
  const touchedNightIds = new Set<string>()
  for (const id of detectionIds) {
    const n = detections?.[id]?.nightId
    if (n) touchedNightIds.add(n)
  }
  return touchedNightIds
}

function updateNightSummariesAndScheduleSave(params: { detectionIds: string[]; detections: Record<string, DetectionEntity> }) {
  const { detectionIds, detections } = params
  const touchedNightIds = collectTouchedNightIds({ detectionIds, detections })
  updateNightSummariesInMemory({ nightIds: touchedNightIds, detections })
  for (const nightId of touchedNightIds) scheduleSaveUserDetections({ nightId })
}

function updateNightSummariesInMemory(params: { nightIds: Set<string>; detections: Record<string, DetectionEntity> }) {
  const { nightIds, detections } = params

  if (!nightIds || nightIds.size === 0) return

  for (const nightId of nightIds) {
    if (!nightId) continue

    const detectionsForNight = Object.values(detections || {}).filter((d) => (d as any)?.nightId === nightId)

    const totalDetections = detectionsForNight.length
    const totalIdentified = detectionsForNight.filter((d) => (d as any)?.detectedBy === 'user').length

    const morphoCounts: Record<string, number> = {}
    const morphoPreviewPatchIds: Record<string, string> = {}

    for (const d of detectionsForNight) {
      const isUser = (d as any)?.detectedBy === 'user'
      const morpho = typeof (d as any)?.morphospecies === 'string' ? ((d as any)?.morphospecies as string) : ''
      const key = isUser && morpho ? (morpho || '').trim().toLowerCase() : ''
      if (!key) continue
      morphoCounts[key] = (morphoCounts[key] || 0) + 1
      if (!morphoPreviewPatchIds[key] && (d as any)?.patchId) morphoPreviewPatchIds[key] = String((d as any)?.patchId)
    }

    const summary: NightSummaryEntity = {
      nightId,
      totalDetections,
      totalIdentified,
      updatedAt: Date.now(),
      morphoCounts,
      morphoPreviewPatchIds,
    }

    const currentSummaries = nightSummariesStore.get() || {}
    nightSummariesStore.set({ ...currentSummaries, [nightId]: summary })
  }
}

function getProjectIdFromNightId(nightId?: string | null): string | undefined {
  const id = (nightId ?? '').trim()
  if (!id) return undefined

  const parts = id.split('/').filter(Boolean)
  if (!parts.length) return undefined

  const projectId = parts[0]
  return projectId
}

function isRankHigherThanSpecies(rank: string): boolean {
  const lower = rank.toLowerCase()
  return (
    lower === 'kingdom' ||
    lower === 'phylum' ||
    lower === 'class' ||
    lower === 'order' ||
    lower === 'suborder' ||
    lower === 'family' ||
    lower === 'subfamily' ||
    lower === 'tribe' ||
    lower === 'genus'
  )
}

/**
 * Parses a binomial species name to extract genus and species epithet.
 * Handles cases where the input might be:
 * - Full binomial: "Anastrepha pallens" -> { genus: "Anastrepha", epithet: "pallens" }
 * - Just epithet: "pallens" -> { genus: undefined, epithet: "pallens" }
 * - Invalid format: returns undefined
 */
function parseBinomialName(
  binomial: string | undefined,
): { genus: string; epithet: string } | { genus: undefined; epithet: string } | undefined {
  if (!binomial) return undefined
  const trimmed = binomial.trim()
  if (!trimmed) return undefined

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    // Just epithet (or single word)
    return { genus: undefined, epithet: parts[0] }
  }
  if (parts.length >= 2) {
    // Full binomial: first word is genus, second is epithet
    return { genus: parts[0], epithet: parts[1] }
  }

  return undefined
}

/**
 * Normalizes a TaxonRecord to ensure species field contains only the epithet, not the full binomial.
 * If species field contains a full binomial (e.g., "Anastrepha pallens"), extracts the epithet ("pallens")
 * and sets the genus field if not already present.
 */
function normalizeSpeciesField(taxon: TaxonRecord): TaxonRecord {
  if (!taxon?.species || taxon.taxonRank !== 'species') return taxon

  const parsed = parseBinomialName(taxon.species)
  if (!parsed) return taxon

  // If species field contains a full binomial and we extracted genus
  if (parsed.genus) {
    // Only update if genus field is missing or matches the parsed genus
    const shouldUpdateGenus = !taxon.genus || taxon.genus === parsed.genus
    const shouldUpdateSpecies = taxon.species !== parsed.epithet

    if (shouldUpdateGenus || shouldUpdateSpecies) {
      return {
        ...taxon,
        genus: shouldUpdateGenus ? parsed.genus : taxon.genus,
        species: parsed.epithet,
        // Ensure scientificName is the full binomial
        scientificName: taxon.scientificName || `${parsed.genus} ${parsed.epithet}`,
      }
    }
  }

  // If species field already contains just the epithet, check if it matches the genus+species pattern
  // If genus exists and species doesn't match it, keep as-is (already normalized)
  if (taxon.genus && taxon.species === parsed.epithet) {
    return taxon
  }

  return taxon
}

function getRankHierarchy(): string[] {
  return ['kingdom', 'phylum', 'class', 'order', 'suborder', 'family', 'subfamily', 'tribe', 'genus', 'species']
}

function getRankIndex(rank: string): number {
  const hierarchy = getRankHierarchy()
  const lower = rank.toLowerCase()
  const index = hierarchy.indexOf(lower)
  return index >= 0 ? index : hierarchy.length
}

function getExistingRankValue(existing: Partial<TaxonRecord>, rank: string): string | undefined {
  const lower = rank.toLowerCase()
  if (lower === 'kingdom') return existing?.kingdom
  if (lower === 'phylum') return existing?.phylum
  if (lower === 'class') return existing?.class
  if (lower === 'order' || lower === 'suborder') return existing?.order
  if (lower === 'family' || lower === 'subfamily') return existing?.family
  if (lower === 'tribe') return existing?.genus
  if (lower === 'genus') return existing?.genus
  if (lower === 'species') return existing?.species
  return undefined
}

function getNewRankValue(newTaxon: TaxonRecord, rank: string): string | undefined {
  const lower = rank.toLowerCase()
  if (lower === 'kingdom') return newTaxon?.kingdom
  if (lower === 'phylum') return newTaxon?.phylum
  if (lower === 'class') return newTaxon?.class
  if (lower === 'order' || lower === 'suborder') return newTaxon?.order
  if (lower === 'family' || lower === 'subfamily') return newTaxon?.family
  if (lower === 'tribe') return newTaxon?.genus
  if (lower === 'genus') return newTaxon?.genus
  if (lower === 'species') return newTaxon?.species
  return undefined
}

type MergeTaxonRanksParams = {
  existing: Partial<TaxonRecord>
  newTaxon: TaxonRecord
}

function mergeTaxonRanks(params: MergeTaxonRanksParams): TaxonRecord {
  const { existing, newTaxon } = params
  const newRank = (newTaxon?.taxonRank ?? '').toLowerCase()
  const existingSpecies = existing?.species

  // Check if we're changing an existing rank (not just adding a new one)
  const existingRankValue = getExistingRankValue(existing, newRank)
  const newRankValue = getNewRankValue(newTaxon, newRank)
  const isRankChanged = existingRankValue !== undefined && newRankValue !== undefined && existingRankValue !== newRankValue

  // Only reset lower ranks if we're changing an existing rank value
  // Don't reset when adding a higher rank that didn't exist before
  const shouldResetLowerRanks = isRankChanged

  // Start with existing taxon, then merge in new taxon fields
  const merged: Partial<TaxonRecord> = {
    ...existing,
  }

  // Update fields based on the rank being added
  if (newRank === 'kingdom' && newTaxon?.kingdom) {
    merged.kingdom = newTaxon.kingdom
    if (shouldResetLowerRanks) {
      merged.phylum = newTaxon.phylum
      merged.class = newTaxon.class
      merged.order = newTaxon.order
      merged.family = newTaxon.family
      merged.genus = newTaxon.genus
      merged.species = newTaxon.species
    } else {
      merged.phylum = newTaxon.phylum ?? existing?.phylum
      merged.class = newTaxon.class ?? existing?.class
      merged.order = newTaxon.order ?? existing?.order
      merged.family = newTaxon.family ?? existing?.family
      merged.genus = newTaxon.genus ?? existing?.genus
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = 'kingdom'
  } else if (newRank === 'phylum' && newTaxon?.phylum) {
    merged.phylum = newTaxon.phylum
    if (shouldResetLowerRanks) {
      merged.class = newTaxon.class
      merged.order = newTaxon.order
      merged.family = newTaxon.family
      merged.genus = newTaxon.genus
      merged.species = newTaxon.species
    } else {
      merged.class = newTaxon.class ?? existing?.class
      merged.order = newTaxon.order ?? existing?.order
      merged.family = newTaxon.family ?? existing?.family
      merged.genus = newTaxon.genus ?? existing?.genus
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = 'phylum'
  } else if (newRank === 'class' && newTaxon?.class) {
    merged.class = newTaxon.class
    if (shouldResetLowerRanks) {
      merged.order = newTaxon.order
      merged.family = newTaxon.family
      merged.genus = newTaxon.genus
      merged.species = newTaxon.species
    } else {
      merged.order = newTaxon.order ?? existing?.order
      merged.family = newTaxon.family ?? existing?.family
      merged.genus = newTaxon.genus ?? existing?.genus
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = 'class'
  } else if (newRank === 'order' || newRank === 'suborder') {
    merged.order = newTaxon.order ?? existing?.order
    if (shouldResetLowerRanks) {
      merged.family = newTaxon.family
      merged.genus = newTaxon.genus
      merged.species = newTaxon.species
    } else {
      merged.family = newTaxon.family ?? existing?.family
      merged.genus = newTaxon.genus ?? existing?.genus
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = newRank
  } else if (newRank === 'family' || newRank === 'subfamily') {
    merged.family = newTaxon.family ?? existing?.family
    if (shouldResetLowerRanks) {
      merged.genus = newTaxon.genus
      merged.species = newTaxon.species
    } else {
      merged.genus = newTaxon.genus ?? existing?.genus
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = newRank
  } else if (newRank === 'tribe') {
    merged.genus = newTaxon.genus ?? existing?.genus
    if (shouldResetLowerRanks) {
      merged.species = newTaxon.species
    } else {
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = 'tribe'
  } else if (newRank === 'genus') {
    merged.order = newTaxon.order ?? existing?.order
    merged.family = newTaxon.family ?? existing?.family
    merged.genus = newTaxon.genus ?? existing?.genus
    if (shouldResetLowerRanks) {
      merged.species = newTaxon.species
    } else {
      merged.species = existingSpecies ?? newTaxon.species
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = 'genus'
  } else if (newRank === 'species') {
    // Preserve existing order/family/genus when adding species
    merged.order = newTaxon.order ?? existing?.order
    merged.family = newTaxon.family ?? existing?.family
    merged.genus = newTaxon.genus ?? existing?.genus
    if (shouldResetLowerRanks) {
      merged.species = newTaxon.species
    } else {
      merged.species = newTaxon.species ?? existingSpecies
    }
    merged.scientificName = newTaxon.scientificName
    merged.taxonRank = 'species'
  }

  // Preserve existing higher ranks if not being replaced
  // But skip preservation for ranks that were explicitly reset (shouldResetLowerRanks)
  if (!merged.kingdom && existing?.kingdom) merged.kingdom = existing.kingdom
  if (!merged.phylum && existing?.phylum) merged.phylum = existing.phylum
  if (!merged.class && existing?.class) merged.class = existing.class
  if (!merged.order && existing?.order) merged.order = existing.order

  // Only preserve lower ranks if we didn't reset them
  if (!shouldResetLowerRanks) {
    if (!merged.family && existing?.family) merged.family = existing.family
    if (!merged.genus && existing?.genus) merged.genus = existing.genus
    if (!merged.species && existing?.species) merged.species = existing.species
  }

  // Preserve metadata fields: prefer newTaxon values, fallback to existing
  if (newTaxon?.taxonID) merged.taxonID = newTaxon.taxonID
  else if (existing?.taxonID && !merged.taxonID) merged.taxonID = existing.taxonID

  if (newTaxon?.acceptedTaxonKey) merged.acceptedTaxonKey = newTaxon.acceptedTaxonKey
  else if (existing?.acceptedTaxonKey && !merged.acceptedTaxonKey) merged.acceptedTaxonKey = existing.acceptedTaxonKey

  if (newTaxon?.acceptedScientificName) merged.acceptedScientificName = newTaxon.acceptedScientificName
  else if (existing?.acceptedScientificName && !merged.acceptedScientificName)
    merged.acceptedScientificName = existing.acceptedScientificName

  if (newTaxon?.vernacularName) merged.vernacularName = newTaxon.vernacularName
  else if (existing?.vernacularName && !merged.vernacularName) merged.vernacularName = existing.vernacularName

  return merged as TaxonRecord
}

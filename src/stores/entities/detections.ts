import { atom, computed } from 'nanostores'
import { scheduleSaveUserDetections } from '~/features/folder-processing/files.writer'
import { nightSummariesStore, type NightSummaryEntity } from '~/stores/entities/night-summaries'
import type { TaxonRecord } from '~/features/species-identification/species-list.store'
import { speciesListsStore } from '~/features/species-identification/species-list.store'
import { photosStore, type PhotoEntity } from '~/stores/entities/photos'
import { parseBotDetectionJsonSafely, extractPatchFilename } from '~/features/ingest/ingest-json'
import { projectSpeciesSelectionStore } from '~/stores/species/project-species-list'

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
}

export const detectionsStore = atom<Record<string, DetectionEntity>>({})

export function detectionStoreById(id: string) {
  return computed(detectionsStore, (all) => all?.[id])
}

export function labelDetections(params: { detectionIds: string[]; label?: string; taxon?: TaxonRecord }) {
  const { detectionIds, taxon } = params
  const trimmed = (params?.label ?? '').trim()
  const hasTaxon = !!taxon?.scientificName
  const finalLabel = hasTaxon ? taxon?.scientificName ?? '' : trimmed
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return
  if (!finalLabel) return

  const current = detectionsStore.get() || {}
  const selectionByProject = projectSpeciesSelectionStore.get() || {}
  const speciesLists = speciesListsStore.get() || {}
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    // Special-case: explicit ERROR selection (case-insensitive) marks detection as error and clears taxonomy
    const isError = !hasTaxon && trimmed.toUpperCase() === 'ERROR'

    // If user provides a custom text (no explicit taxon) and is not ERROR, treat it as a morphospecies (species level)
    // and inherit existing higher taxonomy (order/family/genus) from the detection, when present.
    let nextTaxon: TaxonRecord | undefined = existing?.taxon
    let nextMorphospecies: string | undefined = existing?.morphospecies
    if (hasTaxon) {
      nextTaxon = taxon
      nextMorphospecies = undefined
    } else if (!isError && trimmed) {
      const prev: Partial<TaxonRecord> = existing?.taxon ?? {}
      const hasOrderFamilyOrGenus = !!prev?.order || !!prev?.family || !!prev?.genus
      if (!hasOrderFamilyOrGenus) {
        // Do not assign morphospecies when no higher taxonomic context
        // Keep detection unchanged for this id
        continue
      }
      nextTaxon = {
        scientificName: trimmed,
        taxonRank: 'species',
        kingdom: prev?.kingdom,
        phylum: prev?.phylum,
        class: prev?.class,
        order: prev?.order,
        family: prev?.family,
        genus: prev?.genus,
        species: trimmed,
      }
      nextMorphospecies = trimmed
    } else if (isError) {
      nextTaxon = undefined
      nextMorphospecies = undefined
    }

    const projectId = getProjectIdFromNightId(existing?.nightId)
    const speciesListId = projectId ? selectionByProject?.[projectId] : undefined
    const speciesListDOI = speciesListId ? (speciesLists?.[speciesListId]?.doi as string | undefined) : undefined

    const next: DetectionEntity = {
      ...existing,
      label: isError ? 'ERROR' : finalLabel,
      detectedBy: 'user',
      identifiedAt,
      taxon: nextTaxon,
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
  // Schedule save per night for touched detections
  const touchedNightIds = new Set<string>()
  for (const id of detectionIds) {
    const n = updated?.[id]?.nightId
    if (n) touchedNightIds.add(n)
  }
  // Update summaries in-memory immediately for instant UI feedback
  updateNightSummariesInMemory({ nightIds: touchedNightIds, detections: updated })
  for (const nightId of touchedNightIds) scheduleSaveUserDetections({ nightId })
}

export function acceptDetections(params: { detectionIds: string[] }) {
  const { detectionIds } = params
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return

  const current = detectionsStore.get() || {}
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    // TODO: Accept may be deprecated; kept for discussion. Currently it only marks as user without changing label/taxon.
    updated[id] = { ...existing, detectedBy: 'user', identifiedAt }
  }
  detectionsStore.set(updated)
  // Update summaries in-memory immediately for instant UI feedback
  const touchedNightIds = new Set<string>()
  for (const id of detectionIds) {
    const n = updated?.[id]?.nightId
    if (n) touchedNightIds.add(n)
  }
  updateNightSummariesInMemory({ nightIds: touchedNightIds, detections: updated })
  for (const nightId of touchedNightIds) scheduleSaveUserDetections({ nightId })
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
  const touchedNightIds = new Set<string>()

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
      const nightId = (existing as any)?.nightId as string | undefined
      if (nightId) touchedNightIds.add(nightId)

      // Find matching bot shape by patch filename
      const match = shapes.find((s: any) => extractPatchFilename({ patchPath: (s as any)?.patch_path ?? '' }) === id)

      if (match) {
        const taxon = deriveTaxonFromShape(match)
        const next: DetectionEntity = {
          ...existing,
          label: taxon?.scientificName || safeLabel((match as any)?.label),
          taxon: taxon as any,
          score: safeNumber((match as any)?.score),
          direction: safeNumber((match as any)?.direction),
          shapeType: safeLabel((match as any)?.shape_type),
          points: Array.isArray((match as any)?.points) ? ((match as any)?.points as any) : (existing as any)?.points,
          clusterId: safeNumber((match as any)?.clusterID) as any,
          detectedBy: 'auto',
          identifiedAt: undefined,
          isError: undefined,
          isMorpho: undefined,
          speciesListId: undefined,
          speciesListDOI: undefined,
        }
        updated[id] = next
      } else {
        // Fallback: clear human flags and mark as auto without changing core fields
        const next: DetectionEntity = {
          ...existing,
          detectedBy: 'auto',
          identifiedAt: undefined,
          isError: undefined,
          isMorpho: undefined,
          speciesListId: undefined,
          speciesListDOI: undefined,
        }
        updated[id] = next
      }
    }
  }

  detectionsStore.set(updated)
  // Update summaries in-memory immediately for instant UI feedback
  updateNightSummariesInMemory({ nightIds: touchedNightIds, detections: updated })
  for (const nightId of touchedNightIds) scheduleSaveUserDetections({ nightId })
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

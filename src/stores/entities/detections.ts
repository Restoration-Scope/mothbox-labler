import { atom, computed } from 'nanostores'
import { scheduleSaveUserDetections } from '~/features/folder-processing/files.writer'
import type { TaxonRecord } from '~/stores/species-lists'

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
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    // NOTE: When a user creates their own free-text label (no taxon), we only set a species-level text for now.
    // Future: allow structuring user-provided taxonomy across ranks.
    const next: DetectionEntity = { ...existing, label: finalLabel, detectedBy: 'user', identifiedAt }
    if (hasTaxon) next.taxon = taxon
    updated[id] = next
  }
  detectionsStore.set(updated)
  // Schedule save per night for touched detections
  const touchedNightIds = new Set<string>()
  for (const id of detectionIds) {
    const n = updated?.[id]?.nightId
    if (n) touchedNightIds.add(n)
  }
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
  const touchedNightIds = new Set<string>()
  for (const id of detectionIds) {
    const n = updated?.[id]?.nightId
    if (n) touchedNightIds.add(n)
  }
  for (const nightId of touchedNightIds) scheduleSaveUserDetections({ nightId })
}

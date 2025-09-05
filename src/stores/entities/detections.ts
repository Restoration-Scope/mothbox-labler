import { atom, computed } from 'nanostores'

export type DetectionEntity = {
  id: string
  patchId: string
  photoId: string
  nightId: string
  label?: string
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

export function labelDetections(params: { detectionIds: string[]; label: string }) {
  const { detectionIds, label } = params
  const trimmed = (label ?? '').trim()
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return
  if (!trimmed) return

  const current = detectionsStore.get() || {}
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    updated[id] = { ...existing, label: trimmed, detectedBy: 'user', identifiedAt }
  }
  detectionsStore.set(updated)
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
    updated[id] = { ...existing, detectedBy: 'user', identifiedAt }
  }
  detectionsStore.set(updated)
}



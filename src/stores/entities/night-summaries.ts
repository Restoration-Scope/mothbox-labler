import { atom } from 'nanostores'
import type { DetectionEntity } from './detections'
import { normalizeMorphoKey } from '~/models/taxonomy/morphospecies'

export type NightSummaryEntity = {
  nightId: string
  totalDetections: number
  totalIdentified: number
  updatedAt?: number
  // Aggregated morphospecies counts by normalized key (lowercased, trimmed)
  morphoCounts?: Record<string, number>
  // Optional preview patch ids per morpho key for quick image lookup
  morphoPreviewPatchIds?: Record<string, string>
}

export const nightSummariesStore = atom<Record<string, NightSummaryEntity>>({})

/**
 * Builds a night summary from detections for a specific night.
 * Single source of truth for night summary calculation.
 */
export function buildNightSummary(params: { nightId: string; detections: DetectionEntity[] }): NightSummaryEntity {
  const { nightId, detections } = params

  const totalDetections = detections.length
  const totalIdentified = detections.filter((d) => d?.detectedBy === 'user').length

  const morphoCounts: Record<string, number> = {}
  const morphoPreviewPatchIds: Record<string, string> = {}

  for (const d of detections) {
    const isUser = d?.detectedBy === 'user'
    const morpho = typeof d?.morphospecies === 'string' ? d.morphospecies : ''
    const key = isUser && morpho ? normalizeMorphoKey(morpho) : ''
    if (!key) continue
    morphoCounts[key] = (morphoCounts[key] || 0) + 1
    if (!morphoPreviewPatchIds[key] && d?.patchId) morphoPreviewPatchIds[key] = String(d.patchId)
  }

  return {
    nightId,
    totalDetections,
    totalIdentified,
    updatedAt: Date.now(),
    morphoCounts,
    morphoPreviewPatchIds,
  }
}

import { atom } from 'nanostores'

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

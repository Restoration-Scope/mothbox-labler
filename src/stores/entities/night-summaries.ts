import { atom } from 'nanostores'

export type NightSummaryEntity = {
  nightId: string
  totalDetections: number
  totalIdentified: number
  updatedAt?: number
}

export const nightSummariesStore = atom<Record<string, NightSummaryEntity>>({})

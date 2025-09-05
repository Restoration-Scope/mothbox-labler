import { atom } from 'nanostores'

export type NightEntity = {
  id: string
  name: string
  projectId: string
  siteId: string
  deploymentId: string
}

export const nightsStore = atom<Record<string, NightEntity>>({})

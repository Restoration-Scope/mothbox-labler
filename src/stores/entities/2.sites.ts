import { atom } from 'nanostores'

export type SiteEntity = {
  id: string
  name: string
  projectId: string
}

export const sitesStore = atom<Record<string, SiteEntity>>({})

import { atom } from 'nanostores'

export type ProjectEntity = {
  id: string
  name: string
}

export const projectsStore = atom<Record<string, ProjectEntity>>({})

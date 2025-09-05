import { atom } from 'nanostores'

export type DeploymentEntity = {
  id: string
  name: string
  projectId: string
  siteId: string
}

export const deploymentsStore = atom<Record<string, DeploymentEntity>>({})

import { atom } from 'nanostores'

export type IndexedFile = {
  file?: File
  handle?: unknown
  path: string
  name: string
  size: number
}
export type PhotoEntity = {
  id: string
  name: string
  nightId: string
  imageFile?: IndexedFile
  botDetectionFile?: IndexedFile
  userDetectionFile?: IndexedFile
}

export const photosStore = atom<Record<string, PhotoEntity>>({})

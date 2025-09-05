import { atom } from 'nanostores'

export type IndexedFile = {
  file: File
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
}

export const photosStore = atom<Record<string, PhotoEntity>>({})

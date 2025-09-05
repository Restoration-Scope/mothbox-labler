import { atom } from 'nanostores'
import { IndexedFile } from './photos'

export type PatchEntity = {
  id: string
  name: string
  nightId: string
  photoId: string
  imageFile?: IndexedFile
}

export const patchesStore = atom<Record<string, PatchEntity>>({})

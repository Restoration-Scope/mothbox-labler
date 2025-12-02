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

export function clearFileObjectsForNight(params: { nightId: string }) {
  const { nightId } = params
  const current = patchesStore.get() || {}
  const updated: Record<string, PatchEntity> = {}

  for (const [id, patch] of Object.entries(current)) {
    if (patch.nightId === nightId) {
      updated[id] = {
        ...patch,
        imageFile: patch.imageFile ? { ...patch.imageFile, file: undefined } : undefined,
      }
    } else {
      updated[id] = patch
    }
  }

  patchesStore.set(updated)
}

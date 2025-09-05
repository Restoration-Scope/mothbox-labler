import { computed } from 'nanostores'
import { patchesStore } from './5.patches'

export function patchStoreById(id: string) {
  return computed(patchesStore, (all) => all?.[id])
}

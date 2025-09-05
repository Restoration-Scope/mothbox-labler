import { atom } from 'nanostores'
import { patchesStore } from './entities'

export const pickerErrorStore = atom<string | null>(null)

export const selectedPatchIdsStore = atom<Set<string>>(new Set())
export const selectionNightIdStore = atom<string | null>(null)

export function togglePatchSelection(params: { patchId: string }) {
  const { patchId } = params
  if (!patchId) return
  const patch = patchesStore.get()?.[patchId]
  const patchNightId = patch?.nightId ?? null
  if (!patchNightId) return

  const currentSelected = new Set(selectedPatchIdsStore.get() ?? new Set())
  const currentNightId = selectionNightIdStore.get()

  if (currentNightId && currentNightId !== patchNightId) {
    selectedPatchIdsStore.set(new Set([patchId]))
    selectionNightIdStore.set(patchNightId)
    return
  }

  if (currentSelected.has(patchId)) {
    currentSelected.delete(patchId)
    selectedPatchIdsStore.set(currentSelected)
    if (currentSelected.size === 0) selectionNightIdStore.set(null)
    return
  }

  currentSelected.add(patchId)
  selectedPatchIdsStore.set(currentSelected)
  if (!currentNightId) selectionNightIdStore.set(patchNightId)
}

export function clearPatchSelection() {
  selectedPatchIdsStore.set(new Set())
  selectionNightIdStore.set(null)
}

export function setSelection(params: { nightId: string; patchIds: string[] }) {
  const { nightId, patchIds } = params
  if (!nightId) return
  const next = new Set<string>()
  for (const id of patchIds ?? []) if (id) next.add(id)
  selectedPatchIdsStore.set(next)
  selectionNightIdStore.set(next.size > 0 ? nightId : null)
}

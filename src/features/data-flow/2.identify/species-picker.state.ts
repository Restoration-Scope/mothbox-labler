import { atom } from 'nanostores'
import { speciesListsStore } from '~/features/data-flow/2.identify/species-list.store'
import { projectSpeciesSelectionStore } from '~/stores/species/project-species-list'

export const $isSpeciesPickerOpen = atom<boolean>(false)
export const $speciesPickerProjectId = atom<string | undefined>(undefined)

export function ensureSpeciesListSelection(params: { projectId?: string; onReady: () => void }) {
  const { projectId, onReady } = params

  if (!projectId) {
    const proceed = onReady
    proceed()
    return
  }

  const selectionByProject = projectSpeciesSelectionStore.get() || {}
  const hasSelection = !!selectionByProject?.[projectId]
  const anySpeciesLists = Object.keys(speciesListsStore.get() || {}).length > 0

  if (hasSelection || !anySpeciesLists) {
    const proceed = onReady
    proceed()
    return
  }

  $speciesPickerProjectId.set(projectId)
  $isSpeciesPickerOpen.set(true)

  let cleaned = false
  let unsubSelection: () => void = () => {}
  let unsubOpen: () => void = () => {}

  function cleanup() {
    if (cleaned) return
    cleaned = true
    unsubSelection()
    unsubOpen()
  }

  unsubSelection = projectSpeciesSelectionStore.subscribe((val) => {
    const nextHas = !!(val || {})?.[projectId]
    if (nextHas) {
      cleanup()
      const proceed = onReady
      proceed()
    }
  })

  unsubOpen = $isSpeciesPickerOpen.subscribe((open) => {
    if (!open) cleanup()
  })
}

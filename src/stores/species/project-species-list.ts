import { atom } from 'nanostores'

import { DB_NAME } from '~/utils/index-db'

let idbGet: ((db: string, store: string, key: string) => Promise<unknown>) | undefined
let idbPut: ((db: string, store: string, key: string, value: unknown) => Promise<void>) | undefined

export const projectSpeciesSelectionStore = atom<Record<string, string>>({})
const IDB_SELECTION = 'species-selection'

export async function saveProjectSpeciesSelection(params: { projectId: string; speciesListId: string }) {
  const { projectId, speciesListId } = params
  if (!projectId || !speciesListId) return

  const current = projectSpeciesSelectionStore.get() || {}
  const next = { ...current, [projectId]: speciesListId }
  projectSpeciesSelectionStore.set(next)

  try {
    if (!idbPut) {
      const mod = await import('~/utils/index-db')
      idbPut = (mod as any).idbPut
    }
    await (idbPut as any)(DB_NAME, IDB_SELECTION, 'selection', next)
  } catch {}
}

export async function loadProjectSpeciesSelection() {
  try {
    if (!idbGet) {
      const mod = await import('~/utils/index-db')
      idbGet = (mod as any).idbGet
    }
    const saved = (await (idbGet as any)(DB_NAME, IDB_SELECTION, 'selection')) as Record<string, string> | null
    if (saved && typeof saved === 'object') projectSpeciesSelectionStore.set(saved)
  } catch {}
}

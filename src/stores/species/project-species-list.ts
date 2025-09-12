import { atom } from 'nanostores'

// Defer IDB utils to dynamic import to avoid alias issues in non-Vite scripts
let idbGet: ((db: string, store: string, key: string) => Promise<unknown>) | undefined
let idbPut: ((db: string, store: string, key: string, value: unknown) => Promise<void>) | undefined

// projectId -> speciesListId
export const projectSpeciesSelectionStore = atom<Record<string, string>>({})

const IDB_DB = 'mothbox-labeler'
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
    await (idbPut as any)(IDB_DB, IDB_SELECTION, 'selection', next)
  } catch {
    // ignore when IDB not available (e.g., during script runs)
  }
}

export async function loadProjectSpeciesSelection() {
  try {
    if (!idbGet) {
      const mod = await import('~/utils/index-db')
      idbGet = (mod as any).idbGet
    }
    const saved = (await (idbGet as any)(IDB_DB, IDB_SELECTION, 'selection')) as Record<string, string> | null
    if (saved && typeof saved === 'object') projectSpeciesSelectionStore.set(saved)
  } catch {
    // ignore
  }
}

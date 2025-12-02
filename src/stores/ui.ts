import { atom, computed } from 'nanostores'
import { patchesStore } from './entities/5.patches'
import { DB_NAME, idbGet, idbPut } from '~/utils/index-db'

export const pickerErrorStore = atom<string | null>(null)

export const selectedPatchIdsStore = atom<Set<string>>(new Set())
export const selectionNightIdStore = atom<string | null>(null)

// UI: hovered/previewed cluster id for selection preview
export const selectedClusterIdStore = atom<number | null>(null)

export function setSelectedClusterId(params: { clusterId: number | null }) {
  const { clusterId } = params || {}
  const next = typeof clusterId === 'number' ? clusterId : null
  selectedClusterIdStore.set(next)
}

// UI: hovered/previewed sub-cluster id (exact numeric cluster id)
export const selectedSubClusterIdStore = atom<number | null>(null)

export function setSelectedSubClusterId(params: { clusterId: number | null }) {
  const { clusterId } = params || {}
  const next = typeof clusterId === 'number' ? clusterId : null
  selectedSubClusterIdStore.set(next)
}

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

// User session (initials)
export type UserSession = { initials?: string }
export const userSessionStore = atom<UserSession>({})
export const userSessionLoadedStore = atom<boolean>(false)
export const appReadyStore = computed(userSessionLoadedStore, (loaded) => !!loaded)

export async function loadUserSession() {
  try {
    const saved = (await idbGet(DB_NAME, 'user-session', 'session')) as UserSession | null
    if (saved && typeof saved === 'object') userSessionStore.set(saved)
  } catch {
    return null
  } finally {
    userSessionLoadedStore.set(true)
  }
}
export async function saveUserSession(params: UserSession) {
  const next = { initials: (params?.initials || '').trim() || undefined }
  userSessionStore.set(next)
  try {
    await idbPut(DB_NAME, 'user-session', 'session', next)
  } catch {
    return null
  }
}
export async function clearUserSession() {
  userSessionStore.set({})
  try {
    await idbPut(DB_NAME, 'user-session', 'session', {})
  } catch {
    return null
  }
}

// Night ingest progress (processed patches count per night)
export const nightIngestProgressStore = atom<{ nightId?: string; processed: number; total: number }>({ processed: 0, total: 0 })

export function resetNightIngestProgress(params?: { nightId?: string }) {
  const { nightId } = params || {}
  console.log('🏁 progress: reset', { nightId })
  nightIngestProgressStore.set({ nightId, processed: 0, total: 0 })
}

export function setNightIngestTotal(params: { nightId: string; total: number }) {
  const { nightId, total } = params
  const current = nightIngestProgressStore.get() || { processed: 0, total: 0 }
  console.log('🎯 progress: set total', {
    nightId,
    total,
    prev: { nightId: current.nightId, processed: current.processed, total: current.total },
  })
  nightIngestProgressStore.set({ nightId, processed: current.processed, total })
}

export function incrementNightIngestProcessed(params: { nightId: string; by?: number }) {
  const { nightId, by = 1 } = params
  const current = nightIngestProgressStore.get() || { processed: 0, total: 0 }
  const processed = (current.nightId === nightId ? current.processed : 0) + by
  const total = current.nightId === nightId ? current.total : 0
  console.log('➕ progress: increment processed', {
    nightId,
    by,
    prev: { nightId: current.nightId, processed: current.processed, total: current.total },
    next: { processed, total },
  })
  nightIngestProgressStore.set({ nightId, processed, total })
}

export function addNightIngestTotal(params: { nightId: string; by: number }) {
  const { nightId, by } = params
  const current = nightIngestProgressStore.get() || { processed: 0, total: 0 }
  const total = (current.nightId === nightId ? current.total : 0) + (by || 0)
  const processed = current.nightId === nightId ? current.processed : 0
  console.log('➕ progress: add to total', {
    nightId,
    by,
    prev: { nightId: current.nightId, processed: current.processed, total: current.total },
    next: { processed, total },
  })
  nightIngestProgressStore.set({ nightId, processed, total })
}

// Active nights tracking for memory management
// Keeps track of currently active night and recently viewed nights
// Used to determine which File objects to keep in memory
export const activeNightIdStore = atom<string | null>(null)
export const recentlyViewedNightIdsStore = atom<Set<string>>(new Set())

const MAX_RECENTLY_VIEWED = 2

export function markNightAsActive(params: { nightId: string }) {
  const { nightId } = params
  const currentActive = activeNightIdStore.get()
  const recent = new Set(recentlyViewedNightIdsStore.get())

  if (currentActive && currentActive !== nightId) {
    recent.add(currentActive)
    const recentArray = Array.from(recent)
    if (recentArray.length > MAX_RECENTLY_VIEWED) {
      const oldest = recentArray[0]
      recent.delete(oldest)
    }
  }

  activeNightIdStore.set(nightId)
  recentlyViewedNightIdsStore.set(recent)
}

export function getActiveNightIds(): Set<string> {
  const active = activeNightIdStore.get()
  const recent = recentlyViewedNightIdsStore.get()
  const result = new Set<string>()
  if (active) result.add(active)
  for (const id of recent) result.add(id)
  return result
}

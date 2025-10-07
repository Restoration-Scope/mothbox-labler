import { atom } from 'nanostores'

export type MorphoCover = { nightId: string; patchId: string }

export const morphoCoversStore = atom<Record<string, MorphoCover>>({})

let idbGet: ((db: string, store: string, key: string) => Promise<unknown>) | undefined
let idbPut: ((db: string, store: string, key: string, value: unknown) => Promise<void>) | undefined

const IDB_DB = 'mothbox-labeler'
const IDB_STORE = 'morpho-covers'

export function normalizeMorphoKey(input: string): string {
  const text = (input ?? '').trim().toLowerCase()
  const res = text
  return res
}

export async function loadMorphoCovers() {
  try {
    if (!idbGet) {
      const mod = await import('~/utils/index-db')
      idbGet = (mod as any).idbGet
    }
    const saved = (await (idbGet as any)(IDB_DB, IDB_STORE, 'covers')) as Record<string, MorphoCover> | null
    if (saved && typeof saved === 'object') morphoCoversStore.set(saved)
  } catch {
    console.error('Error loading morpho covers')
  }
}

export async function setMorphoCover(params: { morphoKey?: string; label?: string; nightId?: string; patchId?: string }) {
  const { nightId, patchId } = params

  const keySource = (params?.morphoKey || params?.label || '').trim()
  const morphoKey = normalizeMorphoKey(keySource)

  if (!morphoKey) return
  if (!nightId || !patchId) return

  const current = morphoCoversStore.get() || {}
  const next = { ...current, [morphoKey]: { nightId, patchId } }
  morphoCoversStore.set(next)

  try {
    if (!idbPut) {
      const mod = await import('~/utils/index-db')
      idbPut = (mod as any).idbPut
    }
    await (idbPut as any)(IDB_DB, IDB_STORE, 'covers', next)
  } catch {
    console.error('Error saving morpho cover')
  }
}

export {}

import { atom } from 'nanostores'
import { normalizeMorphoKey } from './covers'

export type MorphoLinksMap = Record<string, string>

export const morphoLinksStore = atom<MorphoLinksMap>({})

import { DB_NAME } from '~/utils/index-db'

let idbGet: ((db: string, store: string, key: string) => Promise<unknown>) | undefined
let idbPut: ((db: string, store: string, key: string, value: unknown) => Promise<void>) | undefined
const IDB_STORE = 'morpho-links'

let saveTimer: number | undefined

export async function loadMorphoLinks() {
  try {
    if (!idbGet) {
      const mod = await import('~/utils/index-db')
      idbGet = (mod as any).idbGet
    }
    const saved = (await (idbGet as any)(DB_NAME, IDB_STORE, 'links')) as MorphoLinksMap | null
    if (saved && typeof saved === 'object') morphoLinksStore.set(saved)
  } catch {
    console.error('Error loading morpho links')
  }
}

export async function setMorphoLink(params: { morphoKey?: string; label?: string; url?: string }) {
  const { url } = params

  const keySource = (params?.morphoKey || params?.label || '').trim()
  const key = normalizeMorphoKey(keySource)

  if (!key) return

  const current = morphoLinksStore.get() || {}
  const next: MorphoLinksMap = { ...current }

  if (typeof url === 'string' && url.trim()) next[key] = url.trim()
  else delete next[key]

  morphoLinksStore.set(next)

  try {
    if (!idbPut) {
      const mod = await import('~/utils/index-db')
      idbPut = (mod as any).idbPut
    }
    await (idbPut as any)(DB_NAME, IDB_STORE, 'links', next)
  } catch {
    console.error('Error saving morpho link')
  }

  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveMorphoLinksToDisk()
  }, 300)
}

export async function saveMorphoLinksToDisk() {
  try {
    const mod = await import('~/features/folder-processing/files.writer')
    const writer = (mod as any)?.writeMorphoLinksToDisk as undefined | (() => Promise<void>)
    if (typeof writer === 'function') await writer()
  } catch {
    console.error('Error writing morpho links to disk')
  }
}

export {}

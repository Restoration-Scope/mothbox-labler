import { atom } from 'nanostores'
import { DB_NAME, idbGet, idbPut } from '~/utils/index-db'
const STORE_NAME = 'ui-collapse'
const STORAGE_KEY = 'taxonomy-collapse-v1'

export const collapsedKeysStore = atom<Set<string>>(new Set())

let loaded = false

export async function loadCollapsedState() {
  if (loaded) return
  loaded = true
  try {
    const saved = (await idbGet(DB_NAME, STORE_NAME, STORAGE_KEY)) as unknown
    const keys = Array.isArray(saved) ? (saved as string[]) : []
    const next = new Set<string>()
    for (const k of keys) if (typeof k === 'string' && k) next.add(k)
    collapsedKeysStore.set(next)
  } catch {
    return
  }
}

async function persist() {
  try {
    const keys = Array.from(collapsedKeysStore.get() || new Set())
    await idbPut(DB_NAME, STORE_NAME, STORAGE_KEY, keys)
  } catch {
    return
  }
}

export function makeKey(params: { bucket: 'auto' | 'user'; rank: 'class' | 'order' | 'family' | 'genus'; path: string }) {
  const { bucket, rank, path } = params
  const safePath = (path || '').trim()
  const key = `${bucket}|${rank}:${safePath}`
  return key
}

export function isExpandedKey(key: string) {
  if (!key) return true
  const set = collapsedKeysStore.get() || new Set()
  const expanded = !set.has(key)
  return expanded
}

export function toggleKey(key: string) {
  if (!key) return
  const set = new Set(collapsedKeysStore.get() || new Set())
  if (set.has(key)) set.delete(key)
  else set.add(key)
  collapsedKeysStore.set(set)
  void persist()
}

export function expandKey(key: string) {
  if (!key) return
  const set = new Set(collapsedKeysStore.get() || new Set())
  if (set.has(key)) {
    set.delete(key)
    collapsedKeysStore.set(set)
    void persist()
  }
}

export function collapseKey(key: string) {
  if (!key) return
  const set = new Set(collapsedKeysStore.get() || new Set())
  if (!set.has(key)) {
    set.add(key)
    collapsedKeysStore.set(set)
    void persist()
  }
}

export function expandMany(keys: string[]) {
  if (!Array.isArray(keys) || keys.length === 0) return
  const set = new Set(collapsedKeysStore.get() || new Set())
  for (const k of keys) set.delete(k)
  collapsedKeysStore.set(set)
  void persist()
}

export function collapseMany(keys: string[]) {
  if (!Array.isArray(keys) || keys.length === 0) return
  const set = new Set(collapsedKeysStore.get() || new Set())
  for (const k of keys) if (k) set.add(k)
  collapsedKeysStore.set(set)
  void persist()
}

void loadCollapsedState()

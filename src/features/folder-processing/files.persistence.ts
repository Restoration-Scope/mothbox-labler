import { idbDelete, idbGet, idbPut } from '~/utils/index-db'

const LOCAL_FLAG_KEY = 'mbl/pickedDir'
const LOCAL_NAME_KEY = 'mbl/pickedDirName'
const IDB_NAME = 'mothbox-local'
const IDB_STORE = 'fs-handles'

type FileSystemDirectoryHandleLike = {
  values: () => AsyncIterable<unknown>
  name?: string
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'> | 'granted' | 'denied' | 'prompt'
  requestPermission?: (options: {
    mode: 'read' | 'readwrite'
  }) => Promise<'granted' | 'denied' | 'prompt'> | 'granted' | 'denied' | 'prompt'
}

export async function persistPickedDirectory(handle: FileSystemDirectoryHandleLike) {
  try {
    await idbPut(IDB_NAME, IDB_STORE, 'projectsRoot', handle)
    try {
      const name = (handle as unknown as { name?: string })?.name ?? ''
      localStorage.setItem(LOCAL_FLAG_KEY, '1')
      if (name) localStorage.setItem(LOCAL_NAME_KEY, name)
    } catch {
      // ignore localStorage errors
    }
  } catch {
    // ignore idb errors
  }
}

export async function loadSavedDirectory(): Promise<FileSystemDirectoryHandleLike | null> {
  try {
    const saved = (await idbGet(IDB_NAME, IDB_STORE, 'projectsRoot')) as FileSystemDirectoryHandleLike | null
    if (!saved) return null
    return saved
  } catch {
    return null
  }
}

export async function forgetSavedDirectory() {
  try {
    await idbDelete(IDB_NAME, IDB_STORE, 'projectsRoot')
  } catch {
    // ignore idb errors
  }
  try {
    localStorage.removeItem(LOCAL_FLAG_KEY)
    localStorage.removeItem(LOCAL_NAME_KEY)
  } catch {
    // ignore localStorage errors
  }
}

export async function ensureReadPermission(handle: FileSystemDirectoryHandleLike): Promise<boolean> {
  try {
    const query = (await (handle as unknown as { queryPermission?: (o: { mode: 'read' }) => Promise<string> | string }).queryPermission?.({
      mode: 'read',
    })) as 'granted' | 'denied' | 'prompt' | undefined
    if (query === 'granted') return true
    const req = (await (handle as unknown as { requestPermission?: (o: { mode: 'read' }) => Promise<string> | string }).requestPermission?.(
      {
        mode: 'read',
      },
    )) as 'granted' | 'denied' | 'prompt' | undefined
    if (req === 'granted') return true
    return false
  } catch {
    return false
  }
}

export const persistenceConstants = {
  LOCAL_FLAG_KEY,
  LOCAL_NAME_KEY,
  IDB_NAME,
  IDB_STORE,
}

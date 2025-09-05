export async function idbPut(dbName: string, storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openIdb(dbName, storeName)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet(dbName: string, storeName: string, key: string): Promise<unknown> {
  const db = await openIdb(dbName, storeName)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbDelete(dbName: string, storeName: string, key: string): Promise<void> {
  const db = await openIdb(dbName, storeName)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    req.onerror = () => reject(req.error)
  })
}

export function openIdb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

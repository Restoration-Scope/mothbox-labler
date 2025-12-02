export const DB_NAME = 'mothbox-labeler'

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
    const request = indexedDB.open(dbName)

    request.onupgradeneeded = () => {
      // Fresh DB creation path; create requested store
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }

    request.onsuccess = () => {
      const db = request.result
      if (db.objectStoreNames.contains(storeName)) return resolve(db)

      // Store missing in existing DB; bump version and create it
      const nextVersion = (db.version || 1) + 1
      db.close()
      const upgrade = indexedDB.open(dbName, nextVersion)
      upgrade.onupgradeneeded = () => {
        const udb = upgrade.result
        if (!udb.objectStoreNames.contains(storeName)) udb.createObjectStore(storeName)
      }
      upgrade.onsuccess = () => resolve(upgrade.result)
      upgrade.onerror = () => reject(upgrade.error)
    }

    request.onerror = () => reject(request.error)
  })
}

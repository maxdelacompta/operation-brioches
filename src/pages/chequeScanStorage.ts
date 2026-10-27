/** Scans of cheques are stored as Blobs in IndexedDB, not localStorage. */
const DB = 'ob-operation-brioches-cheque-scans'
const STORE = 'scans'
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Stockage des scans indisponible'))
  })
}
export async function storeChequeScan(id: string, dataUrl: string): Promise<void> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(blob, id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Enregistrement du scan impossible'))
      transaction.onabort = () => reject(transaction.error || new Error('Enregistrement du scan interrompu'))
    })
  } finally { db.close() }
}
export async function getChequeScan(id: string): Promise<Blob | null> {
  const db = await openDB()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly')
      const request = transaction.objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error || new Error('Lecture du scan impossible'))
    })
  } finally { db.close() }
}

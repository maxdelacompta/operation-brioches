/**
 * Registre des chèques / bordereaux stocké dans IndexedDB.
 *
 * L'ancien stockage localStorage reste intact comme sauvegarde de migration.
 * Une seule écriture atomique met à jour chèques, remises et chrono.
 */
export type ChequeRegistrySnapshot<C, R> = {
  cheques: C[]
  remises: R[]
  lastChrono: number
}

const DB_NAME = 'operation-brioches-cheques-v1'
const DB_VERSION = 1
const STORE = 'registres'
const RECORD_KEY = 'principal'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible dans ce navigateur.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Ouverture IndexedDB impossible.'))
    request.onblocked = () => reject(new Error('Ferme les autres onglets Opération Brioche puis réessaie.'))
  })
}

async function getSnapshot<C, R>(): Promise<ChequeRegistrySnapshot<C, R> | null> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly')
      const request = transaction.objectStore(STORE).get(RECORD_KEY)
      request.onsuccess = () => resolve((request.result as ChequeRegistrySnapshot<C, R> | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Lecture des chèques impossible.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Lecture IndexedDB annulée.'))
    })
  } finally {
    db.close()
  }
}

export async function saveChequeRegistry<C, R>(state: ChequeRegistrySnapshot<C, R>): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(state, RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Sauvegarde IndexedDB impossible.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Sauvegarde IndexedDB annulée.'))
    })
  } finally {
    db.close()
  }
}

/** Première ouverture : recopier l'ancien registre, sans l'effacer. */
export async function loadChequeRegistry<C, R>(legacy: ChequeRegistrySnapshot<C, R>): Promise<ChequeRegistrySnapshot<C, R>> {
  const existing = await getSnapshot<C, R>()
  if (existing) {
    if (!Array.isArray(existing.cheques) || !Array.isArray(existing.remises)) {
      throw new Error('Registre IndexedDB incorrect : aucune donnée n’a été écrasée.')
    }
    return { ...existing, lastChrono: Math.max(0, Number(existing.lastChrono) || 0) }
  }
  await saveChequeRegistry(legacy)
  return legacy
}

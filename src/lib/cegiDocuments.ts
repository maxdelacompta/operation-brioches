// Archives PDF CEGI conservées dans IndexedDB, dans le navigateur.
// Les anciennes archives n'avaient pas de campagne : leur champ reste optionnel
// jusqu'à un rattachement manuel, pour éviter de leur attribuer la mauvaise année.
export type CegiDocument = {
  id: string
  nom: string
  dateDepot: string
  taille: number
  operationsDetectees: number
  totalDetecte: number
  fichier: Blob
  campagne?: string
}

// IMPORTANT : conserver ce nom de base/store pour ne pas perdre les PDF existants.
const DB = 'ob2026-documents-cegi-v1'
const STORE = 'documents'

export function memeCampagneCegi(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const normaliser = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normaliser(a) === normaliser(b)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function hash(fichier: Blob): Promise<string> {
  const data = await crypto.subtle.digest('SHA-256', await fichier.arrayBuffer())
  return [...new Uint8Array(data)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Toute nouvelle archive est rattachée à la campagne choisie dans la Topbar. */
export async function conserverCegi(
  file: File,
  operationsDetectees: number,
  totalDetecte: number,
  campagne: string,
): Promise<CegiDocument> {
  if (!campagne.trim()) throw new Error('Sélectionne une campagne avant d’archiver un PDF CEGI.')
  const id = await hash(file)
  const db = await openDb()
  try {
    const precedent = await new Promise<CegiDocument | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result as CegiDocument | undefined)
      req.onerror = () => reject(req.error)
    })
    if (precedent) {
      if (!precedent.campagne) {
        throw new Error(`« ${file.name} » est déjà archivé sans campagne. Rattache-le d'abord depuis l'historique CEGI.`)
      }
      if (!memeCampagneCegi(precedent.campagne, campagne)) {
        throw new Error(`« ${file.name} » est déjà archivé pour ${precedent.campagne}. Aucun changement automatique de campagne.`)
      }
      return precedent
    }
    const document: CegiDocument = {
      id,
      nom: file.name,
      dateDepot: new Date().toISOString(),
      taille: file.size,
      operationsDetectees,
      totalDetecte,
      fichier: file,
      campagne,
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(document)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return document
  } finally {
    db.close()
  }
}

export async function listerCegi(): Promise<CegiDocument[]> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () => resolve(
        (req.result as CegiDocument[]).sort((a, b) => b.dateDepot.localeCompare(a.dateDepot)),
      )
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Reclasse une archive historique sans campagne, sans modifier ni supprimer son PDF. */
export async function rattacherCegi(id: string, campagne: string): Promise<void> {
  if (!id || !campagne.trim()) throw new Error('Document et campagne requis.')
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      let erreur: Error | undefined
      const req = store.get(id)
      req.onsuccess = () => {
        const document = req.result as CegiDocument | undefined
        if (!document) {
          erreur = new Error('Archive introuvable.')
          tx.abort()
          return
        }
        if (document.campagne) {
          erreur = new Error(`L'archive est déjà affectée à ${document.campagne}.`)
          tx.abort()
          return
        }
        store.put({ ...document, campagne })
      }
      req.onerror = () => {
        erreur = new Error('Lecture du document impossible.')
        tx.abort()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(erreur ?? tx.error)
      tx.onabort = () => reject(erreur ?? tx.error)
    })
  } finally {
    db.close()
  }
}

export function ouvrirCegi(archive: CegiDocument) {
  const url = URL.createObjectURL(archive.fichier)
  const lien = window.document.createElement('a')
  lien.href = url
  lien.download = archive.nom
  lien.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Modèle de bon individuel pour une campagne.
 * Stockage IndexedDB local pour la préproduction, à migrer côté serveur avant déploiement. */
import { PDFDocument } from 'pdf-lib'

const DB_NAME = 'ob-ecoles-modeles-campagnes-v1'
const STORE = 'documents'
const MAX_BYTES = 12 * 1024 * 1024
const MAX_DIFF = 14 // points PDF : tolérance A4 paysage

export type SchoolTemplateMeta = {
  campaignId: string
  name: string
  bytes: number
  version: number
  uploadedAt: string
}
type SchoolTemplateRecord = { meta: SchoolTemplateMeta; pdf: Blob }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir le stockage des modèles écoles.'))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function readSchoolTemplate(campaignId: string): Promise<SchoolTemplateRecord | null> {
  if (!campaignId) return null
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(campaignId)
      request.onsuccess = () => resolve((request.result as SchoolTemplateRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Modèle inaccessible.'))
    })
  } finally { db.close() }
}

export async function saveSchoolTemplate(campaignId: string, file: File): Promise<SchoolTemplateMeta> {
  if (!campaignId.trim()) throw new Error('La campagne doit être sélectionnée.')
  if (file.size > MAX_BYTES) throw new Error('Le modèle PDF doit faire moins de 12 Mo.')
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choisis un PDF A4 paysage recto-verso.')
  const bytes = await file.arrayBuffer()
  let doc: PDFDocument
  try { doc = await PDFDocument.load(bytes) }
  catch { throw new Error('Le modèle PDF est illisible, chiffré ou endommagé.') }
  if (doc.getPageCount() !== 2) throw new Error('Le modèle doit avoir exactement 2 pages : recto et verso.')
  if (doc.getPages().some(page => {
    const { width, height } = page.getSize()
    return Math.abs(width - 841.89) > MAX_DIFF || Math.abs(height - 595.28) > MAX_DIFF
  })) throw new Error('Les deux pages doivent être au format A4 paysage (297 × 210 mm).')
  const previous = await readSchoolTemplate(campaignId)
  const meta: SchoolTemplateMeta = {
    campaignId, name: file.name, bytes: file.size,
    version: (previous?.meta.version ?? 0) + 1, uploadedAt: new Date().toISOString(),
  }
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ meta, pdf: file } satisfies SchoolTemplateRecord, campaignId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Enregistrement impossible.'))
      tx.onabort = () => reject(tx.error ?? new Error('Enregistrement annulé.'))
    })
  } finally { db.close() }
  return meta
}

export async function removeSchoolTemplate(campaignId: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(campaignId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Suppression impossible.'))
      tx.onabort = () => reject(tx.error ?? new Error('Suppression annulée.'))
    })
  } finally { db.close() }
}

/** Prévisualise le fond de page importé (sans les champs d'école et de classe). */
export async function previewSchoolTemplate(campaignId: string): Promise<void> {
  const record = await readSchoolTemplate(campaignId)
  if (!record) throw new Error('Aucun modèle enregistré pour cette campagne.')
  const url = URL.createObjectURL(record.pdf)
  const link = document.createElement('a')
  link.href = url
  link.download = record.meta.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

export type ConventionType = 'mecenat' | 'sponsoring'

export type ConventionTemplateMeta = {
  name: string
  size: number
  updatedAt: string
  version: number
}

export type StoredDocumentMeta = {
  name: string
  size: number
  uploadedAt: string
}

const DB_NAME = 'ob-conventions-documents-v1'
const DB_VERSION = 1
const TEMPLATES_STORE = 'templates'
const DOCUMENTS_STORE = 'documents'
const TEMPLATE_METADATA_KEY = 'ob-convention-templates-v1'
const MAX_FILE_SIZE = 12 * 1024 * 1024

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TEMPLATES_STORE)) db.createObjectStore(TEMPLATES_STORE)
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) db.createObjectStore(DOCUMENTS_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Stockage des conventions indisponible.'))
  })
}

async function writeBlob(store: string, key: string, value: Blob | null) {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      if (value) objectStore.put(value, key)
      else objectStore.delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Enregistrement impossible.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Enregistrement annulé.'))
    })
  } finally {
    db.close()
  }
}

async function readBlob(store: string, key: string): Promise<Blob | null> {
  const db = await openDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Document introuvable.'))
    })
  } finally {
    db.close()
  }
}

export function templateKey(campaignId: string, type: ConventionType) {
  return JSON.stringify([campaignId, type])
}

export function getConventionTemplates(campaignId: string): Record<ConventionType, ConventionTemplateMeta | null> {
  try {
    const all = JSON.parse(localStorage.getItem(TEMPLATE_METADATA_KEY) || '{}') as Record<string, ConventionTemplateMeta>
    return { mecenat: all[templateKey(campaignId, 'mecenat')] ?? null, sponsoring: all[templateKey(campaignId, 'sponsoring')] ?? null }
  } catch {
    return { mecenat: null, sponsoring: null }
  }
}

function saveTemplateMeta(campaignId: string, type: ConventionType, meta: ConventionTemplateMeta | null) {
  const all = JSON.parse(localStorage.getItem(TEMPLATE_METADATA_KEY) || '{}') as Record<string, ConventionTemplateMeta>
  if (meta) all[templateKey(campaignId, type)] = meta
  else delete all[templateKey(campaignId, type)]
  localStorage.setItem(TEMPLATE_METADATA_KEY, JSON.stringify(all))
}

export async function saveConventionTemplate(campaignId: string, type: ConventionType, file: File) {
  if (!/\.docx$/i.test(file.name)) throw new Error('Choisissez un fichier Word au format .docx.')
  if (file.size === 0 || file.size > MAX_FILE_SIZE) throw new Error('Le modèle Word doit peser entre 1 octet et 12 Mo.')
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Le fichier ne semble pas être un document Word .docx valide.')
  await writeBlob(TEMPLATES_STORE, templateKey(campaignId, type), file)
  const previous = getConventionTemplates(campaignId)[type]
  const meta = { name: file.name, size: file.size, updatedAt: new Date().toISOString(), version: (previous?.version ?? 0) + 1 }
  saveTemplateMeta(campaignId, type, meta)
  return meta
}

export async function removeConventionTemplate(campaignId: string, type: ConventionType) {
  await writeBlob(TEMPLATES_STORE, templateKey(campaignId, type), null)
  saveTemplateMeta(campaignId, type, null)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadConventionTemplate(campaignId: string, type: ConventionType) {
  const blob = await readBlob(TEMPLATES_STORE, templateKey(campaignId, type))
  if (!blob) throw new Error('Le modèle Word est introuvable dans ce navigateur.')
  downloadBlob(blob, getConventionTemplates(campaignId)[type]?.name ?? `convention-${type}.docx`)
}

/** Les balises {entreprise}, {campagne}, etc. doivent figurer dans le DOCX officiel. */
export async function generateConvention(campaignId: string, type: ConventionType, variables: Record<string, string>, filename: string) {
  const blob = await readBlob(TEMPLATES_STORE, templateKey(campaignId, type))
  if (!blob) throw new Error(`Ajoutez d’abord un modèle Word de ${type} dans Campagnes > Documents.`)
  try {
    const zip = new PizZip(await blob.arrayBuffer())
    const document = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
    document.render(variables)
    const output = document.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    downloadBlob(output, filename)
  } catch {
    throw new Error('Impossible de remplir ce Word. Vérifiez que le modèle .docx utilise les balises indiquées dans Campagnes.')
  }
}

function documentKey(campaignId: string, entityId: string, kind: string) {
  return JSON.stringify([campaignId, entityId, kind])
}

export async function saveEntityDocument(campaignId: string, entityId: string, kind: string, file: File): Promise<StoredDocumentMeta> {
  if (!file.size || file.size > MAX_FILE_SIZE) throw new Error('Le fichier doit faire moins de 12 Mo.')
  const allowed = /\.(docx|pdf|png|jpe?g|webp)$/i.test(file.name)
  if (!allowed) throw new Error('Formats acceptés : Word, PDF ou image (JPG/PNG/WebP).')
  await writeBlob(DOCUMENTS_STORE, documentKey(campaignId, entityId, kind), file)
  return { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
}

export async function downloadEntityDocument(campaignId: string, entityId: string, kind: string, name: string) {
  const blob = await readBlob(DOCUMENTS_STORE, documentKey(campaignId, entityId, kind))
  if (!blob) throw new Error('Fichier introuvable dans ce navigateur.')
  downloadBlob(blob, name)
}

export async function getEntityDocumentBlob(campaignId: string, entityId: string, kind: string) {
  return readBlob(DOCUMENTS_STORE, documentKey(campaignId, entityId, kind))
}

export async function removeEntityDocument(campaignId: string, entityId: string, kind: string) {
  await writeBlob(DOCUMENTS_STORE, documentKey(campaignId, entityId, kind), null)
}

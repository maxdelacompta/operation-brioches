/** Local prototype storage. Files are not synced across devices or browsers. */
export type ChatAttachment = {
  id: string
  name: string
  size: number
  mimeType: string
}

const DB_NAME = 'ob-chat-attachments-v1'
const STORE_NAME = 'attachments'
export const MAX_CHAT_FILE_SIZE = 8 * 1024 * 1024
export const MAX_CHAT_FILES = 3

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Le stockage des pièces jointes n’est pas disponible.'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir le stockage.'))
  })
}

export function validateChatFiles(files: readonly File[]): string | null {
  if (files.length > MAX_CHAT_FILES) return `Maximum ${MAX_CHAT_FILES} pièces jointes par message.`
  for (const file of files) {
    if (!file.size) return `Le fichier « ${file.name} » est vide.`
    if (file.size > MAX_CHAT_FILE_SIZE) return `« ${file.name} » dépasse la limite de 8 Mo.`
  }
  return null
}

export function attachmentInfo(file: File): ChatAttachment {
  return { id: crypto.randomUUID(), name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' }
}

export async function saveChatFiles(items: readonly { meta: ChatAttachment; file: File }[]): Promise<void> {
  if (!items.length) return
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      for (const { meta, file } of items) store.put(file, meta.id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Échec de sauvegarde des fichiers.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Sauvegarde annulée.'))
    })
  } finally {
    database.close()
  }
}

export async function removeChatFiles(ids: readonly string[]): Promise<void> {
  if (!ids.length) return
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      for (const id of ids) transaction.objectStore(STORE_NAME).delete(id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Suppression impossible.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Suppression annulée.'))
    })
  } finally {
    database.close()
  }
}

export async function downloadChatFile(meta: ChatAttachment): Promise<void> {
  const database = await openDatabase()
  let blob: Blob | undefined
  try {
    blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(meta.id)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined)
      request.onerror = () => reject(request.error ?? new Error('Lecture impossible.'))
    })
  } finally {
    database.close()
  }
  if (!blob) throw new Error('Fichier introuvable dans ce navigateur.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = meta.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function formatChatFileSize(size: number): string {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} Mo` : `${Math.ceil(size / 1024)} Ko`
}

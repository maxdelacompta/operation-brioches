// Stockage local de PDF CEGI : les fichiers restent sur ce navigateur (IndexedDB).
export type CegiDocument = { id: string; nom: string; dateDepot: string; taille: number; operationsDetectees: number; totalDetecte: number; fichier: Blob }
const DB = 'ob2026-documents-cegi-v1'
const STORE = 'documents'
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, {keyPath:'id'}) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function hash(fichier: Blob): Promise<string> {
  const data = await crypto.subtle.digest('SHA-256', await fichier.arrayBuffer())
  return [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('')
}
export async function conserverCegi(file: File, operationsDetectees: number, totalDetecte: number): Promise<CegiDocument> {
  const id = await hash(file)
  const db = await openDb()
  try {
    const precedent = await new Promise<CegiDocument | undefined>((resolve,reject)=>{
      const req=db.transaction(STORE,'readonly').objectStore(STORE).get(id)
      req.onsuccess=()=>resolve(req.result as CegiDocument | undefined)
      req.onerror=()=>reject(req.error)
    })
    if (precedent) return precedent
    const document: CegiDocument = {id,nom:file.name,dateDepot:new Date().toISOString(),taille:file.size,operationsDetectees,totalDetecte,fichier:file}
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(document)
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)
    })
    return document
  } finally {db.close()}
}
export async function listerCegi():Promise<CegiDocument[]> {
  const db=await openDb()
  try {return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();req.onsuccess=()=>resolve((req.result as CegiDocument[]).sort((a,b)=>b.dateDepot.localeCompare(a.dateDepot)));req.onerror=()=>reject(req.error)})}
  finally {db.close()}
}
export function ouvrirCegi(archive:CegiDocument) {
  const url=URL.createObjectURL(archive.fichier)
  const lien=window.document.createElement('a')
  lien.href=url;lien.download=archive.nom;lien.click()
  setTimeout(()=>URL.revokeObjectURL(url),2000)
}

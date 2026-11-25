/** Module Écoles : stockage provisoire local pour maquette / préproduction.
 * Les noms d'enfants doivent être migrés vers une base sécurisée avant utilisation réelle. */
export type SchoolClass = {
  id: string; code: string; name: string; level: string; teacher: string;
  campaignIds: string[]
}
export type School = {
  id: string; code: string; name: string; category: string;
  address: string; postalCode: string; city: string;
  director: string; contact: string; phone: string; email: string;
  notes: string; classes: SchoolClass[]; orderReturnDate?: string; deliveryInfo?: string
}
export type SchoolOrder = {
  id: string; campaignId: string; schoolId: string; classId: string;
  studentName: string; quantity: number; source: 'manuel' | 'ocr';
  sourceFile: string; sourcePage: number; createdAt: string
}
export type SchoolFlyerSettings = {
  operationDates: string; fundedProject: string; familyMessage: string
}
export function emptySchoolFlyerSettings(): SchoolFlyerSettings {
  return { operationDates: '', fundedProject: '', familyMessage: '' }
}
export type SchoolData = {
  schools: School[]; orders: SchoolOrder[];
  flyerSettingsByCampaign?: Record<string, SchoolFlyerSettings>
}
const DB_NAME = 'ob-ecoles-preproduction-v1'
const STORE = 'snapshots'
const RECORD = 'ecoles'
const VERSION = 1
let dbPromise: Promise<IDBDatabase> | null = null

export function schoolId(prefix: 'ECO' | 'CLA' | 'CMD'): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase()
  return `${prefix}-${random}`
}
export function emptySchool(): School {
  return { id: schoolId('ECO'), code: '', name: '', category: 'École élémentaire', address: '',
    postalCode: '', city: '', director: '', contact: '', phone: '', email: '', notes: '', classes: [], orderReturnDate: '', deliveryInfo: '' }
}
export function emptyClass(campaignId: string): SchoolClass {
  return { id: schoolId('CLA'), code: '', name: '', level: '', teacher: '', campaignIds: campaignId ? [campaignId] : [] }
}
export function schoolCode(id: string): string { return id.replace(/[^A-Z0-9]/gi, '').toUpperCase() }
export function normalizeStudentName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('fr-FR')
}
function openSchoolDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Base locale indisponible'))
  })
  return dbPromise
}
export async function readSchoolData(): Promise<SchoolData> {
  const db = await openSchoolDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD)
    request.onsuccess = () => {
      const data = request.result as SchoolData | undefined
      resolve({
        schools: Array.isArray(data?.schools) ? data.schools : [],
        orders: Array.isArray(data?.orders) ? data.orders : [],
        // Préserve la présentation personnalisée de chaque campagne après rechargement.
        flyerSettingsByCampaign: data?.flyerSettingsByCampaign &&
          typeof data.flyerSettingsByCampaign === 'object' &&
          !Array.isArray(data.flyerSettingsByCampaign)
          ? data.flyerSettingsByCampaign : {},
      })
    }
    request.onerror = () => reject(request.error ?? new Error('Lecture impossible'))
  })
}
export async function writeSchoolData(data: SchoolData): Promise<void> {
  const db = await openSchoolDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, RECORD)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Enregistrement impossible'))
    tx.onabort = () => reject(tx.error ?? new Error('Enregistrement annulé'))
  })
}

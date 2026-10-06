export type JustificatifTemplateType = 'JDI' | 'JDP'

export type PdfPoint = {
  x: number
  y: number
}

export type PdfFieldPositions = {
  date: PdfPoint
  raisonSociale: PdfPoint
  contact: PdfPoint
  adresse: PdfPoint
  ville: PdfPoint
  email: PdfPoint
  numero: PdfPoint
  montant: PdfPoint
  quantitePrix: PdfPoint
  reglement: PdfPoint
}

export type CampagnePdfTemplateMeta = {
  type: JustificatifTemplateType
  fileName: string
  size: number
  uploadedAt: string
  version: number
}

export type CampagneJustificatifsSettings = {
  campagneId: string
  annee: number | null

  templates: {
    JDI: CampagnePdfTemplateMeta | null
    JDP: CampagnePdfTemplateMeta | null
  }

  cheque: {
    ordre: string
  }

  virement: {
    iban: string
    bic: string
    banque: string
  }

  fields: {
    JDI: PdfFieldPositions
    JDP: PdfFieldPositions
  }
}

const SETTINGS_KEY = 'ob-campagne-justificatifs-v1'
const DB_NAME = 'ob-operation-brioches-documents'
const DB_VERSION = 1
const STORE_NAME = 'campaign-templates'

const DEFAULT_FIELDS: PdfFieldPositions = {
  date: { x: 326, y: 766 },
  raisonSociale: { x: 325, y: 680 },
  contact: { x: 325, y: 656 },
  adresse: { x: 325, y: 640 },
  ville: { x: 325, y: 624 },
  email: { x: 54, y: 554 },
  numero: { x: 298, y: 407 },
  montant: { x: 298, y: 347 },
  quantitePrix: { x: 298, y: 292 },
  reglement: { x: 55, y: 220 },
}

function cloneFields(): PdfFieldPositions {
  return JSON.parse(JSON.stringify(DEFAULT_FIELDS)) as PdfFieldPositions
}

function yearFromCampaign(
  campagneId: string,
  annee: number | null,
) {
  if (annee) return annee

  const match = campagneId.match(/\b(?:19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

export function createDefaultCampagneJustificatifsSettings(
  campagneId: string,
  annee: number | null,
): CampagneJustificatifsSettings {
  const year = yearFromCampaign(campagneId, annee)

  return {
    campagneId,
    annee: year,

    templates: {
      JDI: null,
      JDP: null,
    },

    cheque: {
      ordre: year
        ? `AEIM 54 opération brioches ${year}`
        : 'AEIM 54 opération brioches',
    },

    virement: {
      iban: 'FR76 1610 6010 0174 0333 0114 054',
      bic: 'AGRIFRPP861',
      banque: 'Crédit Agricole Lorraine',
    },

    fields: {
      JDI: cloneFields(),
      JDP: cloneFields(),
    },
  }
}

function loadAllSettings(): Record<
  string,
  CampagneJustificatifsSettings
> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)

    if (!raw) return {}

    const parsed = JSON.parse(raw)

    return parsed && typeof parsed === 'object'
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function saveAllSettings(
  value: Record<string, CampagneJustificatifsSettings>,
) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(value),
  )
}

export function getCampagneJustificatifsSettings(
  campagneId: string,
  annee: number | null = null,
): CampagneJustificatifsSettings {
  const all = loadAllSettings()
  const saved = all[campagneId]
  const defaults = createDefaultCampagneJustificatifsSettings(
    campagneId,
    annee,
  )

  if (!saved) return defaults

  return {
    ...defaults,
    ...saved,
    campagneId,
    annee: saved.annee ?? defaults.annee,
    templates: {
      ...defaults.templates,
      ...saved.templates,
    },
    cheque: {
      ...defaults.cheque,
      ...saved.cheque,
    },
    virement: {
      ...defaults.virement,
      ...saved.virement,
    },
    fields: {
      JDI: {
        ...defaults.fields.JDI,
        ...saved.fields?.JDI,
      },
      JDP: {
        ...defaults.fields.JDP,
        ...saved.fields?.JDP,
      },
    },
  }
}

export function saveCampagneJustificatifsSettings(
  settings: CampagneJustificatifsSettings,
) {
  const all = loadAllSettings()

  all[settings.campagneId] = settings

  saveAllSettings(all)
}

function templateKey(
  campagneId: string,
  type: JustificatifTemplateType,
) {
  return `${campagneId}::${type}`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ??
          new Error('Impossible d’ouvrir le stockage des modèles PDF.'),
      )
  })
}

export async function saveCampagneTemplatePdf(
  campagneId: string,
  type: JustificatifTemplateType,
  file: File,
  settings: CampagneJustificatifsSettings,
) {
  if (file.type !== 'application/pdf') {
    throw new Error('Le modèle doit être un fichier PDF.')
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Le PDF dépasse la taille maximale de 12 Mo.')
  }

  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      'readwrite',
    )

    transaction.objectStore(STORE_NAME).put(
      file,
      templateKey(campagneId, type),
    )

    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Impossible d’enregistrer le modèle PDF.'),
      )
  })

  db.close()

  const previous = settings.templates[type]

  const meta: CampagnePdfTemplateMeta = {
    type,
    fileName: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    version: (previous?.version ?? 0) + 1,
  }

  const next: CampagneJustificatifsSettings = {
    ...settings,
    templates: {
      ...settings.templates,
      [type]: meta,
    },
  }

  saveCampagneJustificatifsSettings(next)

  return next
}

export async function getCampagneTemplatePdf(
  campagneId: string,
  type: JustificatifTemplateType,
): Promise<Blob | null> {
  const db = await openDatabase()

  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readonly',
      )

      const request = transaction
        .objectStore(STORE_NAME)
        .get(templateKey(campagneId, type))

      request.onsuccess = () => {
        const value = request.result
        resolve(value instanceof Blob ? value : null)
      }

      request.onerror = () =>
        reject(
          request.error ??
            new Error('Impossible de charger le modèle PDF.'),
        )
    })
  } finally {
    db.close()
  }
}

export async function removeCampagneTemplatePdf(
  campagneId: string,
  type: JustificatifTemplateType,
  settings: CampagneJustificatifsSettings,
) {
  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      'readwrite',
    )

    transaction
      .objectStore(STORE_NAME)
      .delete(templateKey(campagneId, type))

    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Impossible de supprimer le modèle PDF.'),
      )
  })

  db.close()

  const next: CampagneJustificatifsSettings = {
    ...settings,
    templates: {
      ...settings.templates,
      [type]: null,
    },
  }

  saveCampagneJustificatifsSettings(next)

  return next
}

export async function previewCampagneTemplatePdf(
  campagneId: string,
  type: JustificatifTemplateType,
) {
  const blob = await getCampagneTemplatePdf(
    campagneId,
    type,
  )

  if (!blob) {
    throw new Error('Aucun modèle PDF n’est enregistré.')
  }

  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')

  window.setTimeout(
    () => URL.revokeObjectURL(url),
    60_000,
  )
}

export function formatTemplateSize(size: number) {
  if (size < 1024) return `${size} o`
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} Ko`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} Mo`
}

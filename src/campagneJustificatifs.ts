export type JustificatifTemplateType = string

export type PdfPosition = {
  x: number
  y: number
}

export type PdfFieldPositions = {
  date: PdfPosition
  raisonSociale: PdfPosition
  contact: PdfPosition
  adresse: PdfPosition
  ville: PdfPosition
  email: PdfPosition
  numero: PdfPosition
  montant: PdfPosition
  quantitePrix: PdfPosition
  reglement: PdfPosition
}

export type CampagneTemplateMeta = {
  fileName: string
  version: number
  nom?: string
  fichier?: string
  dateModification?: string
}

export interface CampagneJustificatifsSettings {
  cheque: {
    ordre: string
  }

  virement: {
    iban: string
    bic: string
    banque: string
  }

  templates: Record<
    JustificatifTemplateType,
    CampagneTemplateMeta | undefined
  >

  fields: Record<
    JustificatifTemplateType,
    PdfFieldPositions
  >
}

const EMPTY_SETTINGS: CampagneJustificatifsSettings = {
  cheque: {
    ordre: '',
  },

  virement: {
    iban: '',
    bic: '',
    banque: '',
  },

  templates: {},

  fields: {},
}

export function getCampagneJustificatifsSettings(
  _campagne: string,
  _year: number | null,
): CampagneJustificatifsSettings {
  return EMPTY_SETTINGS
}

export async function getCampagneTemplatePdf(
  _campagne: string,
  _type: JustificatifTemplateType,
): Promise<Blob | null> {
  return null
}
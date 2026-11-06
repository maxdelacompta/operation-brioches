import { createContext, useContext } from 'react'

import { type JustificatifDon, type NouveauJustificatif } from '../types/justificatifs'
import type { JustificatifAImporter } from '../lib/justificatifsImport'

export const STORAGE_KEY = 'ob-justificatifs-dons-v1'

export type JustificatifsContextValue = {
  justificatifs: JustificatifDon[]
  createJustificatif: (input: NouveauJustificatif) => JustificatifDon
  importerJustificatifs: (documents: JustificatifAImporter[]) => void
  updateJustificatif: (
    id: string,
    patch: Partial<JustificatifDon>,
    historyLabel?: string,
  ) => void
  markDocumentGenerated: (
    id: string,
    meta?: {
      modeleNom?: string
      modeleVersion?: number
      modeleCampagneId?: string
      modeReglementGenere?: string
    },
  ) => void
  markSent: (id: string) => void
  archiveJustificatif: (id: string) => void
  convertJdiToJdp: (id: string) => string
}

export const JustificatifsContext = createContext<
  JustificatifsContextValue | undefined
>(undefined)

export function makeId(prefix = 'jd') {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function loadJustificatifs(): JustificatifDon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is JustificatifDon =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.numero === 'string' &&
            (item.type === 'JDI' || item.type === 'JDP'),
        ),
    )
  } catch {
    return []
  }
}

function getCampaignYear(campagne: string) {
  const match = campagne.match(/(20\d{2})/)

  if (match) {
    return match[1]
  }

  return String(new Date().getFullYear())
}

export function createNumber(
  current: JustificatifDon[],
  type: JustificatifDon['type'],
  campagne: string,
) {
  const year = getCampaignYear(campagne)
  const prefix = `${type}-${year}-`

  const max = current.reduce((value, item) => {
    if (!item.numero.startsWith(prefix)) {
      return value
    }

    const sequence = Number(item.numero.slice(prefix.length))

    return Number.isFinite(sequence)
      ? Math.max(value, sequence)
      : value
  }, 0)

  return `${prefix}${String(max + 1).padStart(3, '0')}`
}



export function useJustificatifs() {
  const context = useContext(JustificatifsContext)

  if (!context) {
    throw new Error(
      'useJustificatifs doit être utilisé dans JustificatifsProvider.',
    )
  }

  return context
}

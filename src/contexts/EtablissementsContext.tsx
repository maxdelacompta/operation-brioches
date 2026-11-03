import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

import { type EtablissementAEIM, type NouvelEtablissementAEIM } from '../types/etablissements'

export const STORAGE_KEY = 'ob-etablissements-aeim-v1'

export type EtablissementsContextValue = {
  etablissements: EtablissementAEIM[]
  setEtablissements: Dispatch<
    SetStateAction<EtablissementAEIM[]>
  >
  createEtablissement: (
    input: NouvelEtablissementAEIM,
  ) => string
  updateEtablissement: (
    id: string,
    input: NouvelEtablissementAEIM,
  ) => void
  toggleEtablissementActif: (
    id: string,
  ) => void
  getEtablissementById: (
    id: string,
  ) => EtablissementAEIM | undefined
  getEtablissementsLivraison: () =>
    EtablissementAEIM[]
}

export const EtablissementsContext = createContext<
  EtablissementsContextValue | undefined
>(undefined)

export function loadEtablissements(): EtablissementAEIM[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)

    return Array.isArray(parsed)
      ? (parsed as EtablissementAEIM[])
      : []
  } catch {
    return []
  }
}

export function createId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `etablissement-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}



export function useEtablissements() {
  const context = useContext(
    EtablissementsContext,
  )

  if (!context) {
    throw new Error(
      'useEtablissements doit être utilisé dans EtablissementsProvider',
    )
  }

  return context
}

import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

import { type MouvementMateriel, type NouveauMouvementMateriel } from '../types/suiviMateriel'

export const STORAGE_KEY =
  'ob-suivi-caisse-tpe-v1'

export type SuiviMaterielContextValue = {
  mouvements: MouvementMateriel[]
  setMouvements: Dispatch<
    SetStateAction<MouvementMateriel[]>
  >
  createMouvement: (
    input: NouveauMouvementMateriel,
  ) => string
  updateMouvement: (
    id: string,
    input: NouveauMouvementMateriel,
  ) => void
  deleteMouvement: (
    id: string,
  ) => void
}

export const SuiviMaterielContext =
  createContext<
    SuiviMaterielContextValue | undefined
  >(undefined)

export function loadMouvements():
  MouvementMateriel[] {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY,
      )

    if (!raw) return []

    const parsed: unknown =
      JSON.parse(raw)

    return Array.isArray(parsed)
      ? (parsed as MouvementMateriel[])
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

  return `suivi-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}



export function useSuiviMateriel() {
  const context = useContext(
    SuiviMaterielContext,
  )

  if (!context) {
    throw new Error(
      'useSuiviMateriel doit être utilisé dans SuiviMaterielProvider',
    )
  }

  return context
}

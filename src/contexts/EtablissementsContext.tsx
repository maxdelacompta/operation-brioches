import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import type {
  EtablissementAEIM,
  NouvelEtablissementAEIM,
} from '../types/etablissements'

const STORAGE_KEY = 'ob-etablissements-aeim-v1'

type EtablissementsContextValue = {
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

const EtablissementsContext = createContext<
  EtablissementsContextValue | undefined
>(undefined)

function loadEtablissements(): EtablissementAEIM[] {
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

function createId() {
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

export function EtablissementsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [etablissements, setEtablissements] =
    useState<EtablissementAEIM[]>(
      loadEtablissements,
    )

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(etablissements),
    )
  }, [etablissements])

  const value = useMemo<
    EtablissementsContextValue
  >(
    () => ({
      etablissements,
      setEtablissements,

      createEtablissement: (input) => {
        const id = createId()
        const now = new Date().toISOString()

        setEtablissements((current) => [
          ...current,
          {
            ...input,
            id,
            createdAt: now,
            updatedAt: now,
          },
        ])

        return id
      },

      updateEtablissement: (id, input) => {
        setEtablissements((current) =>
          current.map((etablissement) =>
            etablissement.id === id
              ? {
                  ...etablissement,
                  ...input,
                  updatedAt:
                    new Date().toISOString(),
                }
              : etablissement,
          ),
        )
      },

      toggleEtablissementActif: (id) => {
        setEtablissements((current) =>
          current.map((etablissement) =>
            etablissement.id === id
              ? {
                  ...etablissement,
                  statut:
                    etablissement.statut ===
                    'ACTIF'
                      ? 'INACTIF'
                      : 'ACTIF',
                  updatedAt:
                    new Date().toISOString(),
                }
              : etablissement,
          ),
        )
      },

      getEtablissementById: (id) =>
        etablissements.find(
          (etablissement) =>
            etablissement.id === id,
        ),

      getEtablissementsLivraison: () =>
        etablissements.filter(
          (etablissement) =>
            etablissement.statut === 'ACTIF' &&
            etablissement
              .participeOperationBrioches &&
            etablissement
              .peutEffectuerLivraisons,
        ),
    }),
    [etablissements],
  )

  return (
    <EtablissementsContext.Provider value={value}>
      {children}
    </EtablissementsContext.Provider>
  )
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

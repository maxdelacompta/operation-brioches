import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { type EtablissementAEIM } from '../types/etablissements'
import { STORAGE_KEY, type EtablissementsContextValue, EtablissementsContext, loadEtablissements, createId } from "./EtablissementsContext"

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

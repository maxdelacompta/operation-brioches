import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { type MouvementMateriel } from '../types/suiviMateriel'
import { STORAGE_KEY, type SuiviMaterielContextValue, SuiviMaterielContext, loadMouvements, createId } from "./SuiviMaterielContext"

export function SuiviMaterielProvider({
  children,
}: {
  children: ReactNode
}) {
  const [
    mouvements,
    setMouvements,
  ] = useState<
    MouvementMateriel[]
  >(loadMouvements)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(mouvements),
    )
  }, [mouvements])

  const value = useMemo<
    SuiviMaterielContextValue
  >(
    () => ({
      mouvements,
      setMouvements,

      createMouvement: (
        input,
      ) => {
        const id = createId()
        const now =
          new Date().toISOString()

        setMouvements(
          (current) => [
            ...current,
            {
              ...input,
              id,
              createdAt: now,
              updatedAt: now,
            },
          ],
        )

        return id
      },

      updateMouvement: (
        id,
        input,
      ) => {
        setMouvements(
          (current) =>
            current.map(
              (mouvement) =>
                mouvement.id === id
                  ? {
                      ...mouvement,
                      ...input,
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : mouvement,
            ),
        )
      },

      deleteMouvement: (
        id,
      ) => {
        setMouvements(
          (current) =>
            current.filter(
              (mouvement) =>
                mouvement.id !== id,
            ),
        )
      },
    }),
    [mouvements],
  )

  return (
    <SuiviMaterielContext.Provider
      value={value}
    >
      {children}
    </SuiviMaterielContext.Provider>
  )
}

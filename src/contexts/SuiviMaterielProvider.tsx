import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import { type MouvementMateriel } from '../types/suiviMateriel'
import { STORAGE_KEY, type SuiviMaterielContextValue, SuiviMaterielContext, loadMouvements, createId } from "./SuiviMaterielContext"

export function SuiviMaterielProvider({
  children,
}: {
  children: ReactNode
}) {
  const canWrite = useCampaignWriteAccess()
  const [
    mouvements,
    setMouvementsState,
  ] = useState<
    MouvementMateriel[]
  >(loadMouvements)
  const setMouvements = useCallback<Dispatch<SetStateAction<MouvementMateriel[]>>>(next => {
    if (canWrite) setMouvementsState(next)
  }, [canWrite])

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
        if (!canWrite) throw new Error('Campagne inactive : mouvement interdit.')
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
        if (!canWrite) throw new Error('Campagne inactive : modification interdite.')
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
        if (!canWrite) throw new Error('Campagne inactive : suppression interdite.')
        setMouvements(
          (current) =>
            current.filter(
              (mouvement) =>
                mouvement.id !== id,
            ),
        )
      },
    }),
    [mouvements, canWrite, setMouvements],
  )

  return (
    <SuiviMaterielContext.Provider
      value={value}
    >
      {children}
    </SuiviMaterielContext.Provider>
  )
}

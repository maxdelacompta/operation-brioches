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
  MouvementMateriel,
  NouveauMouvementMateriel,
} from '../types/suiviMateriel'

const STORAGE_KEY =
  'ob-suivi-caisse-tpe-v1'

type SuiviMaterielContextValue = {
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

const SuiviMaterielContext =
  createContext<
    SuiviMaterielContextValue | undefined
  >(undefined)

function loadMouvements():
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

function createId() {
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

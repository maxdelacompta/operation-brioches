import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { type CommandeMairieRs } from '../types/commandesMairiesRs'
import { STORAGE_KEY, type CommandesMairiesRsContextValue, CommandesMairiesRsContext, createId, nextNumero, loadInitialData } from "./CommandesMairiesRsContext"

export function CommandesMairiesRsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [commandes, setCommandes] =
    useState<CommandeMairieRs[]>(loadInitialData)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(commandes),
    )
  }, [commandes])

  const value = useMemo<CommandesMairiesRsContextValue>(
    () => ({
      commandes,

      createCommande(input) {
        const now = new Date().toISOString()

        const created: CommandeMairieRs = {
          ...input,
          id: createId(),
          numero: nextNumero(commandes, input.campagne),
          createdAt: now,
          updatedAt: now,
        }

        setCommandes((current) => [
          created,
          ...current,
        ])

        return created
      },

      updateCommande(id, patch) {
        setCommandes((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        )
      },

      deleteCommande(id) {
        setCommandes((current) =>
          current.filter((item) => item.id !== id),
        )
      },
    }),
    [commandes],
  )

  return (
    <CommandesMairiesRsContext.Provider value={value}>
      {children}
    </CommandesMairiesRsContext.Provider>
  )
}

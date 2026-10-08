import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { seedCommandesMairiesRs2026 } from '../data/commandesMairiesRs2026'
import type {
  CommandeMairieRs,
  NouvelleCommandeMairieRs,
} from '../types/commandesMairiesRs'

const STORAGE_KEY = 'ob-commandes-mairies-rs-v1'

type CommandesMairiesRsContextValue = {
  commandes: CommandeMairieRs[]
  createCommande: (value: NouvelleCommandeMairieRs) => CommandeMairieRs
  updateCommande: (id: string, patch: Partial<NouvelleCommandeMairieRs>) => void
  deleteCommande: (id: string) => void
}

const CommandesMairiesRsContext =
  createContext<CommandesMairiesRsContextValue | null>(null)

function createId() {
  return `cmd-mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function campaignYear(campagne: string) {
  const match = campagne.match(/(20\d{2})/)
  return match?.[1] || String(new Date().getFullYear())
}

function nextNumero(
  commandes: CommandeMairieRs[],
  campagne: string,
) {
  const year = campaignYear(campagne)

  const max = commandes.reduce((current, item) => {
    if (item.campagne !== campagne) return current

    const match = item.numero.match(/(\d+)\s*$/)
    const parsed = match ? Number(match[1]) : 0

    return Number.isFinite(parsed)
      ? Math.max(current, parsed)
      : current
  }, 0)

  return `#${year}-${String(max + 1).padStart(3, '0')}`
}

function loadInitialData(): CommandeMairieRs[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedCommandesMairiesRs2026

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed
      : seedCommandesMairiesRs2026
  } catch {
    return seedCommandesMairiesRs2026
  }
}

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

export function useCommandesMairiesRs() {
  const context = useContext(CommandesMairiesRsContext)

  if (!context) {
    throw new Error(
      'useCommandesMairiesRs doit être utilisé dans CommandesMairiesRsProvider',
    )
  }

  return context
}

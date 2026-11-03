import { createContext, useContext } from 'react'

import { seedCommandesMairiesRs2026 } from '../data/commandesMairiesRs2026'
import { type CommandeMairieRs, type NouvelleCommandeMairieRs } from '../types/commandesMairiesRs'

export const STORAGE_KEY = 'ob-commandes-mairies-rs-v1'

export type CommandesMairiesRsContextValue = {
  commandes: CommandeMairieRs[]
  createCommande: (value: NouvelleCommandeMairieRs) => CommandeMairieRs
  updateCommande: (id: string, patch: Partial<NouvelleCommandeMairieRs>) => void
  deleteCommande: (id: string) => void
}

export const CommandesMairiesRsContext =
  createContext<CommandesMairiesRsContextValue | null>(null)

export function createId() {
  return `cmd-mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function campaignYear(campagne: string) {
  const match = campagne.match(/(20\d{2})/)
  return match?.[1] || String(new Date().getFullYear())
}

export function nextNumero(
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

export function loadInitialData(): CommandeMairieRs[] {
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



export function useCommandesMairiesRs() {
  const context = useContext(CommandesMairiesRsContext)

  if (!context) {
    throw new Error(
      'useCommandesMairiesRs doit être utilisé dans CommandesMairiesRsProvider',
    )
  }

  return context
}

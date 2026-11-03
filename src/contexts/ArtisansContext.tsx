import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import { type Artisan, type CommandeArtisan, type Fournisseur } from '../types/artisans'

export const LEGACY_ARTISANS_KEY = 'ob-artisans-v1'
export const FOURNISSEURS_KEY = 'ob-fournisseurs-v1'
export const COMMANDES_KEY = 'ob-commandes-artisans-v1'

export function lireTableau<T>(cle: string, initial: T[]): T[] {
  try {
    const brut = localStorage.getItem(cle)
    if (brut === null) return initial
    const parsed: unknown = JSON.parse(brut)
    return Array.isArray(parsed) ? parsed as T[] : initial
  } catch {
    return initial
  }
}

/** Migration non destructive : priorité à la nouvelle base si elle existe. */
export function chargerFournisseurs(): Fournisseur[] {
  try {
    const brut = localStorage.getItem(FOURNISSEURS_KEY)
    if (brut !== null) {
      const parsed: unknown = JSON.parse(brut)
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          ...(item as Fournisseur),
          type: (item as Fournisseur).type === 'GMS'
            ? 'GMS' as const
            : (item as Fournisseur).type === 'INDUSTRIEL'
              ? 'INDUSTRIEL' as const
              : 'ARTISAN' as const,
        }))
      }
    }
  } catch {
    // Une base illisible n'efface pas les données historiques.
  }

  return lireTableau<Artisan>(LEGACY_ARTISANS_KEY, [])
    .map(artisan => ({ ...artisan, type: 'ARTISAN' as const }))
}

type ArtisansContextValue = {
  fournisseurs: Fournisseur[]
  setFournisseurs: Dispatch<SetStateAction<Fournisseur[]>>
  /** Interface historique conservée pour CommandesArtisans et PlanningArtisans. */
  artisans: Artisan[]
  setArtisans: Dispatch<SetStateAction<Artisan[]>>
  commandesArtisans: CommandeArtisan[]
  setCommandesArtisans: Dispatch<SetStateAction<CommandeArtisan[]>>
}

export const Context = createContext<ArtisansContextValue | null>(null)



export function useArtisans() {
  const context = useContext(Context)
  if (!context) {
    throw new Error('Ce module doit être enveloppé par ArtisansProvider dans App.tsx.')
  }
  return context
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { Artisan, CommandeArtisan, Fournisseur } from '../types/artisans'
import { initialArtisans } from '../data/initialArtisans'
import { initialCommandesArtisans } from '../data/initialCommandesArtisans'

const LEGACY_ARTISANS_KEY = 'ob-artisans-v1'
const FOURNISSEURS_KEY = 'ob-fournisseurs-v1'
const COMMANDES_KEY = 'ob-commandes-artisans-v1'

function lireTableau<T>(cle: string, initial: T[]): T[] {
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
function chargerFournisseurs(): Fournisseur[] {
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

  return lireTableau<Artisan>(LEGACY_ARTISANS_KEY, initialArtisans)
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

const Context = createContext<ArtisansContextValue | null>(null)

export function ArtisansProvider({ children }: { children: ReactNode }) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>(chargerFournisseurs)
  const [commandesArtisans, setCommandesArtisans] = useState<CommandeArtisan[]>(() =>
    lireTableau(COMMANDES_KEY, initialCommandesArtisans),
  )

  const artisans = useMemo(
    () => fournisseurs.filter(fournisseur => fournisseur.type === 'ARTISAN'),
    [fournisseurs],
  )

  // Les composants de la V1 qui appellent setArtisans continuent à fonctionner.
  // La mise à jour ne touche jamais aux fiches GMS ou industrielles.
  const setArtisans = useCallback<Dispatch<SetStateAction<Artisan[]>>>(miseAJour => {
    setFournisseurs(anciens => {
      const anciensArtisans = anciens.filter(f => f.type === 'ARTISAN')
      const suivants = typeof miseAJour === 'function'
        ? miseAJour(anciensArtisans)
        : miseAJour
      const autresFournisseurs = anciens.filter(f => f.type !== 'ARTISAN')
      return [...autresFournisseurs, ...suivants.map(a => ({ ...a, type: 'ARTISAN' as const }))]
    })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FOURNISSEURS_KEY, JSON.stringify(fournisseurs))
      // Maintenir le format historique afin de ne pas casser un éventuel autre module.
      localStorage.setItem(LEGACY_ARTISANS_KEY, JSON.stringify(artisans))
    } catch (error) {
      console.error('Sauvegarde des fournisseurs impossible :', error)
    }
  }, [fournisseurs, artisans])

  useEffect(() => {
    try {
      localStorage.setItem(COMMANDES_KEY, JSON.stringify(commandesArtisans))
    } catch (error) {
      console.error('Sauvegarde des commandes artisans impossible :', error)
    }
  }, [commandesArtisans])

  return (
    <Context.Provider value={{
      fournisseurs, setFournisseurs, artisans, setArtisans,
      commandesArtisans, setCommandesArtisans,
    }}>
      {children}
    </Context.Provider>
  )
}

export function useArtisans() {
  const context = useContext(Context)
  if (!context) {
    throw new Error('Ce module doit être enveloppé par ArtisansProvider dans App.tsx.')
  }
  return context
}

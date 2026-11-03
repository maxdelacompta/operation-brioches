import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { type Artisan, type CommandeArtisan, type Fournisseur } from '../types/artisans'
import { LEGACY_ARTISANS_KEY, FOURNISSEURS_KEY, COMMANDES_KEY, lireTableau, chargerFournisseurs, Context } from "./ArtisansContext"

export function ArtisansProvider({ children }: { children: ReactNode }) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>(chargerFournisseurs)
  const [commandesArtisans, setCommandesArtisans] = useState<CommandeArtisan[]>(() =>
    lireTableau(COMMANDES_KEY, []),
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

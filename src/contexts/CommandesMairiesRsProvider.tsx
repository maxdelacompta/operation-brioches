import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import { useUsers } from './UsersContext'
import { useObData } from './ObDataContext'
import { normalizeImportText } from '../lib/commandesMairiesRsImport'
import { type CommandeMairieRs } from '../types/commandesMairiesRs'
import { STORAGE_KEY, type CommandesMairiesRsContextValue, CommandesMairiesRsContext, createId, nextNumero, loadInitialData } from "./CommandesMairiesRsContext"

export function CommandesMairiesRsProvider({
  children,
}: {
  children: ReactNode
}) {
  const canWrite = useCampaignWriteAccess()
  const { currentUser } = useUsers()
  const { selectedCampagne, activeCampagne, fichesCaisse } = useObData()
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
        if (!canWrite) throw new Error('Campagne inactive : création interdite.')
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
        if (!canWrite) throw new Error('Campagne inactive : modification interdite.')
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

      importCommandes(rows) {
        if (currentUser?.role !== 'administrateur') {
          throw new Error('Seul un administrateur peut importer des commandes Mairies & RS.')
        }
        if (!canWrite) throw new Error('Campagne non modifiable.')
        const targetCampaign = (selectedCampagne ?? activeCampagne)?.id
        if (!targetCampaign || rows.some(row => row.value.campagne !== targetCampaign)) {
          throw new Error('La campagne du fichier doit correspondre à celle sélectionnée dans la Topbar.')
        }
        const now = new Date().toISOString()
        const newlyCreated: CommandeMairieRs[] = []
        const used = new Set(commandes.map(item => `${item.campagne}::${normalizeImportText(item.numero)}`))
        let skipped = 0
        for (const row of rows) {
          if (!row.value.quiPasseCommande.trim() || !row.value.secteur.trim() || !Number.isInteger(row.value.quantite) || row.value.quantite <= 0) {
            throw new Error('Import interrompu : une commande comporte des données obligatoires invalides.')
          }
          const numero = row.sourceNumero.trim() || nextNumero([...commandes, ...newlyCreated], row.value.campagne)
          const key = `${row.value.campagne}::${normalizeImportText(numero)}`
          if (used.has(key)) { skipped += 1; continue }
          used.add(key)
          newlyCreated.push({
            ...row.value,
            id: createId(),
            numero,
            createdAt: now,
            updatedAt: now,
          })
        }
        if (newlyCreated.length) {
          setCommandes(current => [...newlyCreated, ...current])
        }
        return { imported: newlyCreated.length, skipped }
      },

      deleteCommande(id) {
        if (!canWrite) throw new Error('Campagne inactive : suppression interdite.')
        if (fichesCaisse.some(fiche => fiche.commandeMairieRsId === id)) {
          throw new Error('Suppression impossible : cette commande possède des fiches de caisse liées. Conservez-la pour préserver la traçabilité.')
        }
        setCommandes((current) =>
          current.filter((item) => item.id !== id),
        )
      },
    }),
    [commandes, canWrite, currentUser?.role, selectedCampagne, activeCampagne, fichesCaisse],
  )

  return (
    <CommandesMairiesRsContext.Provider value={value}>
      {children}
    </CommandesMairiesRsContext.Provider>
  )
}

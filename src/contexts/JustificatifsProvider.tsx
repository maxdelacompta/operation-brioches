import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import { useUsers } from './UsersContext'
import type { JustificatifAImporter } from '../lib/justificatifsImport'
import { type Dispatch, type SetStateAction } from 'react'
import { type JustificatifDon, type NouveauJustificatif } from '../types/justificatifs'
import { STORAGE_KEY, type JustificatifsContextValue, JustificatifsContext, makeId, nowIso, loadJustificatifs, createNumber } from "./JustificatifsContext"

export function JustificatifsProvider({
  children,
}: {
  children: ReactNode
}) {
  const canWrite = useCampaignWriteAccess()
  const { currentUser } = useUsers()
  const [justificatifs, setJustificatifsState] =
    useState<JustificatifDon[]>(loadJustificatifs)
  const setJustificatifs = useCallback<Dispatch<SetStateAction<JustificatifDon[]>>>(update => {
    if (canWrite) setJustificatifsState(update)
  }, [canWrite])

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(justificatifs),
      )
    } catch {
      console.warn(
        'La sauvegarde locale des justificatifs est indisponible.',
      )
    }
  }, [justificatifs])

  const createJustificatif = useCallback(
    function createJustificatif(
    input: NouveauJustificatif,
  ): JustificatifDon {
    if (!canWrite) throw new Error('Campagne inactive : création de justificatif interdite.')
    const id = makeId()
    const date = nowIso()
    const numero = createNumber(
      justificatifs,
      input.type,
      input.campagne,
    )
    const montant =
      Math.max(0, input.nbBrioches) *
      Math.max(0, input.prixUnitaire)

    const next: JustificatifDon = {
      ...input,
      id,
      numero,
      montant,
      version: 1,
      createdAt: date,
      updatedAt: date,
      historique: [
        {
          id: makeId('history'),
          date,
          action: 'Création',
          detail: `${input.type} ${numero}`,
        },
      ],
    }

    setJustificatifs((current) => [...current, next])

    return next
  }, [justificatifs, setJustificatifs, canWrite])

  const importerJustificatifs = useCallback((documents: JustificatifAImporter[]) => {
    if (currentUser?.role !== 'administrateur') throw new Error('Import réservé aux administrateurs.')
    if (!canWrite) throw new Error('La campagne sélectionnée est en consultation seule.')
    if (!documents.length) return
    const numeros = new Set(justificatifs.map(j => `${j.campagne}|${j.numero.toLocaleLowerCase('fr')}`))
    const campagnes = new Set(documents.map(document => document.campagne))
    if (campagnes.size !== 1) throw new Error('Un lot doit appartenir à une seule campagne.')
    for (const document of documents) {
      const cle = `${document.campagne}|${document.numero.toLocaleLowerCase('fr')}`
      if (numeros.has(cle)) throw new Error(`Numéro de justificatif déjà présent : ${document.numero}`)
      numeros.add(cle)
    }
    const horodatage = nowIso()
    const nouveaux: JustificatifDon[] = documents.map(document => ({
      ...document,
      id: makeId('jd'),
      montant: Math.round(document.nbBrioches * document.prixUnitaire * 100) / 100,
      statut: 'A_VERIFIER',
      documentStatut: 'A_GENERER',
      version: 1,
      createdAt: horodatage,
      updatedAt: horodatage,
      historique: [{
        id: makeId('history'), date: horodatage, action: 'Import CSV / Excel',
        detail: `Importé par ${currentUser.name} · PDF non importé · envoi non confirmé`,
      }],
    }))
    setJustificatifs(current => [...current, ...nouveaux])
  }, [canWrite, currentUser, justificatifs, setJustificatifs])

  const updateJustificatif = useCallback(
    function updateJustificatif(
    id: string,
    patch: Partial<JustificatifDon>,
    historyLabel = 'Modification',
  ) {
    if (!canWrite) throw new Error('Campagne inactive : modification de justificatif interdite.')
    const date = nowIso()

    setJustificatifs((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item
        }

        const nextNbBrioches =
          patch.nbBrioches ?? item.nbBrioches
        const nextPrixUnitaire =
          patch.prixUnitaire ?? item.prixUnitaire

        return {
          ...item,
          ...patch,
          montant:
            Math.max(0, nextNbBrioches) *
            Math.max(0, nextPrixUnitaire),
          updatedAt: date,
          historique: [
            ...item.historique,
            {
              id: makeId('history'),
              date,
              action: historyLabel,
            },
          ],
        }
      }),
    )
  }, [setJustificatifs, canWrite])

  const markDocumentGenerated = useCallback(
    function markDocumentGenerated(
    id: string,
    meta?: {
      modeleNom?: string
      modeleVersion?: number
      modeleCampagneId?: string
      modeReglementGenere?: string
    },
  ) {
    updateJustificatif(
      id,
      {
        documentStatut: 'GENERE',
        statut: 'EMIS',
        version:
          (justificatifs.find((item) => item.id === id)
            ?.version ?? 0) + 1,
        modeleNom: meta?.modeleNom,
        modeleVersion: meta?.modeleVersion,
        modeleCampagneId: meta?.modeleCampagneId,
        modeReglementGenere: meta?.modeReglementGenere,
      },
      'Document généré',
    )
  }, [justificatifs, updateJustificatif])

  const markSent = useCallback(
    function markSent(id: string) {
    const date = nowIso()

    updateJustificatif(
      id,
      {
        documentStatut: 'ENVOYE',
        statut: 'ENVOYE',
        dateEnvoi: date,
      },
      'Document marqué comme envoyé',
    )
  }, [updateJustificatif])

  const archiveJustificatif = useCallback(
    function archiveJustificatif(id: string) {
    updateJustificatif(
      id,
      {
        statut: 'ARCHIVE',
      },
      'Archivage',
    )
  }, [updateJustificatif])

  const convertJdiToJdp = useCallback(
    function convertJdiToJdp(id: string): string {
    if (!canWrite) throw new Error('Campagne inactive : conversion de justificatif interdite.')
    const source = justificatifs.find(
      (item) => item.id === id,
    )

    if (!source) {
      throw new Error('Justificatif introuvable.')
    }

    if (source.type !== 'JDI') {
      throw new Error('Seul un JDI peut être converti en JDP.')
    }

    const newId = makeId()
    const date = nowIso()
    const numero = createNumber(
      justificatifs,
      'JDP',
      source.campagne,
    )

    const next: JustificatifDon = {
      ...source,
      id: newId,
      numero,
      type: 'JDP',
      statut: 'A_VERIFIER',
      paiementStatut: 'PAYE',
      documentStatut: 'A_GENERER',
      datePaiement: source.datePaiement || date.slice(0, 10),
      dateEnvoi: undefined,
      parentJustificatifId: source.id,
      version: 1,
      createdAt: date,
      updatedAt: date,
      historique: [
        {
          id: makeId('history'),
          date,
          action: 'Création depuis un JDI',
          detail: `Issu de ${source.numero}`,
        },
      ],
    }

    setJustificatifs((current) => [
      ...current.map((item) =>
        item.id === source.id
          ? {
              ...item,
              updatedAt: date,
              historique: [
                ...item.historique,
                {
                  id: makeId('history'),
                  date,
                  action: 'Conversion en JDP',
                  detail: `Nouveau justificatif : ${numero}`,
                },
              ],
            }
          : item,
      ),
      next,
    ])

    return newId
  }, [justificatifs, setJustificatifs, canWrite])

  const value = useMemo<JustificatifsContextValue>(
    () => ({
      justificatifs,
      createJustificatif,
      importerJustificatifs,
      updateJustificatif,
      markDocumentGenerated,
      markSent,
      archiveJustificatif,
      convertJdiToJdp,
    }),
    [justificatifs, createJustificatif, importerJustificatifs, updateJustificatif, markDocumentGenerated, markSent, archiveJustificatif, convertJdiToJdp],
  )

  return (
    <JustificatifsContext.Provider value={value}>
      {children}
    </JustificatifsContext.Provider>
  )
}

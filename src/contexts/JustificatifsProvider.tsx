import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { type JustificatifDon, type NouveauJustificatif } from '../types/justificatifs'
import { STORAGE_KEY, type JustificatifsContextValue, JustificatifsContext, makeId, nowIso, loadJustificatifs, createNumber } from "./JustificatifsContext"

export function JustificatifsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [justificatifs, setJustificatifs] =
    useState<JustificatifDon[]>(loadJustificatifs)

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
  }, [justificatifs])

  const updateJustificatif = useCallback(
    function updateJustificatif(
    id: string,
    patch: Partial<JustificatifDon>,
    historyLabel = 'Modification',
  ) {
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
  }, [])

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
  }, [justificatifs])

  const value = useMemo<JustificatifsContextValue>(
    () => ({
      justificatifs,
      createJustificatif,
      updateJustificatif,
      markDocumentGenerated,
      markSent,
      archiveJustificatif,
      convertJdiToJdp,
    }),
    [justificatifs, createJustificatif, updateJustificatif, markDocumentGenerated, markSent, archiveJustificatif, convertJdiToJdp],
  )

  return (
    <JustificatifsContext.Provider value={value}>
      {children}
    </JustificatifsContext.Provider>
  )
}

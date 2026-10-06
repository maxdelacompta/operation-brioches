import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type {
  JustificatifDon,
  NouveauJustificatif,
} from '../types/justificatifs'

const STORAGE_KEY = 'ob-justificatifs-dons-v1'

type JustificatifsContextValue = {
  justificatifs: JustificatifDon[]
  createJustificatif: (input: NouveauJustificatif) => JustificatifDon
  updateJustificatif: (
    id: string,
    patch: Partial<JustificatifDon>,
    historyLabel?: string,
  ) => void
  markDocumentGenerated: (
    id: string,
    meta?: {
      modeleNom?: string
      modeleVersion?: number
      modeleCampagneId?: string
      modeReglementGenere?: string
    },
  ) => void
  markSent: (id: string) => void
  archiveJustificatif: (id: string) => void
  convertJdiToJdp: (id: string) => string
}

const JustificatifsContext = createContext<
  JustificatifsContextValue | undefined
>(undefined)

function makeId(prefix = 'jd') {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

function loadJustificatifs(): JustificatifDon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is JustificatifDon =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.numero === 'string' &&
            (item.type === 'JDI' || item.type === 'JDP'),
        ),
    )
  } catch {
    return []
  }
}

function getCampaignYear(campagne: string) {
  const match = campagne.match(/(20\d{2})/)

  if (match) {
    return match[1]
  }

  return String(new Date().getFullYear())
}

function createNumber(
  current: JustificatifDon[],
  type: JustificatifDon['type'],
  campagne: string,
) {
  const year = getCampaignYear(campagne)
  const prefix = `${type}-${year}-`

  const max = current.reduce((value, item) => {
    if (!item.numero.startsWith(prefix)) {
      return value
    }

    const sequence = Number(item.numero.slice(prefix.length))

    return Number.isFinite(sequence)
      ? Math.max(value, sequence)
      : value
  }, 0)

  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

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
  }

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
  }

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
  }

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
  }

  function archiveJustificatif(id: string) {
    updateJustificatif(
      id,
      {
        statut: 'ARCHIVE',
      },
      'Archivage',
    )
  }

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
  }

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
    [justificatifs],
  )

  return (
    <JustificatifsContext.Provider value={value}>
      {children}
    </JustificatifsContext.Provider>
  )
}

export function useJustificatifs() {
  const context = useContext(JustificatifsContext)

  if (!context) {
    throw new Error(
      'useJustificatifs doit être utilisé dans JustificatifsProvider.',
    )
  }

  return context
}

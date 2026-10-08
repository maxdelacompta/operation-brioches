import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type {
  Mairie,
  NouvelleMairie,
} from '../types/mairies'

const STORAGE_KEY = 'ob-bdd-mairies-v1'

const seedMairies: Mairie[] = [
  {
    id: 'mairie-toul',
    code: 'M-042',
    statut: 'ACTIVE',
    commune: 'Toul',
    nomAffiche: 'Ville de Toul',
    codeInsee: '54528',
    secteur: 'Toul',
    numeroVoie: '13',
    adresse: 'rue de Rigny',
    cp: '54200',
    ville: 'Toul',
    contactNom: 'Dupont',
    contactPrenom: 'Sophie',
    contactFonction: 'Service animations',
    email: 'mairie@toul.fr',
    telephone: '03 83 63 70 00',
    participation: 'OUI',
    nombreBriochesN1: 150,
    modeReglement: 'Mandat administratif',
    lieuInfos: 'Salle des fêtes',
    notes: 'Partenaire fidèle depuis plusieurs années. Très bon relais de communication locale.',
    participations: [
      {
        id: 'toul-2026',
        campagne: 'OB 2026',
        statut: 'OUI',
        nombreBrioches: 150,
        modeReglement: 'Mandat administratif',
        lieuInfos: 'Salle des fêtes',
        remarque: '',
      },
    ],
    documents: [
      {
        id: 'toul-conv',
        type: 'CONVENTION',
        libelle: 'Convention',
        statut: 'OUI',
        date: '2026-09-12',
        remarque: '',
      },
      {
        id: 'toul-auto',
        type: 'AUTORISATION',
        libelle: 'Autorisation',
        statut: 'OUI',
        date: '2026-09-05',
        remarque: '',
      },
    ],
    historique: [
      {
        id: 'toul-h1',
        date: '2026-09-12',
        libelle: 'Convention enregistrée',
      },
      {
        id: 'toul-h2',
        date: '2026-09-05',
        libelle: 'Autorisation reçue',
      },
    ],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
  },
  {
    id: 'mairie-bruley',
    code: 'M-018',
    statut: 'ACTIVE',
    commune: 'Bruley',
    nomAffiche: 'Mairie de Bruley',
    codeInsee: '54102',
    secteur: 'Toul',
    numeroVoie: '36',
    adresse: 'rue Victor Hugo',
    cp: '54200',
    ville: 'Bruley',
    contactNom: 'Bugnet',
    contactPrenom: 'Mireille',
    contactFonction: 'Mairie',
    email: 'commune.de.bruley@orange.fr',
    telephone: '03 83 62 90 00',
    participation: 'OUI',
    nombreBriochesN1: 150,
    modeReglement: 'Virement',
    lieuInfos: '',
    notes: '',
    participations: [],
    documents: [],
    historique: [],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'mairie-nancy',
    code: 'M-071',
    statut: 'ACTIVE',
    commune: 'Nancy',
    nomAffiche: 'Ville de Nancy',
    codeInsee: '54395',
    secteur: 'Nancy',
    numeroVoie: '',
    adresse: '',
    cp: '54000',
    ville: 'Nancy',
    contactNom: '',
    contactPrenom: '',
    contactFonction: 'Service animations',
    email: 'contact@nancy.fr',
    telephone: '03 83 85 30 00',
    participation: 'A_CONTACTER',
    nombreBriochesN1: null,
    modeReglement: '',
    lieuInfos: '',
    notes: '',
    participations: [],
    documents: [],
    historique: [],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'mairie-ludres',
    code: 'M-095',
    statut: 'ACTIVE',
    commune: 'Ludres',
    nomAffiche: 'Commune de Ludres',
    codeInsee: '54328',
    secteur: 'Nancy Sud',
    numeroVoie: '',
    adresse: '',
    cp: '54710',
    ville: 'Ludres',
    contactNom: 'Martin',
    contactPrenom: 'Caroline',
    contactFonction: 'Vie associative',
    email: 'mairie@ludres.fr',
    telephone: '03 83 26 11 11',
    participation: 'NON',
    nombreBriochesN1: 0,
    modeReglement: '',
    lieuInfos: '',
    notes: '',
    participations: [],
    documents: [],
    historique: [],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'mairie-laxou',
    code: 'M-103',
    statut: 'ACTIVE',
    commune: 'Laxou',
    nomAffiche: 'Mairie de Laxou',
    codeInsee: '54304',
    secteur: 'Nancy',
    numeroVoie: '',
    adresse: '',
    cp: '54520',
    ville: 'Laxou',
    contactNom: 'Morel',
    contactPrenom: 'Julien',
    contactFonction: 'Vie associative',
    email: 'vie-associative@laxou.fr',
    telephone: '03 83 90 54 54',
    participation: 'OUI',
    nombreBriochesN1: 90,
    modeReglement: 'Mandat administratif',
    lieuInfos: '',
    notes: '',
    participations: [],
    documents: [],
    historique: [],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
]

type MairiesContextValue = {
  mairies: Mairie[]
  createMairie: (value: NouvelleMairie) => Mairie
  updateMairie: (id: string, patch: Partial<NouvelleMairie>) => void
  archiveMairie: (id: string) => void
  restoreMairie: (id: string) => void
}

const MairiesContext = createContext<MairiesContextValue | null>(null)

function createId() {
  return `mairie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function MairiesProvider({ children }: { children: ReactNode }) {
  const [mairies, setMairies] = useState<Mairie[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return seedMairies
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : seedMairies
    } catch {
      return seedMairies
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mairies))
  }, [mairies])

  const value = useMemo<MairiesContextValue>(() => ({
    mairies,
    createMairie(input) {
      const now = new Date().toISOString()
      const item: Mairie = {
        ...input,
        id: createId(),
        historique: [
          { id: createId(), date: now.slice(0, 10), libelle: 'Fiche mairie créée' },
        ],
        createdAt: now,
        updatedAt: now,
      }
      setMairies((current) => [item, ...current])
      return item
    },
    updateMairie(id, patch) {
      const now = new Date().toISOString()
      setMairies((current) => current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              updatedAt: now,
              historique: [
                { id: createId(), date: now.slice(0, 10), libelle: 'Fiche mairie modifiée' },
                ...item.historique,
              ],
            }
          : item,
      ))
    },
    archiveMairie(id) {
      setMairies((current) => current.map((item) =>
        item.id === id ? { ...item, statut: 'ARCHIVEE', updatedAt: new Date().toISOString() } : item,
      ))
    },
    restoreMairie(id) {
      setMairies((current) => current.map((item) =>
        item.id === id ? { ...item, statut: 'ACTIVE', updatedAt: new Date().toISOString() } : item,
      ))
    },
  }), [mairies])

  return <MairiesContext.Provider value={value}>{children}</MairiesContext.Provider>
}

export function useMairies() {
  const context = useContext(MairiesContext)
  if (!context) {
    throw new Error('useMairies doit être utilisé dans MairiesProvider')
  }
  return context
}

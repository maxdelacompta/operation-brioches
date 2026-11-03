import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

import { type Campagne, type CampagneDetails, type Commande, type Donateur, type DepotBanque, type FicheCaisse, type NouvelleCampagne } from '../types/ob'









/* =========================================================
   CLÉS DE STOCKAGE

   On conserve les anciennes clés.
   Les dépôts utilisent une nouvelle clé.
   ========================================================= */

export const DONATEURS_KEY = 'ob-donateurs'

export const COMMANDES_KEY = 'ob-commandes'

export const FICHES_KEY = 'ob-fiches-caisse'

export const CAMPAGNES_KEY = 'ob-campagnes-v1'

export const DEPOTS_KEY = 'ob-depots-banque-v1'

/* =========================================================
   CHARGEMENT DES TABLEAUX
   ========================================================= */

export function loadArray<T>(
  key: string,
  fallback: T[],
): T[] {
  try {
    const saved = localStorage.getItem(key)

    if (!saved) {
      return fallback
    }

    const parsed: unknown = JSON.parse(saved)

    return Array.isArray(parsed)
      ? parsed as T[]
      : fallback
  } catch {
    return fallback
  }
}

/* =========================================================
   EXTRACTION DE L'ANNÉE

   Exemple : "OB 2026" => 2026
   ========================================================= */

function getYearFromCode(
  code: string,
): number | null {
  const match = code.match(
    /\b(?:19|20)\d{2}\b/,
  )

  return match
    ? Number(match[0])
    : null
}

/* =========================================================
   RECONSTITUTION D'UNE ANCIENNE CAMPAGNE

   Permet de conserver les campagnes référencées
   par les commandes et les fiches existantes.
   ========================================================= */

function createLegacyCampagne(
  code: string,
): Campagne {
  const annee = getYearFromCode(code)

  return {
    id: code,

    annee,

    nom: annee
      ? `Opération Brioches ${annee}`
      : code,

    description: '',

    statut:
      code === 'OB 2026'
        ? 'ACTIVE'
        : 'A_CONFIGURER',

    dateDebut: '',
    dateFin: '',

    prixUnitaire: null,

    objectifBrioches: null,
    objectifDonateurs: null,
    budgetPrevisionnel: null,
  }
}

/* =========================================================
   VALIDATION DES CAMPAGNES ENREGISTRÉES
   ========================================================= */

function isCampagne(
  value: unknown,
): value is Campagne {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const item = value as Record<
    string,
    unknown
  >

  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&

    (
      typeof item.annee === 'number' ||
      item.annee === null
    ) &&

    typeof item.nom === 'string' &&

    typeof item.description === 'string' &&

    typeof item.dateDebut === 'string' &&

    typeof item.dateFin === 'string' &&

    (
      item.statut === 'A_CONFIGURER' ||
      item.statut === 'PREPARATION' ||
      item.statut === 'ACTIVE' ||
      item.statut === 'TERMINEE'
    ) &&

    (
      item.prixUnitaire === null ||
      (
        typeof item.prixUnitaire === 'number' &&
        Number.isFinite(item.prixUnitaire)
      )
    ) &&

    (
      item.objectifBrioches === null ||
      typeof item.objectifBrioches === 'number'
    ) &&

    (
      item.objectifDonateurs === null ||
      typeof item.objectifDonateurs === 'number'
    ) &&

    (
      item.budgetPrevisionnel === null ||
      typeof item.budgetPrevisionnel === 'number'
    )
  )
}

/* =========================================================
   CHARGEMENT DES CAMPAGNES
   ========================================================= */

export function loadCampagnes(
  commandes: Commande[],
  fichesCaisse: FicheCaisse[],
): Campagne[] {
  const codes = new Set<string>()

  // On conserve la campagne historique du prototype.

  codes.add('OB 2026')

  // Campagnes référencées par les commandes.

  for (const commande of commandes) {
    if (commande.campagne?.trim()) {
      codes.add(
        commande.campagne.trim(),
      )
    }
  }

  // Campagnes référencées par les fiches de caisse.

  for (const fiche of fichesCaisse) {
    if (fiche.campagne?.trim()) {
      codes.add(
        fiche.campagne.trim(),
      )
    }
  }

  const existing: Campagne[] = []

  try {
    const saved = localStorage.getItem(
      CAMPAGNES_KEY,
    )

    if (saved) {
      const parsed: unknown = JSON.parse(saved)

      if (Array.isArray(parsed)) {
        existing.push(
          ...parsed.filter(isCampagne),
        )
      }
    }
  } catch {
    // Les anciennes références permettent
    // de récupérer les campagnes.
  }

  const result = new Map<
    string,
    Campagne
  >()

  // Les paramètres déjà enregistrés sont prioritaires.

  for (const campagne of existing) {
    result.set(
      campagne.id,
      campagne,
    )
  }

  // Reconstitution des campagnes manquantes.

  for (const code of codes) {
    if (!result.has(code)) {
      result.set(
        code,
        createLegacyCampagne(code),
      )
    }
  }

  const campagnes = [
    ...result.values(),
  ]

  // Une seule campagne peut être active.

  let activeFound = false

  return campagnes.map(
    (campagne) => {
      if (campagne.statut !== 'ACTIVE') {
        return campagne
      }

      if (!activeFound) {
        activeFound = true

        return campagne
      }

      return {
        ...campagne,
        statut: 'PREPARATION',
      }
    },
  )
}

/* =========================================================
   DATE LOCALE

   Format YYYY-MM-DD pour le suivi des dépôts.
   ========================================================= */

export function getLocalDate(): string {
  const date = new Date()

  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/* =========================================================
   IDENTIFIANT UNIQUE POUR LES DÉPÔTS
   ========================================================= */

export function createDepotId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    'depot',
    Date.now(),
    Math.random().toString(36).slice(2),
  ].join('-')
}

/* =========================================================
   TYPE POUR LA CRÉATION D'UN DÉPÔT

   L'identifiant, la date et le statut sont
   définis automatiquement par le contexte.
   ========================================================= */

export type NouveauDepotBanque = Omit<
  DepotBanque,
  'id' | 'date' | 'statut'
>

/* =========================================================
   TYPE DU CONTEXTE
   ========================================================= */

export type ObDataContextValue = {

  /* DONATEURS */

  donateurs: Donateur[]

  setDonateurs: Dispatch<
    SetStateAction<Donateur[]>
  >

  /* COMMANDES */

  commandes: Commande[]

  setCommandes: Dispatch<
    SetStateAction<Commande[]>
  >

  /* FICHES DE CAISSE */

  fichesCaisse: FicheCaisse[]

  setFichesCaisse: Dispatch<
    SetStateAction<FicheCaisse[]>
  >

  /* CAMPAGNES */

  campagnes: Campagne[]

  activeCampagne: Campagne | null

  /** Campagne choisie pour la navigation locale (distincte du statut ACTIVE). */
  selectedCampagne: Campagne | null
  selectedCampagneId: string
  setSelectedCampagneId: (id: string) => void

  /* DÉPÔTS BANCAIRES */

  depotsBanque: DepotBanque[]

  creerDepotBanque: (
    entree: NouveauDepotBanque,
  ) => string

  annulerDepotBanque: (
    id: string,
  ) => void

  /* RECHERCHES */

  getDonateurById: (
    id: number,
  ) => Donateur | undefined

  getCommandesByDonateurId: (
    donateurId: number,
  ) => Commande[]

  getFicheCaisseById: (
    id: number,
  ) => FicheCaisse | undefined

  getCommandesByCampagne: (
    campagneId: string,
  ) => Commande[]

  getFichesByCampagne: (
    campagneId: string,
  ) => FicheCaisse[]

  getDepotsByCampagne: (
    campagneId: string,
  ) => DepotBanque[]

  /* GESTION DES CAMPAGNES */

  createCampagne: (
    input: NouvelleCampagne,
  ) => string

  updateCampagne: (
    id: string,
    details: CampagneDetails,
  ) => void

  duplicateCampagne: (
    id: string,
  ) => string

  activateCampagne: (
    id: string,
  ) => void

  finishCampagne: (
    id: string,
  ) => void
}

/* =========================================================
   CRÉATION DU CONTEXTE
   ========================================================= */

export const ObDataContext = createContext<
  ObDataContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER PRINCIPAL
   ========================================================= */



/* =========================================================
   HOOK D'ACCÈS AUX DONNÉES
   ========================================================= */

export function useObData() {
  const context = useContext(
    ObDataContext,
  )

  if (!context) {
    throw new Error(
      'useObData doit être utilisé dans ObDataProvider.',
    )
  }

  return context
}
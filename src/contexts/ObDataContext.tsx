import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import type {
  Campagne,
  CampagneDetails,
  Commande,
  Donateur,
  FicheCaisse,
  NouvelleCampagne,
} from '../types/ob'

import { initialDonateurs } from '../data/initialDonateurs'
import { initialCommandes } from '../data/initialCommandes'
import { initialFichesCaisse } from '../data/initialFichesCaisse'

/* =========================================================
   STOCKAGE
   ========================================================= */

const CAMPAGNES_KEY = 'ob-campagnes-v1'

function loadArray<T>(
  key: string,
  fallback: T[],
): T[] {
  try {
    const saved = localStorage.getItem(key)

    if (!saved) return fallback

    const parsed: unknown = JSON.parse(saved)

    return Array.isArray(parsed)
      ? (parsed as T[])
      : fallback
  } catch {
    return fallback
  }
}

/* =========================================================
   CAMPAGNES EXISTANTES

   On récupère leurs codes depuis les commandes et
   les fiches de caisse pour préserver leurs relations.
   ========================================================= */

function getYearFromCode(
  code: string,
): number | null {
  const match = code.match(/\b(?:19|20)\d{2}\b/)

  return match ? Number(match[0]) : null
}

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
   VALIDATION MINIMALE DU STOCKAGE
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

  const item = value as Record<string, unknown>

  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    (typeof item.annee === 'number' ||
      item.annee === null) &&
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

function loadCampagnes(
  commandes: Commande[],
  fichesCaisse: FicheCaisse[],
): Campagne[] {
  const codes = new Set<string>()

  // La campagne actuellement utilisée dans le
  // prototype est conservée.
  codes.add('OB 2026')

  for (const commande of commandes) {
    if (commande.campagne?.trim()) {
      codes.add(commande.campagne.trim())
    }
  }

  for (const fiche of fichesCaisse) {
    if (fiche.campagne?.trim()) {
      codes.add(fiche.campagne.trim())
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
    // Récupération depuis les données existantes.
  }

  const result = new Map<string, Campagne>()

  // Les paramètres enregistrés ont priorité.
  for (const campagne of existing) {
    result.set(campagne.id, campagne)
  }

  // Reconstitution des anciennes campagnes
  // référencées mais non encore paramétrées.
  for (const code of codes) {
    if (!result.has(code)) {
      result.set(
        code,
        createLegacyCampagne(code),
      )
    }
  }

  const campagnes = [...result.values()]

  // Une seule campagne peut être active.
  let activeFound = false

  return campagnes.map((campagne) => {
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
  })
}

/* =========================================================
   TYPE DU CONTEXTE
   ========================================================= */

type ObDataContextValue = {
  donateurs: Donateur[]
  commandes: Commande[]
  fichesCaisse: FicheCaisse[]

  campagnes: Campagne[]
  activeCampagne: Campagne | null

  setDonateurs: Dispatch<
    SetStateAction<Donateur[]>
  >

  setCommandes: Dispatch<
    SetStateAction<Commande[]>
  >

  setFichesCaisse: Dispatch<
    SetStateAction<FicheCaisse[]>
  >

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
   CONTEXTE
   ========================================================= */

const ObDataContext = createContext<
  ObDataContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER
   ========================================================= */

export function ObDataProvider({
  children,
}: {
  children: ReactNode
}) {
  /* =======================================================
     DONATEURS — CODE EXISTANT
     ======================================================= */

  const [donateurs, setDonateurs] =
    useState<Donateur[]>(() =>
      loadArray(
        'ob-donateurs',
        initialDonateurs,
      ),
    )

  /* =======================================================
     COMMANDES — CODE EXISTANT
     ======================================================= */

  const [commandes, setCommandes] =
    useState<Commande[]>(() =>
      loadArray(
        'ob-commandes',
        initialCommandes,
      ),
    )

  /* =======================================================
     FICHES DE CAISSE — CODE EXISTANT
     ======================================================= */

  const [fichesCaisse, setFichesCaisse] =
    useState<FicheCaisse[]>(() =>
      loadArray(
        'ob-fiches-caisse',
        initialFichesCaisse,
      ),
    )

  /* =======================================================
     CAMPAGNES — NOUVEAU
     ======================================================= */

  const [campagnes, setCampagnes] =
    useState<Campagne[]>(() =>
      loadCampagnes(
        commandes,
        fichesCaisse,
      ),
    )

  const activeCampagne = useMemo(
    () =>
      campagnes.find(
        (campagne) =>
          campagne.statut === 'ACTIVE',
      ) ?? null,
    [campagnes],
  )

  /* =======================================================
     SAUVEGARDES EXISTANTES
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      'ob-donateurs',
      JSON.stringify(donateurs),
    )
  }, [donateurs])

  useEffect(() => {
    localStorage.setItem(
      'ob-commandes',
      JSON.stringify(commandes),
    )
  }, [commandes])

  useEffect(() => {
    localStorage.setItem(
      'ob-fiches-caisse',
      JSON.stringify(fichesCaisse),
    )
  }, [fichesCaisse])

  /* =======================================================
     SAUVEGARDE CAMPAGNES
     ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        CAMPAGNES_KEY,
        JSON.stringify(campagnes),
      )
    } catch {
      console.warn(
        'Sauvegarde locale des campagnes indisponible.',
      )
    }
  }, [campagnes])

  /* =======================================================
     CRÉER UNE CAMPAGNE
     ======================================================= */

  function createCampagne(
    input: NouvelleCampagne,
  ): string {
    const annee = input.annee
    const id = `OB ${annee}`

    if (
      !Number.isInteger(annee) ||
      annee < 2000 ||
      annee > 2100
    ) {
      throw new Error(
        "L'année de campagne est invalide.",
      )
    }

    if (
      campagnes.some(
        (campagne) =>
          campagne.id === id ||
          campagne.annee === annee,
      )
    ) {
      throw new Error(
        `La campagne ${annee} existe déjà.`,
      )
    }

    if (
      input.dateDebut &&
      input.dateFin &&
      input.dateFin < input.dateDebut
    ) {
      throw new Error(
        'La date de fin précède la date de début.',
      )
    }

    const nouvelle: Campagne = {
      ...input,
      id,
      nom:
        input.nom.trim() ||
        `Opération Brioches ${annee}`,
      statut: 'PREPARATION',
    }

    setCampagnes((current) => [
      ...current,
      nouvelle,
    ])

    return id
  }

  /* =======================================================
     MODIFIER LES PARAMÈTRES
     ======================================================= */

  function updateCampagne(
    id: string,
    details: CampagneDetails,
  ) {
    const target = campagnes.find(
      (campagne) => campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    if (target.statut === 'TERMINEE') {
      throw new Error(
        'Cette campagne est terminée.',
      )
    }

    if (
      details.dateDebut &&
      details.dateFin &&
      details.dateFin < details.dateDebut
    ) {
      throw new Error(
        'La date de fin précède la date de début.',
      )
    }

    setCampagnes((current) =>
      current.map((campagne) =>
        campagne.id === id
          ? {
              ...campagne,
              ...details,
              nom: details.nom.trim(),
              statut:
                campagne.statut === 'A_CONFIGURER'
                  ? 'PREPARATION'
                  : campagne.statut,
            }
          : campagne,
      ),
    )
  }

  /* =======================================================
     DUPLIQUER UNE CAMPAGNE

     Copie les paramètres mais jamais les commandes
     ou les fiches de caisse.
     ======================================================= */

  function duplicateCampagne(
    id: string,
  ): string {
    const source = campagnes.find(
      (campagne) => campagne.id === id,
    )

    if (!source || source.annee === null) {
      throw new Error(
        'Cette campagne ne peut pas être dupliquée.',
      )
    }

    let year = source.annee + 1

    while (
      campagnes.some(
        (campagne) =>
          campagne.annee === year ||
          campagne.id === `OB ${year}`,
      )
    ) {
      year += 1
    }

    return createCampagne({
      annee: year,
      nom: `Opération Brioches ${year}`,

      description: '',

      // Les dates doivent être revalidées
      // pour chaque nouvelle édition.
      dateDebut: '',
      dateFin: '',

      prixUnitaire: source.prixUnitaire,

      objectifBrioches:
        source.objectifBrioches,

      objectifDonateurs:
        source.objectifDonateurs,

      budgetPrevisionnel:
        source.budgetPrevisionnel,
    })
  }

  /* =======================================================
     ACTIVER UNE CAMPAGNE
     ======================================================= */

  function activateCampagne(
    id: string,
  ) {
    const target = campagnes.find(
      (campagne) => campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    if (target.statut === 'TERMINEE') {
      throw new Error(
        "Une campagne terminée ne peut pas être réactivée.",
      )
    }

    if (
      target.prixUnitaire === null ||
      target.prixUnitaire <= 0
    ) {
      throw new Error(
        'Renseigne un prix unitaire valide avant activation.',
      )
    }

    setCampagnes((current) =>
      current.map((campagne) => {
        if (campagne.id === id) {
          return {
            ...campagne,
            statut: 'ACTIVE',
          }
        }

        if (campagne.statut === 'ACTIVE') {
          return {
            ...campagne,
            statut: 'PREPARATION',
          }
        }

        return campagne
      }),
    )
  }

  /* =======================================================
     TERMINER UNE CAMPAGNE
     ======================================================= */

  function finishCampagne(
    id: string,
  ) {
    const target = campagnes.find(
      (campagne) => campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    setCampagnes((current) =>
      current.map((campagne) =>
        campagne.id === id
          ? {
              ...campagne,
              statut: 'TERMINEE',
            }
          : campagne,
      ),
    )
  }

  /* =======================================================
     VALEUR PARTAGÉE
     ======================================================= */

  const value: ObDataContextValue = {
    donateurs,
    commandes,
    fichesCaisse,

    campagnes,
    activeCampagne,

    setDonateurs,
    setCommandes,
    setFichesCaisse,

    getDonateurById: (id) =>
      donateurs.find(
        (donateur) =>
          donateur.id === id,
      ),

    getCommandesByDonateurId: (
      donateurId,
    ) =>
      commandes.filter(
        (commande) =>
          commande.donateurId === donateurId,
      ),

    getFicheCaisseById: (id) =>
      fichesCaisse.find(
        (fiche) =>
          fiche.id === id,
      ),

    getCommandesByCampagne: (id) =>
      commandes.filter(
        (commande) =>
          commande.campagne === id,
      ),

    getFichesByCampagne: (id) =>
      fichesCaisse.filter(
        (fiche) =>
          fiche.campagne === id,
      ),

    createCampagne,
    updateCampagne,
    duplicateCampagne,
    activateCampagne,
    finishCampagne,
  }

  return (
    <ObDataContext.Provider value={value}>
      {children}
    </ObDataContext.Provider>
  )
}

/* =========================================================
   HOOK
   ========================================================= */

export function useObData() {
  const context = useContext(
    ObDataContext,
  )

  if (!context) {
    throw new Error(
      'useObData doit être utilisé dans ObDataProvider',
    )
  }

  return context
}
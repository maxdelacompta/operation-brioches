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
  DepotBanque,
  FicheCaisse,
  NouvelleCampagne,
} from '../types/ob'

import {
  initialDonateurs,
} from '../data/initialDonateurs'

import {
  initialCommandes,
} from '../data/initialCommandes'

import {
  initialFichesCaisse,
} from '../data/initialFichesCaisse'

import {
  BILLETS,
  PIECES,
  calculerCoffre,
} from '../services/coffre'

/* =========================================================
   CLÉS DE STOCKAGE

   On conserve les anciennes clés.
   Les dépôts utilisent une nouvelle clé.
   ========================================================= */

const DONATEURS_KEY = 'ob-donateurs'

const COMMANDES_KEY = 'ob-commandes'

const FICHES_KEY = 'ob-fiches-caisse'

const CAMPAGNES_KEY = 'ob-campagnes-v1'

const DEPOTS_KEY = 'ob-depots-banque-v1'

/* =========================================================
   CHARGEMENT DES TABLEAUX
   ========================================================= */

function loadArray<T>(
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

function loadCampagnes(
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

function getLocalDate(): string {
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

function createDepotId(): string {
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

type ObDataContextValue = {

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

const ObDataContext = createContext<
  ObDataContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER PRINCIPAL
   ========================================================= */

export function ObDataProvider({
  children,
}: {
  children: ReactNode
}) {

  /* =======================================================
     1. DONATEURS
     ======================================================= */

  const [
    donateurs,
    setDonateurs,
  ] = useState<Donateur[]>(
    () =>
      loadArray(
        DONATEURS_KEY,
        initialDonateurs,
      ),
  )

  /* =======================================================
     2. COMMANDES
     ======================================================= */

  const [
    commandes,
    setCommandes,
  ] = useState<Commande[]>(
    () =>
      loadArray(
        COMMANDES_KEY,
        initialCommandes,
      ),
  )

  /* =======================================================
     3. FICHES DE CAISSE
     ======================================================= */

  const [
    fichesCaisse,
    setFichesCaisse,
  ] = useState<FicheCaisse[]>(
    () =>
      loadArray(
        FICHES_KEY,
        initialFichesCaisse,
      ),
  )

  /* =======================================================
     4. CAMPAGNES
     ======================================================= */

  const [
    campagnes,
    setCampagnes,
  ] = useState<Campagne[]>(
    () =>
      loadCampagnes(
        commandes,
        fichesCaisse,
      ),
  )

  /* =======================================================
     5. DÉPÔTS BANCAIRES

     NOUVEAU

     Aucun dépôt fictif n'est créé.
     ======================================================= */

  const [
    depotsBanque,
    setDepotsBanque,
  ] = useState<DepotBanque[]>(
    () =>
      loadArray(
        DEPOTS_KEY,
        [],
      ),
  )

  /* =======================================================
     CAMPAGNE ACTIVE
     ======================================================= */

  const activeCampagne = useMemo(
    () =>
      campagnes.find(
        campagne =>
          campagne.statut === 'ACTIVE',
      ) ?? null,

    [campagnes],
  )

  /* =======================================================
     SAUVEGARDE DES DONATEURS
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      DONATEURS_KEY,
      JSON.stringify(donateurs),
    )
  }, [donateurs])

  /* =======================================================
     SAUVEGARDE DES COMMANDES
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      COMMANDES_KEY,
      JSON.stringify(commandes),
    )
  }, [commandes])

  /* =======================================================
     SAUVEGARDE DES FICHES DE CAISSE
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      FICHES_KEY,
      JSON.stringify(fichesCaisse),
    )
  }, [fichesCaisse])

  /* =======================================================
     SAUVEGARDE DES CAMPAGNES
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
     6. CRÉER UN DÉPÔT BANCAIRE

     RÈGLES :

     - campagne existante ;
     - référence obligatoire et unique ;
     - dépôt non vide ;
     - validation par le moteur du coffre ;
     - sauvegarde avant modification de l'état.

     Le calcul refuse un dépôt qui rendrait
     le stock négatif.
     ======================================================= */

  function creerDepotBanque(
    entree: NouveauDepotBanque,
  ): string {

    /* CAMPAGNE */

    const campagne = entree.campagne.trim()

    if (
      !campagne ||
      !campagnes.some(
        item =>
          item.id === campagne,
      )
    ) {
      throw new Error(
        'Campagne inconnue pour ce dépôt.',
      )
    }

    /* RÉFÉRENCE */

    const reference =
      entree.reference.trim()

    if (!reference) {
      throw new Error(
        'La référence du bordereau est obligatoire.',
      )
    }

    const referenceExiste =
      depotsBanque.some(
        depot =>
          depot.campagne === campagne &&
          depot.reference
            .trim()
            .toLowerCase() ===
          reference.toLowerCase(),
      )

    if (referenceExiste) {
      throw new Error(
        'Cette référence de dépôt existe déjà pour cette campagne.',
      )
    }

    /* LE DÉPÔT DOIT CONTENIR DES FONDS */

    const contientPieces =
      PIECES.some(
        piece =>
          entree[piece.key] > 0,
      )

    const contientBillets =
      BILLETS.some(
        billet =>
          entree[billet.key] > 0,
      )

    const contientCheques =
      entree.nbCheques > 0 ||
      entree.montantCheques > 0

    if (
      !contientPieces &&
      !contientBillets &&
      !contientCheques
    ) {
      throw new Error(
        'Le dépôt est vide. Indiquez les espèces ou les chèques déposés.',
      )
    }

    /* CRÉATION DU DÉPÔT */

    const id = createDepotId()

    const depot: DepotBanque = {
      ...entree,

      id,

      campagne,

      reference,

      date: getLocalDate(),

      statut: 'ENREGISTRE',
    }

    /* =====================================================
       VALIDATION AVANT ENREGISTREMENT

       On simule le dépôt dans le moteur.

       Si un montant ou une quantité devient
       négatif, calculerCoffre déclenche
       une erreur.

       Rien n'est enregistré dans ce cas.
       ===================================================== */

    const prochainsDepots = [
      ...depotsBanque,
      depot,
    ]

    calculerCoffre(
      campagne,
      fichesCaisse,
      prochainsDepots,
    )

    /* =====================================================
       SAUVEGARDE

       Si localStorage échoue, le dépôt n'est
       pas ajouté à l'état React.
       ===================================================== */

    localStorage.setItem(
      DEPOTS_KEY,
      JSON.stringify(
        prochainsDepots,
      ),
    )

    setDepotsBanque(
      prochainsDepots,
    )

    return id
  }

  /* =======================================================
     7. ANNULER UN DÉPÔT BANCAIRE

     On ne supprime pas l'enregistrement.

     Son statut passe à ANNULE, ce qui permet
     au coffre de réintégrer les sommes.
     ======================================================= */

  function annulerDepotBanque(
    id: string,
  ): void {
    const depot = depotsBanque.find(
      item =>
        item.id === id,
    )

    if (!depot) {
      throw new Error(
        'Dépôt bancaire introuvable.',
      )
    }

    if (depot.statut !== 'ENREGISTRE') {
      throw new Error(
        'Ce dépôt est déjà annulé.',
      )
    }

    const prochainsDepots: DepotBanque[] =
      depotsBanque.map(
        item =>
          item.id === id
            ? {
                ...item,

                statut: 'ANNULE',

                dateAnnulation:
                  new Date().toISOString(),
              }
            : item,
      )

    /* SAUVEGARDE */

    localStorage.setItem(
      DEPOTS_KEY,
      JSON.stringify(
        prochainsDepots,
      ),
    )

    setDepotsBanque(
      prochainsDepots,
    )
  }

  /* =======================================================
     8. CRÉER UNE CAMPAGNE
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
        campagne =>
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

    setCampagnes(
      current => [
        ...current,
        nouvelle,
      ],
    )

    return id
  }

  /* =======================================================
     9. MODIFIER UNE CAMPAGNE
     ======================================================= */

  function updateCampagne(
    id: string,
    details: CampagneDetails,
  ): void {
    const target = campagnes.find(
      campagne =>
        campagne.id === id,
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

    setCampagnes(
      current =>
        current.map(
          campagne =>
            campagne.id === id
              ? {
                  ...campagne,

                  ...details,

                  nom:
                    details.nom.trim(),

                  statut:
                    campagne.statut ===
                    'A_CONFIGURER'
                      ? 'PREPARATION'
                      : campagne.statut,
                }
              : campagne,
        ),
    )
  }

  /* =======================================================
     10. DUPLIQUER UNE CAMPAGNE

     Les commandes, fiches et dépôts bancaires
     ne sont jamais dupliqués.
     ======================================================= */

  function duplicateCampagne(
    id: string,
  ): string {
    const source = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (
      !source ||
      source.annee === null
    ) {
      throw new Error(
        'Cette campagne ne peut pas être dupliquée.',
      )
    }

    let year =
      source.annee + 1

    while (
      campagnes.some(
        campagne =>
          campagne.annee === year ||
          campagne.id ===
            `OB ${year}`,
      )
    ) {
      year += 1
    }

    return createCampagne({
      annee: year,

      nom:
        `Opération Brioches ${year}`,

      description: '',

      // Dates à revalider chaque année.

      dateDebut: '',
      dateFin: '',

      prixUnitaire:
        source.prixUnitaire,

      objectifBrioches:
        source.objectifBrioches,

      objectifDonateurs:
        source.objectifDonateurs,

      budgetPrevisionnel:
        source.budgetPrevisionnel,
    })
  }

  /* =======================================================
     11. ACTIVER UNE CAMPAGNE
     ======================================================= */

  function activateCampagne(
    id: string,
  ): void {
    const target = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    if (target.statut === 'TERMINEE') {
      throw new Error(
        'Une campagne terminée ne peut pas être réactivée.',
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

    setCampagnes(
      current =>
        current.map(
          campagne => {
            if (campagne.id === id) {
              return {
                ...campagne,

                statut: 'ACTIVE',
              }
            }

            if (
              campagne.statut ===
              'ACTIVE'
            ) {
              return {
                ...campagne,

                statut: 'PREPARATION',
              }
            }

            return campagne
          },
        ),
    )
  }

  /* =======================================================
     12. TERMINER UNE CAMPAGNE
     ======================================================= */

  function finishCampagne(
    id: string,
  ): void {
    const target = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    setCampagnes(
      current =>
        current.map(
          campagne =>
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
     13. VALEURS PARTAGÉES
     ======================================================= */

  const value: ObDataContextValue = {

    /* DONATEURS */

    donateurs,
    setDonateurs,

    /* COMMANDES */

    commandes,
    setCommandes,

    /* FICHES DE CAISSE */

    fichesCaisse,
    setFichesCaisse,

    /* CAMPAGNES */

    campagnes,
    activeCampagne,

    /* DÉPÔTS BANCAIRES */

    depotsBanque,

    creerDepotBanque,

    annulerDepotBanque,

    /* RECHERCHES */

    getDonateurById: id =>
      donateurs.find(
        donateur =>
          donateur.id === id,
      ),

    getCommandesByDonateurId:
      donateurId =>
        commandes.filter(
          commande =>
            commande.donateurId ===
            donateurId,
        ),

    getFicheCaisseById: id =>
      fichesCaisse.find(
        fiche =>
          fiche.id === id,
      ),

    getCommandesByCampagne: id =>
      commandes.filter(
        commande =>
          commande.campagne === id,
      ),

    getFichesByCampagne: id =>
      fichesCaisse.filter(
        fiche =>
          fiche.campagne === id,
      ),

    getDepotsByCampagne: id =>
      depotsBanque.filter(
        depot =>
          depot.campagne === id,
      ),

    /* ACTIONS CAMPAGNES */

    createCampagne,

    updateCampagne,

    duplicateCampagne,

    activateCampagne,

    finishCampagne,
  }

  /* =======================================================
     PROVIDER
     ======================================================= */

  return (
    <ObDataContext.Provider
      value={value}
    >
      {children}
    </ObDataContext.Provider>
  )
}

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
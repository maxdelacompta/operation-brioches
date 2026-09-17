export type Donateur = {
  id: number
  code: string
  type: string
  nom: string

  numeroVoie?: string
  adresse?: string
  cp?: string
  ville?: string
  informations?: string

  contactNom?: string
  contactPrenom?: string
  email?: string
  telephone?: string

  conditionReglement?: string
  modeReglement?: string

  jdi?: string
  jdp?: string
  rf?: string

  remarque?: string

  archive?: boolean
}

export type StatutCommande =
  | 'BROUILLON'
  | 'CONFIRMEE'
  | 'A_LIVRER'
  | 'LIVREE'
  | 'ANNULEE'

export type Commande = {
  id: number
  numero: string

  donateurId: number

  campagne: string
  dateCommande: string

  quantite: number
  prixUnitaire: number

  statut: StatutCommande

  conditionReglement?: string
  modeReglement?: string

  jdi?: string
  jdp?: string
  rf?: string

  datePrevueLivraison?: string
  dateLivraison?: string

  remarque?: string
}

/* =========================================================
   FICHES DE CAISSE
   ========================================================= */

export type TypeFicheCaisse =
  | 'ENTREPRISE'
  | 'MAIRIE'
  | 'ETABLISSEMENT'
  | 'STAND'
  | 'AUTRE'

export type FicheCaisse = {
  id: number

  numero: string

  campagne: string

  date: string

  type: TypeFicheCaisse

  /* Structure concernée */

  libelle: string

  ville?: string

  cp?: string

  secteur?: string

  /* Relations possibles */

  donateurId?: number

  commandeId?: number

  /* =====================================================
     ESPÈCES — QUANTITÉS PHYSIQUES
     ===================================================== */

  billets100: number
  billets50: number
  billets20: number
  billets10: number
  billets5: number

  pieces2: number
  pieces1: number
  pieces050: number
  pieces020: number
  pieces010: number
  pieces005: number
  pieces002: number
  pieces001: number

  /* =====================================================
     CHÈQUES
     ===================================================== */

  nbCheques: number

  montantCheques: number

  /* =====================================================
     TPE
     ===================================================== */

  nbTpe: number

  montantTpe: number

  /* =====================================================
     VIREMENTS
     ===================================================== */

  montantVirement: number

  /* =====================================================
     DONS
     ===================================================== */

  nbDons5: number

  nbDons3: number

  montantDonsAutres: number

  /* =====================================================
     INFORMATIONS
     ===================================================== */

  remarque?: string
}

/* =========================================================
   CAMPAGNES
   ========================================================= */

export type StatutCampagne =
  | 'A_CONFIGURER'
  | 'PREPARATION'
  | 'ACTIVE'
  | 'TERMINEE'

export type Campagne = {
  // Identifiant stable utilisé par les commandes
  // et les fiches de caisse : "OB 2026", etc.
  id: string

  annee: number | null
  nom: string
  description: string

  statut: StatutCampagne

  dateDebut: string
  dateFin: string

  prixUnitaire: number | null

  objectifBrioches: number | null
  objectifDonateurs: number | null
  budgetPrevisionnel: number | null
}

export type CampagneDetails = Pick<
  Campagne,
  | 'nom'
  | 'description'
  | 'dateDebut'
  | 'dateFin'
  | 'prixUnitaire'
  | 'objectifBrioches'
  | 'objectifDonateurs'
  | 'budgetPrevisionnel'
>

export type NouvelleCampagne = CampagneDetails & {
  annee: number
}
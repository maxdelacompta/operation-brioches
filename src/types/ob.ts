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

/* =========================================================
   COMMANDES
   ========================================================= */

export type StatutCommande =
  | 'BROUILLON'
  | 'CONFIRMEE'
  | 'A_LIVRER'
  | 'LIVREE'
  | 'ANNULEE'

/** Livraison indépendante d'une même commande : le payeur reste celui de la commande. */
export type CommandeLivraison = {
  id: string
  destinataireId?: number | null
  destinataireNom: string
  adresse: string
  cp: string
  ville: string
  datePrevue: string
  quantite: number
  /** À compléter une fois la livraison effectuée. */
  dateLivraison?: string
}

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
  /** Plusieurs destinataires/dates, toujours un seul donateur payeur. */
  livraisons?: CommandeLivraison[]

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
  libelle: string

  ville?: string
  cp?: string
  secteur?: string

  donateurId?: number
  commandeId?: number
  /** Commande mairie ou responsable de secteur liée à cette fiche. */
  commandeMairieRsId?: string
  /** Établissement AEIM choisi dans la BDD (identifiant stable). */
  etablissementId?: string
  /** Stand clôturé choisi pour la campagne (identifiant stable). */
  standId?: string

  /** Nombre de brioches données / remises constatées pour la fiche. */
  nbBriochesDonnees?: number
  /** Nombre de dons sans contrepartie lorsqu'il est connu. */
  nbDonsSansContrepartie?: number
  /** Permet d'indiquer que le nombre de dons sans contrepartie est inconnu. */
  donsSansContrepartieInconnu?: boolean
  /** Utilisé pour les établissements : l'enveloppe a été retournée au siège. */
  enveloppeRetourSiege?: boolean

  /* BILLETS */

  billets100: number
  billets50: number
  billets20: number
  billets10: number
  billets5: number

  /* PIÈCES */

  pieces2: number
  pieces1: number
  pieces050: number
  pieces020: number
  pieces010: number
  pieces005: number
  pieces002: number
  pieces001: number

  /* CHÈQUES */

  nbCheques: number
  montantCheques: number

  /* TPE */

  nbTpe: number
  montantTpe: number

  /* VIREMENTS */

  montantVirement: number

  /* DONS */

  nbDons5: number
  nbDons3: number
  montantDonsAutres: number

  remarque?: string

  /* NOUVEAU : CONTRÔLE POUR LE COFFRE

     Les anciennes fiches n'ont pas ce champ.
     Elles devront être contrôlées avant
     d'être comptabilisées dans le coffre.
  */

  statutCoffre?:
    | 'A_CONTROLER'
    | 'CONTROLEE'

  dateControleCoffre?: string
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

export type NouvelleCampagne =
  CampagneDetails & {
    annee: number
  }

/* =========================================================
   NOUVEAU : DÉPÔTS BANCAIRES

   Un dépôt enregistré retire les quantités
   correspondantes du coffre.

   Un dépôt annulé n'est plus déduit.
   ========================================================= */

export type DepotBanque = {
  id: string
  reference: string

  campagne: string
  date: string

  statut:
    | 'ENREGISTRE'
    | 'ANNULE'

  /* BILLETS DÉPOSÉS */

  billets100: number
  billets50: number
  billets20: number
  billets10: number
  billets5: number

  /* PIÈCES DÉPOSÉES */

  pieces2: number
  pieces1: number
  pieces050: number
  pieces020: number
  pieces010: number
  pieces005: number
  pieces002: number
  pieces001: number

  /* CHÈQUES DÉPOSÉS */

  nbCheques: number
  montantCheques: number

  remarque?: string
  dateAnnulation?: string
}
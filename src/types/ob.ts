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
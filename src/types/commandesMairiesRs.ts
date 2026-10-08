export type TypeCommandeMairieRs = 'MAIRIE' | 'RS'

export type StatutCommandeMairieRs =
  | 'BROUILLON'
  | 'COMMANDEE'
  | 'A_PREPARER'
  | 'A_RECUPERER'
  | 'BRIOCHES_REMISES'
  | 'DONS_A_RECUPERER'
  | 'TERMINEE'
  | 'ANNULEE'

export type CommandeMairieRs = {
  id: string
  numero: string
  campagne: string
  type: TypeCommandeMairieRs
  mairieId: string | null

  secteur: string
  sousSecteur: string
  quiPasseCommande: string
  responsableSecteur: string

  quantite: number
  nbCartons: number

  dateRecuperation: string
  recuperationLibre: string
  quiRecupere: string
  email: string
  telephone: string
  lieuRecuperation: string
  livraisonPar: string
  remarque: string

  prixUnitaire: number
  donPrevu: number
  nombreBriochesVendues: number | null
  personneRapportantDons: string
  lieuDepotDons: string
  donRecu: number | null

  statut: StatutCommandeMairieRs

  createdAt: string
  updatedAt: string
}

export type NouvelleCommandeMairieRs = Omit<
  CommandeMairieRs,
  'id' | 'numero' | 'createdAt' | 'updatedAt'
>

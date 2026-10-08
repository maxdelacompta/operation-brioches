export type TypeSuiviMateriel = 'CAISSE' | 'TPE'

export type StatutSuiviMateriel =
  | 'A_PLANIFIER'
  | 'SORTI'
  | 'A_CONTROLER'
  | 'RETOURNE'

export type MouvementMateriel = {
  id: string
  campagne: string
  type: TypeSuiviMateriel

  numeroMateriel: number
  numeroSerie: string
  montantFond: number | null
  tpeAssocieNumero: number | null

  nomStand: string
  responsable: string

  dateSortie: string
  signatureSortie: string

  /** Date prévisionnelle utilisée par le planning. */
  dateRetourPrevue: string

  /** Date réellement constatée lors du retour. */
  dateRetourReelle: string
  montantEncaisse: number | null
  signatureRetour: string

  ficheCaisseNumero: string
  observationRetour: string

  createdAt: string
  updatedAt: string
}

export type NouveauMouvementMateriel = Omit<
  MouvementMateriel,
  'id' | 'createdAt' | 'updatedAt'
>

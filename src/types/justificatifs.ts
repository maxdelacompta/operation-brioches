export type JustificatifType = 'JDI' | 'JDP'

export type JustificatifStatut =
  | 'BROUILLON'
  | 'A_VERIFIER'
  | 'EMIS'
  | 'ENVOYE'
  | 'ARCHIVE'
  | 'ERREUR'

export type PaiementStatut =
  | 'EN_ATTENTE'
  | 'PAYE'
  | 'NON_APPLICABLE'

export type DocumentStatut =
  | 'A_GENERER'
  | 'GENERE'
  | 'ENVOYE'
  | 'ERREUR'

export type HistoriqueJustificatif = {
  id: string
  date: string
  action: string
  detail?: string
}

export type JustificatifDon = {
  id: string
  numero: string
  type: JustificatifType
  campagne: string

  donateurId?: string
  donateurCode?: string
  donateurNom: string
  donateurVille?: string
  donateurAdresse?: string
  donateurEmail?: string
  donateurTelephone?: string

  commandeId?: string
  commandeNumero?: string

  dateEmission: string
  nbBrioches: number
  prixUnitaire: number
  montant: number

  statut: JustificatifStatut
  paiementStatut: PaiementStatut
  documentStatut: DocumentStatut

  datePaiement?: string
  referencePaiement?: string
  dateEnvoi?: string
  emailDestinataire?: string

  version: number
  modeleNom?: string
  modeleVersion?: number
  modeleCampagneId?: string
  modeReglementGenere?: string
  parentJustificatifId?: string
  remarque?: string

  createdAt: string
  updatedAt: string
  historique: HistoriqueJustificatif[]
}

export type NouveauJustificatif = Omit<
  JustificatifDon,
  | 'id'
  | 'numero'
  | 'montant'
  | 'version'
  | 'createdAt'
  | 'updatedAt'
  | 'historique'
>

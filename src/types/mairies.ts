export type ParticipationMairie = 'OUI' | 'A_CONTACTER' | 'NON'
export type StatutMairie = 'ACTIVE' | 'ARCHIVEE'
export type StatutDocumentMairie = 'OUI' | 'NON'

export type ParticipationObMairie = {
  id: string
  campagne: string
  statut: ParticipationMairie
  nombreBrioches: number | null
  modeReglement: string
  lieuInfos: string
  remarque: string
}

export type DocumentMairie = {
  id: string
  type: 'CONVENTION' | 'AUTORISATION' | 'AUTRE'
  libelle: string
  statut: StatutDocumentMairie
  date: string
  remarque: string
}

export type HistoriqueMairie = {
  id: string
  date: string
  libelle: string
}

export type Mairie = {
  id: string
  code: string
  statut: StatutMairie

  commune: string
  nomAffiche: string
  codeInsee: string
  secteur: string

  numeroVoie: string
  adresse: string
  cp: string
  ville: string

  contactNom: string
  contactPrenom: string
  contactFonction: string
  email: string
  telephone: string

  participation: ParticipationMairie
  nombreBriochesN1: number | null
  modeReglement: string
  lieuInfos: string

  notes: string
  participations: ParticipationObMairie[]
  documents: DocumentMairie[]
  historique: HistoriqueMairie[]

  createdAt: string
  updatedAt: string
}

export type NouvelleMairie = Omit<
  Mairie,
  'id' | 'createdAt' | 'updatedAt' | 'historique'
>

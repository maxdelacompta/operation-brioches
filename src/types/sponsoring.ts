import type { StoredDocumentMeta } from '../services/conventionDocuments'

export type SponsoringStatus = 'brouillon' | 'envoyee' | 'signee' | 'terminee'

export type SponsoringBenefit = {
  id: string
  label: string
  planned: boolean
  done: boolean
  doneAt: string
  comment: string
  proof: StoredDocumentMeta | null
}

export type SponsoringDeal = {
  id: string
  campagneId: string
  donateurId: number | null
  entreprise: string
  contact: string
  adresse: string
  montant: number
  statut: SponsoringStatus
  date: string
  notes: string
  signedConvention: StoredDocumentMeta | null
  benefits: SponsoringBenefit[]
  createdAt: string
  updatedAt: string
}

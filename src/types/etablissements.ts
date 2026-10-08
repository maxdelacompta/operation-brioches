export type TypeEtablissementAEIM =
  | 'SIEGE'
  | 'ESAT'
  | 'IME'
  | 'MAS'
  | 'FAM'
  | 'FOYER'
  | 'SAJ'
  | 'SAVS'
  | 'EAM'
  | 'SESSAD'
  | 'AUTRE'

export type StatutEtablissementAEIM =
  | 'ACTIF'
  | 'INACTIF'

export type EtablissementAEIM = {
  id: string
  code: string
  nom: string
  type: TypeEtablissementAEIM
  statut: StatutEtablissementAEIM

  adresse: string
  codePostal: string
  ville: string
  telephone: string
  email: string

  responsableNom: string
  responsableTelephone: string
  responsableEmail: string

  secteur: string
  pole: string
  rattachementId: string

  participeOperationBrioches: boolean
  peutEffectuerLivraisons: boolean
  peutRecevoirStock: boolean
  peutVendreBrioches: boolean

  roleOperationBrioches: string
  commentaire: string

  createdAt: string
  updatedAt: string
}

export type NouvelEtablissementAEIM = Omit<
  EtablissementAEIM,
  'id' | 'createdAt' | 'updatedAt'
>

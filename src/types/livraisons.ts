export type ModeLivraison =
  | 'NON_AFFECTE'
  | 'BENEVOLE'
  | 'ESAT'
  | 'SERVICE_COMM'
  | 'RETRAIT'

export type StatutLivraison =
  | 'A_PLANIFIER'
  | 'PLANIFIEE'
  | 'EN_COURS'
  | 'LIVREE'
  | 'PROBLEME'

export type RetraitType = 'STAND' | 'ETABLISSEMENT'

export type MissionLivraison = {
  id: string
  commandeId: number
  date: string
  heure: string
  mode: ModeLivraison
  /** Type du retrait, uniquement pour les missions de mode RETRAIT. */
  retraitType?: RetraitType
  responsable: string
  statut: StatutLivraison
  commentaire: string
  updatedAt: string
}

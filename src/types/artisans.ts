/** Achats de brioches fraîches : données distinctes des commandes-dons. */
export type StatutArtisan = 'ACTIF' | 'INACTIF' | 'A_VERIFIER'
export type StatutCommandeArtisan =
  | 'A_VERIFIER'
  | 'BROUILLON'
  | 'CONFIRMEE'
  | 'RETRAIT_PREVU'
  | 'TERMINEE'
  | 'ANNULEE'

export type Artisan = {
  id: string
  nom: string
  responsable: string
  responsableSecteur: string
  adresse: string
  telephone: string
  email: string
  tarif2026: number | null
  tarif2025: number | null
  commentaires: string
  statut: StatutArtisan
}

export type CommandeArtisan = {
  id: string
  numero: string
  artisanId: string
  campagne: string
  dateCommande: string // date effective ; jamais déduite d'une autre date lors de l'import
  dateRetrait: string // YYYY-MM-DD, première date seulement si identifiée de façon sûre
  repartitionJours: string // texte du planning Excel à conserver intégralement
  secteur: string
  responsableSecteur: string
  adresseResponsable: string
  telephoneResponsable: string
  personneRetrait: string
  quantiteCommandee: number
  quantiteFabriquee: number | null
  prixUnitaire: number
  statut: StatutCommandeArtisan
  etiquettesConsignes: string
  bdcEnvoyeLe: string
  etiquettesEnvoyeesLe: string
  fondsEstimes: number | null
  fondsRecus: number | null
  factureNumero: string
  factureRecueLe: string
  factureScanneeLe: string
  factureTransmiseLe: string
  remarque: string
  remarqueFacture: string
  sourceExcelLigne?: number
}

export function montantCommande(c: CommandeArtisan): number {
  return Math.round(c.quantiteCommandee * c.prixUnitaire * 100) / 100
}

export function montantFinal(c: CommandeArtisan): number | null {
  return c.quantiteFabriquee === null || c.prixUnitaire <= 0
    ? null
    : Math.round(c.quantiteFabriquee * c.prixUnitaire * 100) / 100
}

export function numeroCommandeSuivant(commandes: CommandeArtisan[], campagne: string): string {
  // Respecte la numérotation du classeur : OB/BOUL-1, OB/BOUL-2, etc.
  // La campagne est une dimension séparée ; un même n° peut exister sur une autre édition.
  const numeros = commandes.filter(c => c.campagne === campagne)
    .map(c => Number(c.numero.match(/^OB\/BOUL-(\d+)$/)?.[1] ?? 0))
    .filter(n => Number.isSafeInteger(n))
  return `OB/BOUL-${Math.max(0, ...numeros) + 1}`
}

export function jourLocal(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function argent(montant: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)
}

export function dateLisible(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—'
  const [annee, mois, jour] = value.split('-')
  return `${jour}/${mois}/${annee}`
}

/** Référentiel d'achat commun, sans modifier les commandes-dons existantes. */
export type TypeFournisseur = 'ARTISAN' | 'GMS' | 'INDUSTRIEL'

/**
 * Les champs historiques des artisans restent inchangés pour éviter toute
 * rupture des anciennes commandes et de l'import Excel déjà enregistré.
 */
export type Fournisseur = Artisan & {
  type: TypeFournisseur
  siret?: string
  codePostal?: string
  ville?: string
  conditionsReglement?: string
}

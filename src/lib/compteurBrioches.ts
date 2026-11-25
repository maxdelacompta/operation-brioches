import { readOperations } from './standOperations'

/** Un bilan indicatif par stand. Ne crée JAMAIS de mouvement de stock établissement. */
export type StandCompteur = {
  id: string
  campagne?: string
  date: string
  briochesPrevues?: number
  briochesRemises?: number
  stockFournisseur?: boolean
}
export type TransfertStand = { id: string; from: string; to: string; qty: number; at: string }
export type FicheStand = { type?: string; standId?: string; campagne?: string; nbBriochesDonnees?: number }
export type ClotureCompteur = { closedAt?: string; briochesCompteur?: number; briochesFiche?: number; briochesTotal?: number }

const valeur = (n: unknown): number => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0
const annee = (texte: string): string => texte.match(/(?:19|20)\d{2}/)?.[0] ?? ''
const memeCampagne = (a: string, b: string): boolean => {
  if (a.trim().toUpperCase() === b.trim().toUpperCase()) return true
  if (/^(?:test|specimen)/i.test(a.trim()) || /^(?:test|specimen)/i.test(b.trim())) return false
  return Boolean(annee(a) && annee(a) === annee(b))
}

export function lireTransfertsStands(campagne: string): TransfertStand[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(`ob-stands-reattributions-v1-${campagne}`) ?? '[]')
    if (!Array.isArray(v)) return []
    return v.filter((t): t is TransfertStand => Boolean(t && typeof t.id === 'string' && typeof t.from === 'string' && typeof t.to === 'string' && t.from !== t.to && Number.isSafeInteger(t.qty) && t.qty > 0 && typeof t.at === 'string'))
  } catch { return [] }
}
export function lireClotureCompteur(standId: string): ClotureCompteur | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`ob-stand-cloture-v1-${standId}`) ?? 'null')
    return value && typeof value === 'object' ? value as ClotureCompteur : null
  } catch { return null }
}
export function decompteFichesStand(stand: StandCompteur, fiches: FicheStand[]): number {
  return fiches.filter(f => f.type === 'STAND' && f.standId === stand.id && (!f.campagne || memeCampagne(f.campagne, stand.campagne || stand.date.slice(0, 4))))
    .reduce((total, fiche) => total + valeur(fiche.nbBriochesDonnees), 0)
}
export type BilanStand = {
  base: number
  entrees: number
  transfertsSortants: number
  disponibleAvantDistribution: number
  compteur: number
  saisieManuelle: number
  decompteFiche: number
  distribuees: number
  restantes: number
  ecart: number
  cloture: boolean
  source: 'fournisseur' | 'estimation'
  sansEstimation: boolean
  divergenceFiche: boolean
}
export function bilanCompteurStand(
  stand: StandCompteur,
  campagne: string,
  options: { livraisons?: Record<string, number>; transferts?: TransfertStand[]; fiches?: FicheStand[] } = {},
): BilanStand {
  const livrees = valeur(options.livraisons?.[stand.id])
  // Source exclusive : on ne cumule jamais livraison fournisseur et prévision manuelle.
  const base = stand.stockFournisseur ? livrees : valeur(stand.briochesPrevues)
  const transferts = options.transferts ?? lireTransfertsStands(campagne)
  const entrees = transferts.filter(t => t.to === stand.id).reduce((n, t) => n + t.qty, 0)
  const transfertsSortants = transferts.filter(t => t.from === stand.id).reduce((n, t) => n + t.qty, 0)
  const disponibleAvantDistribution = base + entrees - transfertsSortants
  const compteur = readOperations(stand.id).filter(o => o.kind === 'brioche')
    .reduce((n, o) => n + valeur(o.qty), 0)
  const saisieManuelle = valeur(stand.briochesRemises)
  const decompteFiche = decompteFichesStand(stand, options.fiches ?? [])
  const cloture = lireClotureCompteur(stand.id)
  // La fiche de caisse peut recopier le compteur, et la clôture en est une photo.
  // Ce sont plusieurs SOURCES du même décompte, pas plusieurs sorties à additionner.
  const distribuees = Math.max(compteur + saisieManuelle, valeur(cloture?.briochesTotal), decompteFiche)
  const ecart = disponibleAvantDistribution - distribuees
  return {
    base, entrees, transfertsSortants, disponibleAvantDistribution, compteur,
    saisieManuelle, decompteFiche, distribuees,
    restantes: Math.max(0, ecart), ecart,
    cloture: Boolean(cloture?.closedAt),
    source: stand.stockFournisseur ? 'fournisseur' : 'estimation',
    sansEstimation: base + entrees <= 0,
    divergenceFiche: decompteFiche > 0 && decompteFiche !== compteur + saisieManuelle &&
      decompteFiche !== valeur(cloture?.briochesTotal),
  }
}

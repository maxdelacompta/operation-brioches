/** Métadonnées de traçabilité attachées à des réceptions DÉJÀ comptabilisées.
 * Ce module ne crée ni mouvements ni nouvelles quantités dans le stock.
 */
import { stockCampaignYear } from './briochesStock'

export type FamilleBrioche = 'artisan' | 'gms' | 'industriel' | 'mecene' | 'autre'
export type LimiteBrioche = 'DLC' | 'DDM' | 'interne'
export type LotBrioche = {
  mouvementId: string
  famille: FamilleBrioche
  reference: string
  fabrication: string
  dateLimite: string
  natureLimite: LimiteBrioche
  commentaire: string
  updatedAt: string
}
export type ReceptionLot = {
  id: string
  date: string
  etablissementId: string
  quantite: number
  commentaire: string
  famille: FamilleBrioche
  meta: LotBrioche | null
  quantiteRestanteEstimee: number
}
export type MouvementStockLot = {
  id: string; date: string; type: string; etablissementId: string; destinationId?: string;
  quantite: number; commentaire: string
}

export const LOTS_CHANGED = 'ob-stocks-brioches-lots-changed'
export const lotsKey = (campagne: string) => `ob-${stockCampaignYear(campagne)}-brioches-lots-v1`
export const FAMILLES_BRIOCHES: Record<FamilleBrioche, string> = {
  artisan: 'Artisan (2 jours – règle interne)',
  gms: 'GMS (2 à 5 jours – vérifier le lot)',
  industriel: 'Industriel (environ 1 mois – vérifier le lot)',
  mecene: 'Boulangerie mécène',
  autre: 'Origine à préciser',
}
export function familleDepuisReception(m: MouvementStockLot): FamilleBrioche {
  const s = `${m.id} ${m.commentaire}`.toLocaleLowerCase('fr')
  if (s.includes('achat-gms-') || s.includes('commande gms')) return 'gms'
  if (s.includes('achat-industriel-') || s.includes('industriel')) return 'industriel'
  if (s.includes('achat-reception-') || s.includes('artisan')) return 'artisan'
  if (s.includes('mécèn') || s.includes('mecen') || s.includes('boulangerie')) return 'mecene'
  return 'autre'
}
export function lireLots(campagne: string): Record<string, LotBrioche> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(lotsKey(campagne)) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const entries = Object.entries(raw).filter(([id, r]) => {
      if (!id || !r || typeof r !== 'object') return false
      const x = r as Partial<LotBrioche>
      return x.mouvementId === id && typeof x.famille === 'string' &&
        typeof x.dateLimite === 'string' && typeof x.reference === 'string'
    })
    return Object.fromEntries(entries) as Record<string, LotBrioche>
  } catch { return {} }
}
export function enregistrerLot(campagne: string, input: Omit<LotBrioche, 'updatedAt'>): LotBrioche {
  const dates = [input.fabrication, input.dateLimite].filter(Boolean)
  if (dates.some(d => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true
    const date = new Date(`${d}T12:00:00Z`)
    return !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== d
  })) {
    throw new Error('Date invalide : choisissez une date au format jour / mois / année.')
  }
  if (input.fabrication && input.dateLimite && input.dateLimite < input.fabrication) {
    throw new Error('La date limite ne peut précéder la date de fabrication.')
  }
  const recorded = { ...input, reference: input.reference.trim(), commentaire: input.commentaire.trim(), updatedAt: new Date().toISOString() }
  localStorage.setItem(lotsKey(campagne), JSON.stringify({ ...lireLots(campagne), [input.mouvementId]: recorded }))
  window.dispatchEvent(new Event(LOTS_CHANGED))
  return recorded
}
/**
 * Répartition estimative FEFO des sorties, sans affirmer quel lot a été physiquement remis.
 * Les réceptions sont l'unique origine des quantités par lot. Retours et ajustements +
 * créent une provenance inconnue, jamais une « nouvelle » réception fournisseur.
 */
export function calculerReceptionsLots(mouvements: MouvementStockLot[], metas: Record<string, LotBrioche>, dons: Array<{etablissementId?: string; quantite:number; type?:string}> = []): ReceptionLot[] {
  type Bucket = { id: string; etab: string; left: number; dateLimite: string }
  const buckets: Bucket[] = []
  const receptions: ReceptionLot[] = []
  const sorted = [...mouvements].sort((a,b)=>a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const consommer = (id: string, quantite: number, destination = '') => {
    const candidates = buckets.filter(x => x.etab === id && x.left > 0).sort((a,b) =>
      (a.dateLimite || '9999-99-99').localeCompare(b.dateLimite || '9999-99-99') || a.id.localeCompare(b.id))
    let remain = quantite
    for (const b of candidates) {
      const q = Math.min(remain, b.left)
      if (q <= 0) break
      b.left -= q
      if (destination) buckets.push({ id: b.id, etab: destination, left: q, dateLimite: b.dateLimite })
      remain -= q
    }
  }
  for (const m of sorted) {
    const q = m.quantite
    if (!Number.isInteger(q) || q === 0) continue
    if (m.type === 'reception' && q > 0) {
      const meta = metas[m.id] ?? null
      receptions.push({ id:m.id, date:m.date, etablissementId:m.etablissementId, quantite:q,
        commentaire:m.commentaire, famille:meta?.famille ?? familleDepuisReception(m), meta, quantiteRestanteEstimee:0 })
      buckets.push({ id:m.id, etab:m.etablissementId, left:q, dateLimite:meta?.dateLimite ?? '' })
    } else if (m.type === 'transfert' && q > 0 && m.destinationId) {
      consommer(m.etablissementId, q, m.destinationId)
    } else if (m.type === 'sortie' && q > 0) {
      consommer(m.etablissementId, q)
    } else if (m.type === 'ajustement' && q < 0) {
      consommer(m.etablissementId, -q)
    } else if ((m.type === 'retour' || m.type === 'ajustement') && q > 0) {
      buckets.push({ id:`provenance-inconnue-${m.id}`, etab:m.etablissementId, left:q, dateLimite:'' })
    }
  }
  // Les dons avec contrepartie déjà déduits par stockFor sont soustraits une seule fois ici.
  for (const d of dons) if (d.etablissementId && d.type !== 'sans' && d.quantite > 0) consommer(d.etablissementId, d.quantite)
  for (const r of receptions) r.quantiteRestanteEstimee = buckets.filter(b=>b.id===r.id).reduce((n,b)=>n+b.left,0)
  return receptions
}
export function joursAvantDateLimite(date: string, aujourdHui: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(aujourdHui)) return null
  const a = Date.parse(`${date}T12:00:00Z`), b = Date.parse(`${aujourdHui}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a-b)/86400000) : null
}

/**
 * Réceptions physiques de brioches offertes par un mécène.
 * Le mécénat déclaré n'est PAS une entrée de stock : seul ce bouton de
 * réception crée un mouvement de type 'reception' dans le registre existant.
 * Chaque réception dispose d'un ID stable pour éviter les doubles entrées.
 */
import { loadStockMovements, publishBriochesChange, stockKeyForCampaign } from './briochesStock'
import { readFinanceRows } from './financeRegister'
import { enregistrerLot, type LimiteBrioche } from './stocksBriochesLots'

export const MECENAT_RECEPTION_PREFIX = 'mecenat-reception-'
export const isMecenatBrioches = (row: {nature?: string; produit?: string}) =>
  row.nature === 'Mécène boulangerie' || (row.nature === 'En nature' && row.produit === 'Brioches')

export type ReceptionMecenat = {
  id: string
  date: string
  type: 'reception'
  etablissementId: string
  quantite: number
  commentaire: string
}

export type DemandeReceptionMecenat = {
  campagne: string
  mecenatId: string
  mouvementId: string
  etablissementId: string
  quantite: number
  date: string
  referenceLot: string
  fabrication: string
  dateLimite: string
  natureLimite: LimiteBrioche
  remarque: string
}

const valideDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value

export function creerIdReceptionMecenat(mecenatId: string) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${MECENAT_RECEPTION_PREFIX}${mecenatId}-${id}`
}

export function receptionsPourMecenat(mecenatId: string, campagne: string) {
  const prefix = `${MECENAT_RECEPTION_PREFIX}${mecenatId}-`
  return (loadStockMovements(campagne) as ReceptionMecenat[]).filter(m =>
    m.type === 'reception' && m.id.startsWith(prefix) && m.quantite > 0)
}

export function quantiteRecueMecenat(mecenatId: string, campagne: string) {
  return receptionsPourMecenat(mecenatId, campagne).reduce((acc, r) => acc+r.quantite, 0)
}

export function enregistrerReceptionMecenat(input: DemandeReceptionMecenat): {id:string; nouveau:boolean} {
  if (!input.campagne || !input.mecenatId || !input.etablissementId ||
      !input.mouvementId.startsWith(`${MECENAT_RECEPTION_PREFIX}${input.mecenatId}-`)) {
    throw new Error('Campagne, mécénat ou établissement invalide.')
  }
  if (!Number.isSafeInteger(input.quantite) || input.quantite < 1 || input.quantite > 1_000_000) {
    throw new Error('Indique une quantité reçue entière et positive.')
  }
  if (![input.date, input.fabrication, input.dateLimite].every(d => !d || valideDate(d)) ||
      !valideDate(input.date)) throw new Error('Vérifie les dates de réception, fabrication et échéance.')
  if (input.fabrication && input.dateLimite && input.fabrication > input.dateLimite) {
    throw new Error('La date limite ne peut pas précéder la fabrication.')
  }
  if (!['DLC', 'DDM', 'interne'].includes(input.natureLimite)) throw new Error('Nature de date limite inconnue.')

  // Protège une réception contre un changement de campagne / de mécénat.
  const row = readFinanceRows('mecenat').find(x => x.id === input.mecenatId && x.campagne === input.campagne)
  if (!row || !isMecenatBrioches(row)) throw new Error('Ce mécénat en brioches n’existe pas dans la campagne.')

  const existing = loadStockMovements(input.campagne) as ReceptionMecenat[]
  const old = existing.find(m => m.id === input.mouvementId)
  if (old && (old.etablissementId !== input.etablissementId || old.quantite !== input.quantite ||
      old.date.slice(0,10) !== input.date)) {
    throw new Error('Cette réception est déjà enregistrée avec des valeurs différentes. Ne pas la dupliquer.')
  }
  if (!old) {
    const mouvement: ReceptionMecenat = {
      id: input.mouvementId,
      date: `${input.date}T12:00:00`,
      type: 'reception',
      etablissementId: input.etablissementId,
      quantite: input.quantite,
      commentaire: `Mécénat brioches — ${row.partenaire || 'Mécène'} — ${row.reference || row.id}${input.remarque.trim() ? ` — ${input.remarque.trim()}` : ''}`,
    }
    // L'écriture intervient une seule fois. En cas d'échec de la seconde étape
    // (lot), réessayer avec le même ID complète les métadonnées sans doubler le stock.
    localStorage.setItem(stockKeyForCampaign(input.campagne), JSON.stringify([mouvement, ...existing]))
    publishBriochesChange()
  }
  enregistrerLot(input.campagne, {
    mouvementId: input.mouvementId,
    famille: 'mecene',
    reference: input.referenceLot || row.reference || '',
    fabrication: input.fabrication,
    dateLimite: input.dateLimite,
    natureLimite: input.natureLimite,
    commentaire: `Boulangerie mécène : ${row.partenaire || 'non renseignée'}${input.remarque.trim() ? ` — ${input.remarque.trim()}` : ''}`,
  })
  return {id:input.mouvementId, nouveau:!old}
}

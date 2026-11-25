/**
 * Bons de commande des établissements AEIM (démonstration navigateur).
 * Distincts des dons directs : une commande ne modifie pas le stock à sa création.
 * Chaque remise réelle génère un mouvement « sortie » dans le stock central.
 */
import { loadStockDons, loadStockMovements, publishBriochesChange, stockCampaignYear, stockFor, stockKeyForCampaign } from '../lib/briochesStock'

export const ETAB_COMMANDES_CHANGED = 'ob:commandes-etablissements-changed'
export type RemiseCommande = { id: string; date: string; quantite: number }
export type ReglementCommande = { id: string; date: string; centimes: number; mode: string }
export type CommandeEtablissement = {
  id: string
  numero: string
  campagne: string
  etablissementId: string
  demandeur: string
  contact: string
  quantite: number
  prixUnitaireCentimes: number
  date: string
  commentaire: string
  remises: RemiseCommande[]
  reglements: ReglementCommande[]
}

const METHODS = ['Espèces', 'Chèque', 'Carte bancaire', 'Virement', 'Autre'] as const
export const MODES_REGLEMENT_COMMANDES: readonly string[] = METHODS
export const centimes = (euros: number): number => Math.round(euros * 100)
export const montantCommande = (c: CommandeEtablissement) => c.quantite * c.prixUnitaireCentimes
export const quantiteRemise = (c: CommandeEtablissement) => c.remises.reduce((n, x) => n + x.quantite, 0)
export const montantRegle = (c: CommandeEtablissement) => c.reglements.reduce((n, x) => n + x.centimes, 0)
export const resteAremettre = (c: CommandeEtablissement) => Math.max(0, c.quantite - quantiteRemise(c))
export const resteAregler = (c: CommandeEtablissement) => Math.max(0, montantCommande(c) - montantRegle(c))
export const commandeEtablissementKey = (campagne: string) => `ob-${stockCampaignYear(campagne)}-commandes-etablissements-v1`
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const valide = (raw: unknown): raw is CommandeEtablissement => {
  if (!object(raw)) return false
  const x = raw
  return typeof x.id === 'string' && typeof x.numero === 'string' &&
    typeof x.campagne === 'string' && typeof x.etablissementId === 'string' &&
    typeof x.demandeur === 'string' && typeof x.contact === 'string' &&
    typeof x.commentaire === 'string' && typeof x.date === 'string' &&
    Number.isInteger(x.quantite) && Number(x.quantite) > 0 &&
    Number.isSafeInteger(x.prixUnitaireCentimes) && Number(x.prixUnitaireCentimes) > 0 &&
    Array.isArray(x.remises) && x.remises.every((r: unknown) => object(r) && typeof r.id === 'string' && typeof r.date === 'string' && Number.isInteger(r.quantite) && Number(r.quantite) > 0) &&
    Array.isArray(x.reglements) && x.reglements.every((r: unknown) => object(r) && typeof r.id === 'string' && typeof r.date === 'string' && Number.isSafeInteger(r.centimes) && Number(r.centimes) > 0 && typeof r.mode === 'string')
}
export function lireCommandesEtablissement(campagne: string): CommandeEtablissement[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(commandeEtablissementKey(campagne)) || '[]')
    return Array.isArray(value) ? value.filter(valide) : []
  } catch { return [] }
}
function notifier() { window.dispatchEvent(new Event(ETAB_COMMANDES_CHANGED)) }
function enregistrer(campagne: string, commandes: CommandeEtablissement[]) {
  localStorage.setItem(commandeEtablissementKey(campagne), JSON.stringify(commandes))
  notifier()
}
const trouver = (campagne: string, id: string) => {
  const commandes = lireCommandesEtablissement(campagne)
  const commande = commandes.find(c => c.id === id)
  if (!commande) throw new Error('Bon de commande introuvable pour cette campagne.')
  return { commandes, commande }
}
export function creerCommandeEtablissement(campagne: string, input: {
  etablissementId: string; demandeur: string; contact: string; quantite: number; prixUnitaire: number; commentaire: string
}): CommandeEtablissement {
  if (!input.etablissementId || !input.demandeur.trim()) throw new Error('Indiquez un établissement et un demandeur.')
  if (!Number.isSafeInteger(input.quantite) || input.quantite < 1 || input.quantite > 100000) throw new Error('La quantité doit être un entier positif valide.')
  const price = centimes(input.prixUnitaire)
  if (!Number.isSafeInteger(price) || price <= 0 || price * input.quantite > Number.MAX_SAFE_INTEGER) throw new Error('Le prix unitaire doit être positif et valide.')
  const existing = lireCommandesEtablissement(campagne)
  const year = stockCampaignYear(campagne).replace(/[^a-zA-Z0-9-]/g, '')
  // Référence stable sur la campagne ; UUID en complément pour prévenir toute collision de stockage.
  const sequence = existing.reduce((n, c) => Math.max(n, Number(c.numero.match(/-(\d+)$/)?.[1]) || 0), 0) + 1
  const commande: CommandeEtablissement = {
    id: crypto.randomUUID(), numero: `BC-${year}-${String(sequence).padStart(4, '0')}`,
    campagne, etablissementId: input.etablissementId, demandeur: input.demandeur.trim().slice(0, 120),
    contact: input.contact.trim().slice(0, 120), quantite: input.quantite,
    prixUnitaireCentimes: price, date: new Date().toISOString(), commentaire: input.commentaire.trim().slice(0, 500),
    remises: [], reglements: []
  }
  enregistrer(campagne, [commande, ...existing])
  return commande
}

/** Transaction locale compensée : un retrait commande est stocké comme mouvement de sortie central. */
export function remettreCommandeEtablissement(campagne: string, id: string, q: number): CommandeEtablissement {
  const { commandes, commande } = trouver(campagne, id)
  if (!Number.isSafeInteger(q) || q < 1 || q > resteAremettre(commande)) throw new Error('Quantité à remettre invalide.')
  const stock = stockFor(commande.etablissementId, loadStockMovements(campagne), loadStockDons(campagne))
  if (q > stock) throw new Error(`Stock insuffisant : ${stock} brioche(s) disponible(s) pour cet établissement.`)
  const mKey = stockKeyForCampaign(campagne)
  const orderKey = commandeEtablissementKey(campagne)
  const oldMovements = localStorage.getItem(mKey)
  const oldOrders = localStorage.getItem(orderKey)
  const remise: RemiseCommande = { id: crypto.randomUUID(), date: new Date().toISOString(), quantite: q }
  const movement = {
    id: `etab-commande-remise-${commande.id}-${remise.id}`,
    date: remise.date, type: 'sortie', etablissementId: commande.etablissementId,
    quantite: q, commentaire: `Remise ${commande.numero} · ${commande.demandeur}`
  }
  const nextOrders = commandes.map(c => c.id === id ? { ...c, remises: [...c.remises, remise] } : c)
  const nextMovements = [movement, ...loadStockMovements(campagne)]
  try {
    // Écriture du stock avant la commande : compensation immédiate en cas d'échec.
    localStorage.setItem(mKey, JSON.stringify(nextMovements))
    localStorage.setItem(orderKey, JSON.stringify(nextOrders))
  } catch {
    try {
      if (oldMovements === null) localStorage.removeItem(mKey)
      else localStorage.setItem(mKey, oldMovements)
      if (oldOrders === null) localStorage.removeItem(orderKey)
      else localStorage.setItem(orderKey, oldOrders)
    } catch { /* stockage indisponible : nécessitera une vérification manuelle */ }
    throw new Error("Impossible d'enregistrer la remise et son mouvement de stock.")
  }
  publishBriochesChange()
  notifier()
  return nextOrders.find(c => c.id === id)!
}
export function reglerCommandeEtablissement(campagne: string, id: string, amountCentimes: number, mode: string): CommandeEtablissement {
  const { commandes, commande } = trouver(campagne, id)
  if (!Number.isSafeInteger(amountCentimes) || amountCentimes < 1 || amountCentimes > resteAregler(commande)) throw new Error('Le montant dépasse le solde ou est invalide.')
  if (!METHODS.some(m => m === mode)) throw new Error('Mode de règlement invalide.')
  const paiement: ReglementCommande = { id: crypto.randomUUID(), date: new Date().toISOString(), centimes: amountCentimes, mode }
  const next = commandes.map(c => c.id === id ? { ...c, reglements: [...c.reglements, paiement] } : c)
  enregistrer(campagne, next)
  return next.find(c => c.id === id)!
}

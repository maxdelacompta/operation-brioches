import type { CommandeArtisan } from '../types/artisans'
import type { EtablissementAEIM } from '../types/etablissements'
import { stockFor, loadStockDons, publishBriochesChange, STOCK_KEY, stockKeyForCampaign } from './briochesStock'

type CommandeDestination = CommandeArtisan & { etablissementId?: string; livre?: boolean }
type Mouvement = { id: string; date: string; type: string; etablissementId: string; quantite: number; commentaire: string; destinationId?: string }
const confirme = (c?: CommandeArtisan) => !!c && ['CONFIRMEE','RETRAIT_PREVU','TERMINEE'].includes(c.statut)
function lire(campagne: string): Mouvement[] { try { const p: unknown = JSON.parse(localStorage.getItem(stockKeyForCampaign(campagne)) ?? '[]'); return Array.isArray(p) ? p as Mouvement[] : [] } catch { return [] } }
/** Réception idempotente : une entrée de stock uniquement après livraison réelle. */
export function synchroniserReceptionIndustrielle(commande: CommandeDestination, ancienne: CommandeArtisan | undefined, etablissements: EtablissementAEIM[]): { ok: boolean; erreur?: string } {
  const cible = commande.etablissementId ?? ''
  const livre = confirme(commande) && commande.livre === true
  if (livre && !etablissements.some(e => e.id === cible && e.statut === 'ACTIF' && e.peutRecevoirStock)) {
    return { ok: false, erreur: 'Sélectionne un établissement actif autorisé à recevoir du stock avant de confirmer.' }
  }
  if (livre && (!Number.isInteger(commande.quantiteCommandee) || commande.quantiteCommandee <= 0)) return { ok:false, erreur:'Quantité invalide.' }
  const cle = stockKeyForCampaign(commande.campagne)
  const id = `achat-industriel-${commande.id}`
  if (cle !== STOCK_KEY && lire('OB 2026').some(m => m.id === id)) {
    return {ok:false,erreur:'Une réception historique de ce bon existe dans le stock 2026. Rapprochez-la avant de modifier le bon pour éviter un double comptage.'}
  }
  if (ancienne && stockKeyForCampaign(ancienne.campagne) !== cle && lire(ancienne.campagne).some(m => m.id === id)) {
    return { ok:false, erreur:'Une commande industrielle livrée ne peut pas changer de campagne sans rapprochement de son ancien stock.' }
  }
  const mouvements = lire(commande.campagne)
  const restants = mouvements.filter(m => m.id !== id)
  const previous = mouvements.find(m => m.id === id && m.etablissementId === cible && m.quantite === commande.quantiteCommandee)
  const suivants = livre ? [{ id, date: previous?.date ?? new Date().toISOString(), type:'reception', etablissementId:cible, quantite: commande.quantiteCommandee, commentaire: `Bon industriel ${commande.numero}` }, ...restants] : restants
  // Une diminution / annulation ne peut priver des dons ou sorties déjà réalisés.
  const concernes = new Set([cible, ...(mouvements.filter(m => m.id === id).map(m => m.etablissementId))].filter(Boolean))
  if ([...concernes].some(idEtab => stockFor(idEtab, suivants, loadStockDons(commande.campagne)) < 0)) return { ok:false, erreur:'Modification refusée : stock insuffisant après correction de la commande.' }
  // Les anciennes commandes confirmées restent inchangées jusqu'à une modification explicite.
  try { localStorage.setItem(cle, JSON.stringify(suivants)); publishBriochesChange(); return {ok:true} }
  catch { return {ok:false,erreur:'Impossible de sauvegarder le mouvement de stock.'} }
}

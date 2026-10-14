import type { CommandeArtisan } from '../types/artisans'
import type { EtablissementAEIM } from '../types/etablissements'
import { stockFor, publishBriochesChange } from './briochesStock'

const CLE = 'ob2026-stock-brioches-demo-v1'
type CommandeDestination = CommandeArtisan & { etablissementId?: string }
type Mouvement = { id: string; date: string; type: string; etablissementId: string; quantite: number; commentaire: string; destinationId?: string }
const confirme = (c?: CommandeArtisan) => !!c && ['CONFIRMEE','RETRAIT_PREVU','TERMINEE'].includes(c.statut)
function lire(): Mouvement[] { try { const p: unknown = JSON.parse(localStorage.getItem(CLE) ?? '[]'); return Array.isArray(p) ? p as Mouvement[] : [] } catch { return [] } }
/** Réception idempotente : exactement un mouvement par commande confirmée. */
export function synchroniserReceptionIndustrielle(commande: CommandeDestination, ancienne: CommandeArtisan | undefined, etablissements: EtablissementAEIM[]): { ok: boolean; erreur?: string } {
  const cible = commande.etablissementId ?? ''
  if (confirme(commande) && !etablissements.some(e => e.id === cible && e.statut === 'ACTIF' && e.peutRecevoirStock)) {
    return { ok: false, erreur: 'Sélectionne un établissement actif autorisé à recevoir du stock avant de confirmer.' }
  }
  if (confirme(commande) && (!Number.isInteger(commande.quantiteCommandee) || commande.quantiteCommandee <= 0)) return { ok:false, erreur:'Quantité invalide.' }
  const mouvements = lire()
  const id = `achat-industriel-${commande.id}`
  const restants = mouvements.filter(m => m.id !== id)
  const suivants = confirme(commande) ? [{ id, date: new Date().toISOString(), type:'reception', etablissementId:cible, quantite: commande.quantiteCommandee, commentaire: `Bon industriel ${commande.numero}` }, ...restants] : restants
  // Une diminution / annulation ne peut priver des dons ou sorties déjà réalisés.
  const concernes = new Set([cible, ...(mouvements.filter(m => m.id === id).map(m => m.etablissementId))].filter(Boolean))
  if ([...concernes].some(idEtab => stockFor(idEtab, suivants) < 0)) return { ok:false, erreur:'Modification refusée : stock insuffisant après correction de la commande.' }
  // Les anciennes commandes confirmées restent inchangées jusqu'à une modification explicite.
  void ancienne
  try { localStorage.setItem(CLE, JSON.stringify(suivants)); publishBriochesChange(); return {ok:true} }
  catch { return {ok:false,erreur:'Impossible de sauvegarder le mouvement de stock.'} }
}

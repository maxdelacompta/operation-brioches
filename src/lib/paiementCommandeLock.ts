/** Verrou comptable de statut : uniquement les commandes rapprochées d'une pièce
 * dont les règlements confirmés couvrent intégralement le montant TTC. */
const FACTURES_KEY = 'ob2026-factures-paiements-v1'
const REGLEMENTS_KEY = 'ob2026-reglements-factures-v1'

type FactureStockee = { id: string; commandeIds?: string[]; montantTtc: number }
type ReglementStocke = { factureId: string; montant: number; confirme: boolean }

function lireListe<T>(cle: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(cle) || '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

export function paiementRapprocheVerrouille(commandeId: string): boolean {
  if (!commandeId || typeof localStorage === 'undefined') return false
  const factures = lireListe<FactureStockee>(FACTURES_KEY).filter(f => f.commandeIds?.includes(commandeId))
  if (!factures.length) return false
  const reglements = lireListe<ReglementStocke>(REGLEMENTS_KEY)
  return factures.every(f => Number(f.montantTtc) > 0 &&
    reglements.filter(r => r.factureId === f.id && r.confirme)
      .reduce((total, r) => total + (Number(r.montant) || 0), 0) >= Number(f.montantTtc) - 0.005)
}

export const MESSAGE_PAIEMENT_VERROUILLE = 'Commande soldée par rapprochement comptable : le statut Payé est verrouillé. Corrige d’abord le rapprochement dans Documents → Factures & Paiements.'

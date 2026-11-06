import type { FicheCaisse } from '../types/ob'
import type { CommandeMairieRs } from '../types/commandesMairiesRs'
import { cashChannels, sumChannels } from './dashboardMetrics'

/** Centimes pour éviter les écarts d'arrondi en cumulant plusieurs encaissements. */
const cents = (value: number): number => Math.round((Number(value) || 0) * 100)

export function montantFicheCaisse(fiche: FicheCaisse): number {
  // Les champs « dons » ventilent les encaissements ; les additionner ici
  // aux espèces, chèques, TPE et virements doublerait certains dons.
  return sumChannels(cashChannels(fiche))
}

export type BilanCaisseMairieRs = {
  /** Don reçu affiché dans le module (priorité aux fiches liées, sinon historique). */
  recu: number | null
  /** Montant des encaissements effectivement reliés et contrôlés. */
  montantFiches: number
  nombreFiches: number
  /** Valeur historique conservée, jamais cumulée aux fiches. */
  historique: number | null
  source: 'fiches' | 'historique' | 'aucune'
  ecart: number | null
}

export function bilanCaisseMairieRs(
  commande: CommandeMairieRs,
  fiches: readonly FicheCaisse[],
): BilanCaisseMairieRs {
  const liees = fiches.filter(fiche =>
    fiche.commandeMairieRsId === commande.id &&
    fiche.campagne === commande.campagne &&
    fiche.type === 'MAIRIE' &&
    fiche.statutCoffre === 'CONTROLEE',
  )
  const montantFiches = liees.reduce((total, fiche) => total + cents(montantFicheCaisse(fiche)), 0) / 100
  const historique = commande.donRecu
  const recu = liees.length > 0 ? montantFiches : historique
  return {
    recu,
    montantFiches,
    nombreFiches: liees.length,
    historique,
    source: liees.length > 0 ? 'fiches' : historique === null ? 'aucune' : 'historique',
    ecart: recu === null ? null : (cents(recu) - cents(commande.donPrevu)) / 100,
  }
}

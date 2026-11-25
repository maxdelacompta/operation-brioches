import type { FicheCaisse } from '../types/ob'
import { cashChannels, sumChannels } from './dashboardMetrics'

/**
 * Une fiche représente un seul retour physique de fonds. Le montant affecté à
 * chaque commande est une ventilation de cet encaissement, et non une nouvelle
 * recette. Les champs de dons sont déjà inclus dans les moyens de paiement.
 */
export const montantEncaisseFiche = (fiche: FicheCaisse): number =>
  sumChannels(cashChannels(fiche))

const centimes = (montant: number): number => Math.round(montant * 100)

/** Compatibilité des fiches historiques qui ne portaient qu'un seul numéro. */
export function affectationsCommandesEntreprise(fiche: FicheCaisse) {
  if (Array.isArray(fiche.affectationsCommandesEntreprise)) {
    return fiche.affectationsCommandesEntreprise
  }
  return fiche.commandeId == null ? [] : [
    { commandeId: fiche.commandeId, montant: montantEncaisseFiche(fiche) },
  ]
}

/** Compatibilité des fiches historiques Mairies / Responsables de secteur. */
export function affectationsCommandesMairieRs(fiche: FicheCaisse) {
  if (Array.isArray(fiche.affectationsCommandesMairieRs)) {
    return fiche.affectationsCommandesMairieRs
  }
  return !fiche.commandeMairieRsId ? [] : [
    { commandeId: fiche.commandeMairieRsId, montant: montantEncaisseFiche(fiche) },
  ]
}

export function totalAffecteFiche(fiche: FicheCaisse): number {
  const lignes = fiche.type === 'ENTREPRISE'
    ? affectationsCommandesEntreprise(fiche)
    : fiche.type === 'MAIRIE'
      ? affectationsCommandesMairieRs(fiche)
      : []
  return lignes.reduce((sum, ligne) => sum + centimes(ligne.montant), 0) / 100
}

export function verifierMontantsAffectes(fiche: FicheCaisse): string | null {
  const lignes = fiche.type === 'ENTREPRISE'
    ? affectationsCommandesEntreprise(fiche)
    : fiche.type === 'MAIRIE'
      ? affectationsCommandesMairieRs(fiche)
      : []
  const ids = new Set<string>()
  for (const ligne of lignes) {
    const id = String(ligne.commandeId)
    if (!id || ids.has(id)) return 'Une commande est rattachée plusieurs fois à la même fiche.'
    ids.add(id)
    // Une livraison partielle peut être déclarée avant le règlement : 0 € est autorisé.
    if (!Number.isFinite(ligne.montant) || centimes(ligne.montant) < 0) {
      return 'Le montant affecté à une commande doit être positif ou nul.'
    }
    if (ligne.quantiteLivree !== undefined &&
      (!Number.isSafeInteger(ligne.quantiteLivree) || ligne.quantiteLivree < 0)) {
      return 'La quantité remise doit être un nombre entier positif ou nul.'
    }
  }
  if (centimes(totalAffecteFiche(fiche)) > centimes(montantEncaisseFiche(fiche))) {
    return 'La somme affectée aux commandes dépasse le retour de fonds encaissé.'
  }
  return null
}

/**
 * Le bon de commande d'origine n'est jamais diminué : la quantité encore à
 * remettre est calculée d'après les remises explicites des fiches, pour
 * conserver l'historique et éviter la double déduction en cas de modification.
 * Les anciennes fiches sans quantiteLivree ne sont pas converties en livraisons.
 */
export function totalBriochesRemisesSurFiches(
  fiches: readonly FicheCaisse[],
  type: 'ENTREPRISE' | 'MAIRIE',
  commandeId: number | string,
  campagne: string,
  memeCampagne: (a: string, b: string) => boolean = (a, b) => a === b,
  exclureFicheId?: number,
): number {
  return fiches.reduce((total, fiche) => {
    if (fiche.id === exclureFicheId || fiche.type !== type || !memeCampagne(fiche.campagne, campagne)) return total
    const lignes = type === 'ENTREPRISE'
      ? affectationsCommandesEntreprise(fiche)
      : affectationsCommandesMairieRs(fiche)
    return total + lignes.reduce((somme, ligne) =>
      String(ligne.commandeId) === String(commandeId)
        ? somme + (Number.isSafeInteger(ligne.quantiteLivree) && (ligne.quantiteLivree ?? 0) > 0 ? ligne.quantiteLivree ?? 0 : 0)
        : somme, 0)
  }, 0)
}

export function resteBriochesSurFiches(
  quantiteCommandee: number,
  fiches: readonly FicheCaisse[],
  type: 'ENTREPRISE' | 'MAIRIE',
  commandeId: number | string,
  campagne: string,
  memeCampagne?: (a: string, b: string) => boolean,
  exclureFicheId?: number,
): number {
  return Math.max(0, Math.floor(quantiteCommandee) - totalBriochesRemisesSurFiches(
    fiches, type, commandeId, campagne, memeCampagne, exclureFicheId,
  ))
}

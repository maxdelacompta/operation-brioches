import type { Campagne } from '../types/ob'
import type { UserRole } from '../contexts/UsersContext'

/** Rubriques transversales, indépendantes de la campagne choisie. */
export function isCampaignExemptPath(pathname: string): boolean {
  return (
    pathname === '/bdd' || pathname.startsWith('/bdd/') ||
    pathname === '/administration' || pathname.startsWith('/administration/') ||
    pathname === '/commandes-achats/fournisseurs' ||
    pathname.startsWith('/commandes-achats/fournisseurs/') ||
    pathname.startsWith('/commandes-achats/artisans/fournisseurs') ||
    pathname === '/connexion'
  )
}

/** Toute campagne non active (préparation, terminée, à configurer) est consultable seulement. */
export function isCampaignReadOnly(
  campagne: Campagne | null,
  role: UserRole | undefined,
  pathname: string,
): boolean {
  return Boolean(
    campagne && campagne.statut !== 'ACTIVE' &&
    role !== 'administrateur' &&
    !isCampaignExemptPath(pathname),
  )
}

export function assertCampaignWritable(
  campagne: Campagne | null,
  role: UserRole | undefined,
  pathname: string,
): void {
  if (isCampaignReadOnly(campagne, role, pathname)) {
    throw new Error(
      `La campagne ${campagne?.nom || campagne?.id || ''} n'est pas active : consultation seule.`,
    )
  }
}

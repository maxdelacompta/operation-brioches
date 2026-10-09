import { PERMISSION_MODULES, type PermissionModule, type PermissionAction } from './permissionCatalog'
import type { AppUser } from '../contexts/UsersContext'

/** Exact matches prevent a parent page from implicitly granting access to children. */
export function permissionModuleForPath(pathname: string): PermissionModule | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/commandes-achats/artisans/fournisseurs') return 'fournisseurs'
  if (['/geographie/carte', '/geographie/secteurs', '/geographie/comparaison', '/geographie/couverture'].includes(path)) return 'geographie'
  return PERMISSION_MODULES.find(module => module.path === path)?.key ?? null
}

// TEMPORAIRE : ces trois pages sont accessibles à tous les comptes actifs.
// À supprimer lorsque les permissions du module Établissements seront configurées.
const PUBLIC_ESTABLISHMENT_PATHS = new Set([
  '/etablissements/stock-brioches',
  '/etablissements/suivi-brioches',
  '/etablissements/recap-global',
])

export function canAccessPath(
  user: Pick<AppUser, 'role' | 'status'> | null,
  pathname: string,
  hasPermission: (role: AppUser['role'], module: PermissionModule, action: PermissionAction) => boolean,
): boolean {
  if (!user || user.status !== 'actif') return false

  const path = pathname.replace(/\/+$/, '') || '/'
  if (PUBLIC_ESTABLISHMENT_PATHS.has(path)) return true

  const module = permissionModuleForPath(path)
  if (!module) return false

  // Le compte administrateur a accès à tous les modules déclarés.
  if (user.role === 'administrateur' || String(user.role) === 'admin') return true

  return hasPermission(user.role, module, 'consulter')
}

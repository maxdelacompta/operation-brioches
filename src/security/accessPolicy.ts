import { PERMISSION_MODULES, type PermissionModule, type PermissionAction } from './permissionCatalog'
import type { AppUser } from '../contexts/UsersContext'

/** Exact matches prevent a parent page from implicitly granting access to children. */
export function permissionModuleForPath(pathname: string): PermissionModule | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/commandes-achats/artisans/fournisseurs') return 'fournisseurs'
  if (/^\/gestion\/stands-brioches\/[^/]+\/compteur$/.test(path)) return 'stands_brioches'
  // Les quatre écrans de géographie ont chacun leur case à cocher.
  if (path === '/geographie/carte') return 'geo_carte'
  if (path === '/geographie/secteurs') return 'geo_secteurs'
  if (path === '/geographie/comparaison') return 'geo_comparaison'
  if (path === '/geographie/couverture') return 'geo_couverture'
  return PERMISSION_MODULES.find(module => module.path === path)?.key ?? null
}

export function canAccessPath(
  user: Pick<AppUser, 'role' | 'status'> | null,
  pathname: string,
  hasPermission: (role: AppUser['role'], module: PermissionModule, action: PermissionAction) => boolean,
): boolean {
  if (!user || user.status !== 'actif') return false

  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/administration/reset-ob2026') return user.role === 'administrateur'
  const module = permissionModuleForPath(path)
  if (!module) return false

  // Le compte administrateur a accès à tous les modules déclarés.
  if (user.role === 'administrateur' || String(user.role) === 'admin') return true

  return hasPermission(user.role, module, 'consulter')
}

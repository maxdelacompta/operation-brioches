import { PERMISSION_MODULES, type PermissionModule, type PermissionAction } from './permissionCatalog'
import type { AppUser } from '../contexts/UsersContext'

/** Exact matches prevent a parent page from implicitly granting access to children. */
export function permissionModuleForPath(pathname: string): PermissionModule | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/commandes-achats/artisans/fournisseurs') return 'fournisseurs'
  if (['/geographie/carte', '/geographie/secteurs', '/geographie/comparaison', '/geographie/couverture'].includes(path)) return 'geographie'
  return PERMISSION_MODULES.find(module => module.path === path)?.key ?? null
}

export function canAccessPath(
  user: Pick<AppUser, 'role' | 'status'> | null,
  pathname: string,
  hasPermission: (role: AppUser['role'], module: PermissionModule, action: PermissionAction) => boolean,
): boolean {
  // La recherche est accessible à tout compte actif ; ses résultats filtrent les droits.
  if (pathname.replace(/\/+$/, '') === '/recherche') return Boolean(user && user.status === 'actif')
  const module = permissionModuleForPath(pathname)
  return Boolean(user && user.status === 'actif' && module && hasPermission(user.role, module, 'consulter'))
}

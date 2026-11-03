import {
  createContext,
  useContext,
} from 'react'

import {
  ROLE_LABELS,
  type UserRole,
} from './UsersContext'

/* =========================================================
   TYPES
   ========================================================= */

import { PERMISSION_MODULES, type PermissionAction, type PermissionModule } from '../lib/permissionCatalog'
export { PERMISSION_MODULES, PERMISSION_ACTIONS } from '../lib/permissionCatalog'
export type { PermissionAction, PermissionModule } from '../lib/permissionCatalog'

type RolePermissions = Record<
  PermissionModule,
  PermissionAction[]
>

export type PermissionMatrix = Record<
  UserRole,
  RolePermissions
>

export const STORAGE_KEY = 'ob-role-permissions-v1'

const roles = Object.keys(ROLE_LABELS) as UserRole[]

/* =========================================================
   VALEURS PAR DÉFAUT
   ========================================================= */

/** Règles non négociables des profils : une matrice locale ne peut pas les outrepasser. */
const DEVELOPER_READ_ONLY = new Set<PermissionModule>([
  'utilisateurs', 'roles', 'campagnes', 'parametres', 'admin_etablissements',
  'journal', 'coffre', 'suivi_banque', 'gestion_cheques', 'comptabilite',
  'fiches_caisse', 'justificatifs', 'recapitulatif',
])

export function allowedForRole(role: UserRole, module: PermissionModule, action: PermissionAction): boolean {
  if (role === 'administrateur') return true
  if (role === 'developpeur') {
    if (DEVELOPER_READ_ONLY.has(module)) return action === 'consulter'
    if (action === 'supprimer' || action === 'valider') return false
    return true
  }
  if (role === 'stagiaire_communication') {
    if (module === 'accueil' || module === 'dashboard' || module === 'communication' || module === 'stands_brioches' || module === 'benevoles' || module === 'geographie') return action === 'consulter'
    return false
  }
  if (role === 'stagiaire_comptabilite') {
    if (module === 'accueil' || module === 'dashboard' || module === 'comptabilite' || module === 'justificatifs' || module === 'fiches_caisse') return action === 'consulter'
    return false
  }
  return true
}

export function createDefaultMatrix(): PermissionMatrix {
  const matrix = {} as PermissionMatrix

  for (const role of roles) {
    const rolePermissions = {} as RolePermissions

    for (const module of PERMISSION_MODULES) {
      rolePermissions[module.key] =
        role === 'administrateur' || role === 'developpeur' || role.startsWith('stagiaire_')
          ? module.actions.filter(action => allowedForRole(role, module.key, action))
          : []
    }

    matrix[role] = rolePermissions
  }

  return matrix
}

/* =========================================================
   CHARGEMENT LOCAL
   ========================================================= */

export function loadPermissions(): PermissionMatrix {
  const defaults = createDefaultMatrix()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) return defaults

    const parsed: unknown = JSON.parse(stored)

    if (
      typeof parsed !== 'object' ||
      parsed === null
    ) {
      return defaults
    }

    const savedMatrix = parsed as Record<string, unknown>

    for (const role of roles) {
      // Le rôle administrateur reste protégé.
      if (role === 'administrateur') continue

      const savedRole = savedMatrix[role]

      if (
        typeof savedRole !== 'object' ||
        savedRole === null
      ) {
        continue
      }

      const savedModules = savedRole as Record<
        string,
        unknown
      >

      for (const module of PERMISSION_MODULES) {
        const savedActions = savedModules[module.key]

        if (!Array.isArray(savedActions)) continue

        const validActions = module.actions.filter(
          (action) => savedActions.includes(action) && allowedForRole(role, module.key, action),
        )

        defaults[role][module.key] =
          validActions.includes('consulter')
            ? [...validActions]
            : []
      }
    }

    return defaults
  } catch {
    return defaults
  }
}

/* =========================================================
   CONTEXTE
   ========================================================= */

type PermissionsContextValue = {
  permissions: PermissionMatrix

  hasPermission: (
    role: UserRole,
    module: PermissionModule,
    action: PermissionAction,
  ) => boolean

  togglePermission: (
    role: UserRole,
    module: PermissionModule,
    action: PermissionAction,
  ) => void

  resetRole: (role: UserRole) => void
}

export const PermissionsContext = createContext<
  PermissionsContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER
   ========================================================= */



/* =========================================================
   HOOK
   ========================================================= */

export function usePermissions() {
  const context = useContext(PermissionsContext)

  if (!context) {
    throw new Error(
      'usePermissions doit être utilisé dans PermissionsProvider.',
    )
  }

  return context
}
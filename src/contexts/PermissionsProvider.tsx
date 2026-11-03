import { useEffect, useState, type ReactNode } from 'react'
import { PERMISSION_MODULES, type PermissionAction, type PermissionModule } from '../lib/permissionCatalog'
import type { UserRole } from './UsersContext'
import {
  PermissionsContext,
  STORAGE_KEY,
  allowedForRole,
  createDefaultMatrix,
  loadPermissions,
  type PermissionMatrix,
} from './permissionsState'

export function PermissionsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [permissions, setPermissions] =
    useState<PermissionMatrix>(loadPermissions)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(permissions),
      )
    } catch {
      console.warn(
        'Sauvegarde locale des permissions indisponible.',
      )
    }
  }, [permissions])

  /* VÉRIFICATION */

  function hasPermission(
    role: UserRole,
    module: PermissionModule,
    action: PermissionAction,
  ) {
    // L'administrateur conserve tous les droits, même pour un module
    // ajouté après la dernière sauvegarde locale des permissions.
    if (role === 'administrateur') return true
    if (!allowedForRole(role, module, action)) return false
    return permissions[role]?.[module]?.includes(action) ?? false
  }

  /* MODIFICATION */

  function togglePermission(
    role: UserRole,
    moduleKey: PermissionModule,
    action: PermissionAction,
  ) {
    if (role === 'administrateur' || !allowedForRole(role, moduleKey, action)) return

    const moduleDefinition = PERMISSION_MODULES.find(
      (module) => module.key === moduleKey,
    )

    if (
      !moduleDefinition ||
      !moduleDefinition.actions.some(
        (available) => available === action,
      )
    ) {
      return
    }

    setPermissions((current) => {
      const existing = current[role]?.[moduleKey] ?? []

      let updated: PermissionAction[]

      if (existing.includes(action)) {
        updated =
          action === 'consulter'
            ? []
            : existing.filter(
                (item) => item !== action,
              )
      } else {
        updated = Array.from(
          new Set<PermissionAction>([
            ...existing,
            'consulter',
            action,
          ]),
        )
      }

      return {
        ...current,
        [role]: {
          ...current[role],
          [moduleKey]: updated,
        },
      }
    })
  }

  /* RÉINITIALISATION */

  function resetRole(role: UserRole) {
    if (role === 'administrateur') return

    const defaults = createDefaultMatrix()

    setPermissions((current) => ({
      ...current,
      [role]: defaults[role],
    }))
  }

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        hasPermission,
        togglePermission,
        resetRole,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

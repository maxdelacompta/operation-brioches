import { useUsers } from '../contexts/UsersContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { canAccessPath } from './accessPolicy'

export function useAccess() {
  const { currentUser } = useUsers()
  const { hasPermission } = usePermissions()
  return { canVisit: (pathname: string) => canAccessPath(currentUser, pathname, hasPermission) }
}

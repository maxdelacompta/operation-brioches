import type { AppUser } from '../contexts/UsersContext'

/** Le mode test n'autorise jamais la sélection d'un compte désactivé. */
export function selectableTestUsers(users: readonly AppUser[]): AppUser[] {
  return users.filter(user => user.status === 'actif')
}

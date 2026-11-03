import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { testModeEnabled, TEST_MODE_AVAILABLE } from '../lib/testMode'
import {
  UsersContext,
  STORAGE_KEY,
  DEMO_CURRENT_USER_ID,
  loadUsers,
  normalizeUser,
  type AppUser,
  type UserInput,
  type UsersContextValue,
} from './UsersContext'

export function UsersProvider({
  children,
}: {
  children: ReactNode
}) {
  const [users, setUsers] = useState<AppUser[]>(loadUsers)
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    try { return sessionStorage.getItem('ob2026-auth-session-v1') || DEMO_CURRENT_USER_ID }
    catch { return DEMO_CURRENT_USER_ID }
  })
  const currentUserId = users.some(user => user.id === selectedUserId && user.status === 'actif')
    ? selectedUserId
    : DEMO_CURRENT_USER_ID

  const setCurrentUserId = useCallback(
    function setCurrentUserId(id: string) {
    // Session réelle : seule l'authentification choisit librement le profil.
    const sessionId = sessionStorage.getItem('ob2026-auth-session-v1')
    const simulationAutorisee = TEST_MODE_AVAILABLE && testModeEnabled() && sessionId === DEMO_CURRENT_USER_ID
    if (sessionId !== id && !simulationAutorisee) return
    if (!users.some(user => user.id === id && user.status === 'actif')) return
    setSelectedUserId(id)
  }, [users])

  // Quand le mode test est coupé, revenir immédiatement au vrai compte connecté.
  useEffect(() => {
    const restore = () => {
      if (testModeEnabled()) return
      try {
        const realId = sessionStorage.getItem('ob2026-auth-session-v1')
        if (realId) setSelectedUserId(realId)
      } catch { /* stockage indisponible */ }
    }
    window.addEventListener('ob2026-test-mode-change', restore)
    return () => window.removeEventListener('ob2026-test-mode-change', restore)
  }, [])

  /* SAUVEGARDE */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(users),
      )
    } catch {
      console.warn(
        'Sauvegarde locale des utilisateurs indisponible.',
      )
    }
  }, [users])

  /* UTILISATEUR ACTUEL */

  const currentUser =
    users.find(
      (user) => user.id === currentUserId,
    ) ?? null

  /* AJOUT */

  const addUser = useCallback(
    function addUser(input: UserInput) {
    const newUser: AppUser = {
      ...normalizeUser({ ...input, id: crypto.randomUUID(), status: 'actif' }),
      status: 'actif',
    }

    setUsers((current) => {
      // Un responsable de pôle maximum ; aucun changement de rôle ni de droits.
      if (newUser.pole && newUser.responsablePole && current.some(u => u.status === 'actif' && u.pole === newUser.pole && u.responsablePole)) return current
      return [...current, newUser]
    })
  }, [])

  /* MODIFICATION */

  const updateUser = useCallback(
    function updateUser(id: string, input: UserInput) {
    setUsers((current) => {
      if (input.pole && input.responsablePole && current.some(u => u.id !== id && u.status === 'actif' && u.pole === input.pole && u.responsablePole)) return current
      return current.map((user) =>
        user.id === id
          ? {
              ...normalizeUser({ ...user, ...input }),
            }
          : user,
      )
    })
  }, [])

  /* ACTIVATION / DÉSACTIVATION */

  const toggleUserStatus = useCallback(
    function toggleUserStatus(id: string) {
    // Éviter de désactiver le profil de démonstration
    // avant la mise en place de l'authentification.
    if (id === DEMO_CURRENT_USER_ID) {
      return
    }

    setUsers((current) => {
      const target = current.find(u => u.id === id)
      if (target?.status === 'inactif' && target.pole && target.responsablePole && current.some(u => u.id !== id && u.status === 'actif' && u.pole === target.pole && u.responsablePole)) return current
      return current.map((user) =>
        user.id === id
          ? {
              ...user,
              status:
                user.status === 'actif'
                  ? 'inactif'
                  : 'actif',
            }
          : user,
      )
    })
  }, [])

  /* VALEUR PARTAGÉE */

  const value = useMemo<UsersContextValue>(
    () => ({
      users,
      currentUserId,
      setCurrentUserId,
      currentUser,
      addUser,
      updateUser,
      toggleUserStatus,
    }),
    [users, currentUser, currentUserId, setCurrentUserId, addUser, updateUser, toggleUserStatus],
  )

  return (
    <UsersContext.Provider value={value}>
      {children}
    </UsersContext.Provider>
  )
}

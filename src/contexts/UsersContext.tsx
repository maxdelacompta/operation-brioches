import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/* =========================================================
   TYPES
   ========================================================= */

export const ROLE_LABELS = {
  administrateur: 'Administrateur',
  communication: 'Communication',
  comptabilite: 'Comptabilité',
  etablissement: 'Établissement',
  terrain: 'Coordinateur terrain',
  direction: 'Direction',
} as const

export type UserRole = keyof typeof ROLE_LABELS

export type UserStatus = 'actif' | 'inactif'

export type AppUser = {
  id: string
  name: string
  email: string
  poste: string
  role: UserRole
  perimetre: string
  etablissementId?: string
  status: UserStatus
}

export type UserInput = Pick<
  AppUser,
  'name' | 'email' | 'poste' | 'role' | 'perimetre' | 'etablissementId'
>

/* =========================================================
   DONNÉES LOCALES
   ========================================================= */

const STORAGE_KEY = 'ob-users-v1'

// Identifiant provisoire du profil actuellement affiché
// dans la Topbar. Il sera remplacé par l'identifiant
// fourni par l'authentification.
export const DEMO_CURRENT_USER_ID = 'demo-admin'

const demoAdmin: AppUser = {
  id: DEMO_CURRENT_USER_ID,
  name: 'Maxime Claudel',
  email: '',
  poste: '',
  role: 'administrateur',
  perimetre: '',
  status: 'actif',
}

/* =========================================================
   VALIDATION DES DONNÉES STOCKÉES
   ========================================================= */

function isAppUser(value: unknown): value is AppUser {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const user = value as Record<string, unknown>

  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.poste === 'string' &&
    typeof user.perimetre === 'string' &&
    typeof user.role === 'string' &&
    user.role in ROLE_LABELS &&
    (user.status === 'actif' ||
      user.status === 'inactif')
  )
}

/* =========================================================
   CHARGEMENT
   ========================================================= */

function loadUsers(): AppUser[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return [demoAdmin]
    }

    const parsed: unknown = JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return [demoAdmin]
    }

    const validUsers = parsed.filter(isAppUser)

    // Conserver le profil de démonstration tant que
    // l'authentification n'est pas développée.
    if (
      !validUsers.some(
        (user) => user.id === DEMO_CURRENT_USER_ID,
      )
    ) {
      return [demoAdmin, ...validUsers]
    }

    // Le compte système reste toujours actif et administrateur, même si
    // une ancienne sauvegarde locale contient une version modifiée.
    return [demoAdmin, ...validUsers.filter(user => user.id !== DEMO_CURRENT_USER_ID)]
  } catch {
    return [demoAdmin]
  }
}

/* =========================================================
   CONTEXTE
   ========================================================= */

type UsersContextValue = {
  users: AppUser[]
  currentUserId: string
  setCurrentUserId: (id: string) => void
  currentUser: AppUser | null
  addUser: (input: UserInput) => void
  updateUser: (id: string, input: UserInput) => void
  toggleUserStatus: (id: string) => void
}

const UsersContext = createContext<
  UsersContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER
   ========================================================= */

export function UsersProvider({
  children,
}: {
  children: ReactNode
}) {
  const [users, setUsers] = useState<AppUser[]>(loadUsers)
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    try { return sessionStorage.getItem('ob-test-current-user-v1') || DEMO_CURRENT_USER_ID }
    catch { return DEMO_CURRENT_USER_ID }
  })
  const currentUserId = users.some(user => user.id === selectedUserId && user.status === 'actif')
    ? selectedUserId
    : DEMO_CURRENT_USER_ID

  function setCurrentUserId(id: string) {
    if (!users.some(user => user.id === id && user.status === 'actif')) return
    setSelectedUserId(id)
    try { sessionStorage.setItem('ob-test-current-user-v1', id) } catch { /* Navigation de démonstration */ }
  }

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

  function addUser(input: UserInput) {
    const newUser: AppUser = {
      id: crypto.randomUUID(),
      ...input,
      status: 'actif',
    }

    setUsers((current) => [
      ...current,
      newUser,
    ])
  }

  /* MODIFICATION */

  function updateUser(id: string, input: UserInput) {
    setUsers((current) =>
      current.map((user) =>
        user.id === id
          ? {
              ...user,
              ...input,
            }
          : user,
      ),
    )
  }

  /* ACTIVATION / DÉSACTIVATION */

  function toggleUserStatus(id: string) {
    // Éviter de désactiver le profil de démonstration
    // avant la mise en place de l'authentification.
    if (id === DEMO_CURRENT_USER_ID) {
      return
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === id
          ? {
              ...user,
              status:
                user.status === 'actif'
                  ? 'inactif'
                  : 'actif',
            }
          : user,
      ),
    )
  }

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
    [users, currentUser, currentUserId],
  )

  return (
    <UsersContext.Provider value={value}>
      {children}
    </UsersContext.Provider>
  )
}

/* =========================================================
   HOOK UTILISATEURS
   ========================================================= */

export function useUsers() {
  const context = useContext(UsersContext)

  if (!context) {
    throw new Error(
      'useUsers doit être utilisé dans UsersProvider.',
    )
  }

  return context
}
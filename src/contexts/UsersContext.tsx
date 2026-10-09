import {
  createContext,
  useContext,
  useEffect,
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
  status: UserStatus
}

export type UserInput = Pick<
  AppUser,
  'name' | 'email' | 'poste' | 'role' | 'perimetre'
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

    return validUsers
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
  currentUser: AppUser | null
  isTestingUser: boolean
  canTestUsers: boolean
  testUser: (id: string) => boolean
  stopTestingUser: () => void
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

  // Simulation locale : le compte de départ reste l’administrateur de démonstration.
  // Aucun identifiant de connexion réel n’est remplacé.
  const [testUserId, setTestUserId] = useState<string | null>(null)
  const administrator = users.find(user => user.id === DEMO_CURRENT_USER_ID) ?? null
  const canTestUsers = administrator?.role === 'administrateur' && administrator.status === 'actif'
  const testedUser = canTestUsers
    ? users.find(user => user.id === testUserId && user.status === 'actif')
    : undefined
  const isTestingUser = Boolean(testedUser)

  function testUser(id: string) {
    if (!canTestUsers || !users.some(user => user.id === id && user.status === 'actif')) return false
    setTestUserId(id === DEMO_CURRENT_USER_ID ? null : id)
    return true
  }

  function stopTestingUser() { setTestUserId(null) }

  /* UTILISATEUR ACTUEL */

  const currentUser = testedUser ?? administrator

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
              role: id === DEMO_CURRENT_USER_ID ? 'administrateur' : input.role,
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

  const value: UsersContextValue = {
    users,
    currentUserId: currentUser?.id ?? DEMO_CURRENT_USER_ID,
    currentUser,
    isTestingUser,
    canTestUsers,
    testUser,
    stopTestingUser,
    addUser,
    updateUser,
    toggleUserStatus,
  }

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
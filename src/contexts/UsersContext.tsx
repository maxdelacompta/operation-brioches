import {
  createContext,
  useContext,
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
  stagiaire_communication: 'Stagiaire Communication',
  stagiaire_comptabilite: 'Stagiaire Comptabilité',
  developpeur: 'Développeur',
} as const

export type UserRole = keyof typeof ROLE_LABELS

export type UserStatus = 'actif' | 'inactif'

/** Affichage cohérent pour toute l'application : Prénom Nom. */
export function getUserDisplayName(user: Pick<AppUser, 'name' | 'prenom' | 'nom'> | null | undefined): string {
  if (!user) return 'Utilisateur'
  const ordered = [user.prenom?.trim(), user.nom?.trim()].filter(Boolean).join(' ')
  return ordered || user.name || 'Utilisateur'
}

export const POLE_LABELS = {
  communication: 'Communication',
  comptabilite: 'Comptabilité',
} as const
export type UserPole = keyof typeof POLE_LABELS


export type AppUser = {
  id: string
  name: string
  nom?: string
  prenom?: string
  email: string
  poste: string
  pole?: UserPole | null
  responsablePole?: boolean
  role: UserRole
  perimetre: string
  etablissementId?: string // Compatibilité avec les anciens modules
  etablissementIds?: string[]
  tousEtablissements?: boolean
  status: UserStatus
}

export type UserInput = Pick<
  AppUser,
  'name' | 'nom' | 'prenom' | 'email' | 'poste' | 'role' | 'perimetre' | 'etablissementId' | 'etablissementIds' | 'tousEtablissements'
> & Partial<Pick<AppUser, 'pole' | 'responsablePole'>>

/* =========================================================
   DONNÉES LOCALES
   ========================================================= */

export const STORAGE_KEY = 'ob-users-v1'

// Identifiant provisoire du profil actuellement affiché
// dans la Topbar. Il sera remplacé par l'identifiant
// fourni par l'authentification.
export const DEMO_CURRENT_USER_ID = 'demo-admin'

const demoAdmin: AppUser = {
  id: DEMO_CURRENT_USER_ID,
  name: 'Maxime Claudel',
  nom: 'Claudel',
  prenom: 'Maxime',
  email: '',
  poste: '',
  role: 'administrateur',
  perimetre: '',
  status: 'actif',
  etablissementIds: [],
  tousEtablissements: true,
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

/** Harmonise les comptes anciens (un seul établissement) avec le modèle multi-sites. */
export function normalizeUser(user: AppUser): AppUser {
  const ids = Array.isArray(user.etablissementIds)
    ? user.etablissementIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : (user.etablissementId ? [user.etablissementId] : [])
  const etablissementIds = [...new Set(ids)]
  const tousEtablissements = user.tousEtablissements === true
  return {
    ...user,
    name: user.prenom?.trim() && user.nom?.trim() ? `${user.prenom.trim()} ${user.nom.trim()}` : user.name,
    pole: user.pole && user.pole in POLE_LABELS ? user.pole : null,
    responsablePole: Boolean(user.responsablePole && user.pole && user.pole in POLE_LABELS),
    etablissementIds: tousEtablissements ? [] : etablissementIds,
    etablissementId: tousEtablissements ? '' : (etablissementIds[0] ?? ''),
    tousEtablissements,
  }
}

/* =========================================================
   CHARGEMENT
   ========================================================= */

export function loadUsers(): AppUser[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return [demoAdmin]
    }

    const parsed: unknown = JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return [demoAdmin]
    }

    const validUsers = parsed.filter(isAppUser).map(normalizeUser)

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

export type UsersContextValue = {
  users: AppUser[]
  currentUserId: string
  setCurrentUserId: (id: string) => void
  currentUser: AppUser | null
  addUser: (input: UserInput) => void
  updateUser: (id: string, input: UserInput) => void
  toggleUserStatus: (id: string) => void
}

export const UsersContext = createContext<
  UsersContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER
   ========================================================= */



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
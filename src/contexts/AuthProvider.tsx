import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useUsers, DEMO_CURRENT_USER_ID } from './UsersContext'
import { KEY, SESSION, type Credentials, type AuthValue, Context, readCredentials, hex, derive, initialSession } from "./AuthContext"

export function AuthProvider({ children }: { children: ReactNode }) {
  const { users, setCurrentUserId } = useUsers()
  const [credentials, setCredentials] = useState<Credentials>(readCredentials)
  const [sessionId, setSessionId] = useState<string | null>(initialSession)
  const needsSetup = !credentials[DEMO_CURRENT_USER_ID]
  const active = users.find(u => u.id === sessionId && u.status === 'actif')
  const userId = active && credentials[active.id] ? active.id : null
  // UsersContext restaure la session réelle au chargement ; ne pas écraser un profil simulé à chaque rendu.
  const persist = useCallback((next: Credentials) => { localStorage.setItem(KEY, JSON.stringify(next)); setCredentials(next) }, [])
  const setPassword = useCallback(async (id: string, password: string) => {
    if (password.length < 12) throw new Error('Utilise au moins 12 caractères.')
    if (!users.some(u => u.id === id && u.status === 'actif')) throw new Error('Compte introuvable ou inactif.')
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    persist({ ...readCredentials(), [id]: { salt, hash: await derive(password, salt) } })
  }, [persist, users])
  const setTemporaryPassword = useCallback(async (id: string, password: string) => {
    if (password.length < 12) throw new Error('Utilise au moins 12 caractères.')
    if (!users.some(u => u.id === id && u.status === 'actif')) throw new Error('Compte introuvable ou inactif.')
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    persist({ ...readCredentials(), [id]: { salt, hash: await derive(password, salt), mustChange: true } })
  }, [persist, users])
  const findUser = useCallback((identifier: string) => {
    const query = identifier.trim().toLocaleLowerCase('fr')
    return users.find(u => u.status === 'actif' && ((u.id === DEMO_CURRENT_USER_ID && query === 'admin') || (u.email.trim() && u.email.trim().toLocaleLowerCase('fr') === query)))
  }, [users])
  const changePassword = useCallback(async (identifier: string, current: string, next: string) => {
    const user = findUser(identifier)
    const record = user && readCredentials()[user.id]
    if (!record || !current || await derive(current, record.salt) !== record.hash) throw new Error('Identifiant ou mot de passe actuel incorrect.')
    if (next.length < 12) throw new Error('Le nouveau mot de passe doit contenir au moins 12 caractères.')
    if (current === next) throw new Error('Le nouveau mot de passe doit être différent de l’ancien.')
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    persist({ ...readCredentials(), [user!.id]: { salt, hash: await derive(next, salt), mustChange: false } })
  }, [findUser, persist])
  const initializeAdmin = useCallback(async (password: string) => {
    if (readCredentials()[DEMO_CURRENT_USER_ID]) throw new Error('Le compte administrateur est déjà initialisé.')
    await setPassword(DEMO_CURRENT_USER_ID, password)
  }, [setPassword])
  const signIn = useCallback(async (identifier: string, password: string): Promise<string | null> => {
    const user = findUser(identifier)
    if (!user || !credentials[user.id] || !password) return 'Identifiant ou mot de passe incorrect.'
    const record = credentials[user.id]
    if (await derive(password, record.salt) !== record.hash) return 'Identifiant ou mot de passe incorrect.'
    if (record.mustChange) return 'PASSWORD_CHANGE_REQUIRED'
    sessionStorage.setItem(SESSION, user.id)
    setSessionId(user.id)
    setCurrentUserId(user.id)
    return null
  }, [findUser, credentials, setCurrentUserId])
  const signOut = useCallback(() => { sessionStorage.removeItem(SESSION); sessionStorage.removeItem('ob-test-current-user-v1'); setSessionId(null) }, [])
  const value = useMemo<AuthValue>(() => ({ authenticated: Boolean(userId), userId, needsSetup, signIn, initializeAdmin, setPassword,
    hasPassword: id => Boolean(credentials[id]), setTemporaryPassword, changePassword, signOut }), [userId, needsSetup, signIn, initializeAdmin, setPassword, setTemporaryPassword, changePassword, signOut, credentials])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

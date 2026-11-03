import { createContext, useContext } from 'react'


export const KEY = 'ob2026-local-credentials-v1'
export const SESSION = 'ob2026-auth-session-v1'
type Credential = { salt: string; hash: string; mustChange?: boolean }
export type Credentials = Record<string, Credential>
export type AuthValue = {
  authenticated: boolean; userId: string | null; needsSetup: boolean
  signIn: (identifier: string, password: string) => Promise<string | null>
  initializeAdmin: (password: string) => Promise<void>
  setPassword: (userId: string, password: string) => Promise<void>
  hasPassword: (userId: string) => boolean
  setTemporaryPassword: (userId: string, password: string) => Promise<void>
  changePassword: (identifier: string, currentPassword: string, newPassword: string) => Promise<void>
  signOut: () => void
}
export const Context = createContext<AuthValue | null>(null)
export function readCredentials(): Credentials {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
  catch { return {} }
}
export function hex(buffer: ArrayBuffer): string { return [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, '0')).join('') }
export async function derive(password: string, salt: string) {
  const bytes = new TextEncoder()
  const secret = await crypto.subtle.importKey('raw', bytes.encode(password), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes.encode(salt), iterations: 210000, hash: 'SHA-256' }, secret, 256))
}
export function initialSession(): string | null { try { return sessionStorage.getItem(SESSION) } catch { return null } }

export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider manquant'); return value }

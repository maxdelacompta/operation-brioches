import type { AppUser, UserRole } from '../contexts/UsersContext'

/** Alertes manuelles du prototype. Stockage local, pas de synchronisation multi-postes. */
export type AlertPriority = 'basse' | 'normale' | 'haute'
export type AlertStatus = 'a_faire' | 'en_cours' | 'terminee'
export type UserAlert = {
  id: string
  title: string
  description: string
  module: string
  campagneId: string
  assigneeId: string
  creatorId: string
  priority: AlertPriority
  status: AlertStatus
  dueDate: string
  createdAt: string
  updatedAt: string
  /** Source technique : les alertes manuelles ne possèdent jamais cette clé. */
  automaticKey?: string
  automaticOpen?: boolean
}

const STORAGE_KEY = 'ob-user-alerts-v1'
export const ALERTS_EVENT = 'ob-user-alerts-changed'

/** Seuls les profils Communication et Stagiaire Communication reçoivent
 * les alertes automatiques du module Stocks brioches (pas les autres pôles,
 * ni les administrateurs). Les alertes manuelles ne sont pas concernées.
 */
export function estDestinataireAlertesStocks(role: UserRole | undefined): boolean {
  return role === 'communication' || role === 'stagiaire_communication'
}

/** Retire uniquement les alertes automatiques de stock qui auraient été
 * générées par une ancienne version pour un autre profil, devenu inactif,
 * ou dont le rôle a changé. Ne modifie pas les alertes manuelles.
 */
export function nettoyerAlertesStocksNonDestinataires(
  users: Array<Pick<AppUser, 'id' | 'role' | 'status'>>,
): void {
  const recipients = new Set(users
    .filter(user => user.status === 'actif' && estDestinataireAlertesStocks(user.role))
    .map(user => user.id))
  const all = readUserAlerts()
  const next = all.filter(alert =>
    !(alert.module === 'Stocks brioches' && alert.automaticKey && !recipients.has(alert.assigneeId)))
  if (next.length !== all.length) persist(next)
}

export const ALERT_MODULES = [
  'Commandes entreprises', 'Commandes Mairies / RS', 'Commandes achats',
  'Livraisons / Retraits', 'Stands', 'Fiches de caisse', 'Coffre',
  'Suivi banque', 'Justificatifs', 'Mécénat', 'Pertes / Écarts',
  'Stocks brioches', 'Administration', 'Autre',
] as const

function validAlert(value: unknown): value is UserAlert {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<UserAlert>
  return typeof item.id === 'string' && typeof item.title === 'string' &&
    typeof item.assigneeId === 'string' && typeof item.creatorId === 'string' &&
    (item.status === 'a_faire' || item.status === 'en_cours' || item.status === 'terminee')
}

export function readUserAlerts(): UserAlert[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.filter(validAlert) : []
  } catch { return [] }
}

function persist(alerts: UserAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  window.dispatchEvent(new Event(ALERTS_EVENT))
}

export function createUserAlert(
  input: Pick<UserAlert, 'title' | 'description' | 'module' | 'campagneId' | 'assigneeId' | 'creatorId' | 'priority' | 'dueDate'>,
): UserAlert {
  if (!input.title.trim() || !input.assigneeId || !input.creatorId) throw new Error('Titre et utilisateur obligatoires.')
  const now = new Date().toISOString()
  const alert: UserAlert = {
    ...input, title: input.title.trim(), description: input.description.trim(),
    id: crypto.randomUUID(), status: 'a_faire', createdAt: now, updatedAt: now,
  }
  persist([alert, ...readUserAlerts()])
  return alert
}

export function setUserAlertStatus(id: string, status: AlertStatus, actorId: string, isAdmin: boolean) {
  const entries = readUserAlerts()
  const index = entries.findIndex(alert => alert.id === id)
  if (index < 0) throw new Error('Alerte introuvable.')
  if (!isAdmin && entries[index].assigneeId !== actorId) throw new Error('Action non autorisée.')
  entries[index] = { ...entries[index], status, updatedAt: new Date().toISOString() }
  persist(entries)
}

export function deleteUserAlert(id: string, actorId: string, isAdmin: boolean) {
  const entries = readUserAlerts()
  const alert = entries.find(entry => entry.id === id)
  if (!alert) return
  if (!isAdmin && alert.creatorId !== actorId) throw new Error('Action non autorisée.')
  persist(entries.filter(entry => entry.id !== id))
}

/** Alimente le centre d'alertes EXISTANT. Idempotent et non destructif pour les alertes manuelles.
 * Les alertes déjà terminées par une personne ne sont pas rouvertes tant que
 * leur condition reste présente. Leur retour après disparition crée une nouvelle action.
 */
export function synchroniserAlertesStocks(input: {
  campagneId: string; assigneeId: string; assigneeRole: UserRole; alerts: Array<{
    key: string; title: string; description: string; priority: AlertPriority; dueDate: string
  }>
}): void {
  if (!input.assigneeId || !input.campagneId || !estDestinataireAlertesStocks(input.assigneeRole)) return
  const all = readUserAlerts()
  const now = new Date().toISOString()
  let changed = false
  const desired = new Map(input.alerts.map(a => [a.key,a]))
  for (const existing of all) {
    if (!existing.automaticKey || existing.campagneId !== input.campagneId || existing.assigneeId !== input.assigneeId) continue
    const next = desired.get(existing.automaticKey)
    if (next) {
      // Une action terminée manuellement reste terminée jusqu'à la résolution du signal.
      if (existing.automaticOpen === false) {
        existing.status = 'a_faire'
        existing.updatedAt = now
        changed = true
      }
      const updates = {title:next.title,description:next.description,priority:next.priority,dueDate:next.dueDate,automaticOpen:true}
      if (Object.entries(updates).some(([key,value]) => existing[key as keyof UserAlert] !== value)) {
        Object.assign(existing,updates)
        existing.updatedAt=now
        changed=true
      }
      desired.delete(existing.automaticKey)
    } else if (existing.automaticOpen !== false) {
      existing.automaticOpen=false
      if (existing.status !== 'terminee') existing.status='terminee'
      existing.updatedAt=now
      changed=true
    }
  }
  for (const a of desired.values()) {
    all.unshift({
      id:crypto.randomUUID(), title:a.title, description:a.description, module:'Stocks brioches',
      campagneId:input.campagneId,assigneeId:input.assigneeId,creatorId:input.assigneeId,
      priority:a.priority,status:'a_faire',dueDate:a.dueDate,createdAt:now,updatedAt:now,
      automaticKey:a.key,automaticOpen:true,
    })
    changed=true
  }
  if(changed) persist(all)
}

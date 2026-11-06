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
}

const STORAGE_KEY = 'ob-user-alerts-v1'
export const ALERTS_EVENT = 'ob-user-alerts-changed'

export const ALERT_MODULES = [
  'Commandes entreprises', 'Commandes Mairies / RS', 'Commandes achats',
  'Livraisons / Retraits', 'Stands', 'Fiches de caisse', 'Coffre',
  'Suivi banque', 'Justificatifs', 'Mécénat', 'Pertes / Écarts',
  'Administration', 'Autre',
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

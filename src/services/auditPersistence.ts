/**
 * Journalisation de sauvegardes explicites pour le prototype local.
 * Contrairement à un patch global de Storage.prototype, ce code est
 * directement appelé par le module qui persiste ses données.
 * Les données personnelles, anciens montants et contenus de fiches ne
 * sont jamais copiés dans le journal.
 */
import {
  recordActivity,
  type ActivityAction,
  type ActivityCategory,
} from './activityLog'

type RecordIdentity = { id?: unknown; numero?: unknown }

type Change = { action: ActivityAction; target: string }

function identifier(record: unknown): string | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const item = record as RecordIdentity
  const id = item.id ?? item.numero
  return (typeof id === 'string' || typeof id === 'number') && String(id).trim()
    ? String(id).slice(0, 100)
    : null
}

function indexRecords(records: unknown[]): Map<string, string> | null {
  const result = new Map<string, string>()
  for (const record of records) {
    const id = identifier(record)
    if (!id || result.has(id)) return null
    result.set(id, JSON.stringify(record))
  }
  return result
}

function findChanges(previous: unknown[], next: unknown[], label: string): Change[] | null {
  const oldById = indexRecords(previous)
  const newById = indexRecords(next)
  if (!oldById || !newById) return null
  const changes: Change[] = []
  for (const [id, value] of newById) {
    const old = oldById.get(id)
    if (old === undefined) changes.push({ action: 'creation', target: `${label} ${id}` })
    else if (old !== value) changes.push({ action: 'modification', target: `${label} ${id}` })
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) changes.push({ action: 'suppression', target: `${label} ${id}` })
  }
  return changes
}

function authenticatedActor(): { actorId: string | null; actorName: string } {
  try {
    const id = sessionStorage.getItem('ob2026-auth-session-v1')
    if (!id) return { actorId: null, actorName: 'Session locale non identifiée' }
    const users = JSON.parse(localStorage.getItem('ob-users-v1') || '[]') as unknown
    if (Array.isArray(users)) {
      const user = users.find(value =>
        typeof value === 'object' && value !== null && 'id' in value && value.id === id,
      ) as { prenom?: string; nom?: string; name?: string } | undefined
      if (user) return {
        actorId: id,
        actorName: [user.prenom, user.nom].filter(Boolean).join(' ') || user.name || id,
      }
    }
    return { actorId: id, actorName: id }
  } catch {
    return { actorId: null, actorName: 'Session locale non identifiée' }
  }
}

function campaignSuffix(scoped: boolean): string {
  if (!scoped) return ''
  try {
    const campaign = localStorage.getItem('ob-campagne-selection-v1')
    return campaign ? ` — campagne sélectionnée : ${campaign}` : ' — campagne non précisée'
  } catch {
    return ' — campagne non précisée'
  }
}

/**
 * Enregistre les données, puis décrit les éléments réellement ajoutés,
 * modifiés ou supprimés. La première initialisation ne crée pas une
 * fausse activité utilisateur.
 *
 * Ce suivi est une trace technique de sauvegarde, PAS une preuve d'identité
 * ni une description métier exhaustive de l'opération.
 */
export function persistAuditedCollection(
  key: string,
  records: readonly unknown[],
  category: ActivityCategory,
  label: string,
  campaignScoped = true,
): void {
  const next = JSON.stringify(records)
  const previous = localStorage.getItem(key)

  // L'écriture métier ne dépend pas de la réussite de la journalisation.
  localStorage.setItem(key, next)
  if (previous === null || previous === next) return

  let changes: Change[] | null = null
  let oldCount: number | null = null
  try {
    const oldRecords: unknown = JSON.parse(previous)
    if (Array.isArray(oldRecords)) {
      oldCount = oldRecords.length
      changes = findChanges(oldRecords, [...records], label)
    }
  } catch {
    // Une ancienne donnée illisible ne doit pas bloquer la sauvegarde.
  }

  const actor = authenticatedActor()
  const suffix = campaignSuffix(campaignScoped)
  const technicalNote = "Nature exacte de l'action à confirmer dans le journal métier."
  const count = changes?.length ?? 0

  if (changes && count > 0 && count <= 8) {
    for (const change of changes) {
      recordActivity({
        ...actor,
        category,
        source: 'automatique',
        action: change.action,
        target: change.target,
        message: `Écart constaté après sauvegarde${suffix}. ${technicalNote}`,
      })
    }
    return
  }

  if (previous !== next) {
    recordActivity({
      ...actor,
      category,
      source: 'automatique',
      action: 'modification',
      target: `${label} — sauvegarde groupée`,
      message: `Sauvegarde constatée (${oldCount ?? '?'} → ${records.length} enregistrement(s), ${count || 'différences non détaillées'} changement(s))${suffix}. ${technicalNote}`,
    })
  }
}

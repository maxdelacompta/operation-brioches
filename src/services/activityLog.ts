/* =========================================================
   JOURNAL D'ACTIVITÉ — OPÉRATION BRIOCHES
   Prototype local
   ========================================================= */

export const ACTIVITY_STORAGE_KEY =
  'ob-activity-log-v1'

export const ACTIVITY_EVENT_NAME =
  'ob-activity-log-updated'

export const MAX_ACTIVITY_ENTRIES = 2000

/* =========================================================
   CATÉGORIES
   ========================================================= */

export const ACTIVITY_CATEGORIES = {
  utilisateurs: 'Utilisateurs',
  roles: 'Rôles et permissions',
  campagnes: 'Campagnes',
  parametres: 'Paramètres généraux',
  commandes: 'Commandes',
  encaissements: 'Encaissements',
  donateurs: 'Donateurs',
  journal: "Journal d'activité",
  livraisons: 'Livraisons et retraits',
  stocks: 'Stocks et brioches',
  stands: 'Stands et compteurs',
  factures: 'Factures et règlements',
  mecanat: 'Mécénat',
  ecarts: 'Pertes et écarts',
  justificatifs: 'Justificatifs',
  fournisseurs: 'Fournisseurs et achats',
  benevoles: 'Bénévoles',
  mairies: 'Mairies et RS',
} as const

export type ActivityCategory =
  keyof typeof ACTIVITY_CATEGORIES

/* =========================================================
   ACTIONS
   ========================================================= */

export const ACTIVITY_ACTIONS = {
  creation: 'Création',
  modification: 'Modification',
  activation: 'Activation',
  desactivation: 'Désactivation',
  cloture: 'Clôture',
  duplication: 'Duplication',
  reinitialisation: 'Réinitialisation',
  export: 'Export',
  suppression: 'Suppression',
  consultation: 'Consultation',
} as const

export type ActivityAction =
  keyof typeof ACTIVITY_ACTIONS

// Les anciennes traces sans ce champ restent valides.
export type ActivitySource = 'metier' | 'automatique' | 'diagnostic'

/* =========================================================
   STRUCTURE D'UN ÉVÉNEMENT
   ========================================================= */

export type ActivityEntry = {
  id: string

  // Date ISO générée au moment de l'action.
  at: string

  // Identité déclarée par le prototype.
  actorId: string | null
  actorName: string

  category: ActivityCategory
  action: ActivityAction

  // Référence ou libellé de l'objet concerné.
  target: string

  // Description courte, sans donnée sensible.
  message: string
  source?: ActivitySource
}

export type NewActivityEntry = Omit<
  ActivityEntry,
  'id' | 'at'
>

/* =========================================================
   VALIDATION DES ENTRÉES STOCKÉES
   ========================================================= */

function isActivityEntry(
  value: unknown,
): value is ActivityEntry {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const item = value as Record<string, unknown>

  return (
    typeof item.id === 'string' &&
    typeof item.at === 'string' &&
    !Number.isNaN(
      Date.parse(item.at),
    ) &&
    (
      item.actorId === null ||
      typeof item.actorId === 'string'
    ) &&
    typeof item.actorName === 'string' &&
    typeof item.category === 'string' &&
    Object.prototype.hasOwnProperty.call(
      ACTIVITY_CATEGORIES,
      item.category,
    ) &&
    typeof item.action === 'string' &&
    Object.prototype.hasOwnProperty.call(
      ACTIVITY_ACTIONS,
      item.action,
    ) &&
    typeof item.target === 'string' &&
    typeof item.message === 'string' &&
    (item.source === undefined ||
      item.source === 'metier' ||
      item.source === 'automatique' ||
      item.source === 'diagnostic')
  )
}

/* =========================================================
   IDENTIFIANT
   ========================================================= */

function createActivityId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    'activity',
    Date.now(),
    Math.random().toString(36).slice(2),
  ].join('-')
}

/* =========================================================
   LECTURE
   ========================================================= */

export function readActivityLog(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(
      ACTIVITY_STORAGE_KEY,
    )

    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(isActivityEntry)
      .sort(
        (a, b) =>
          new Date(b.at).getTime() -
          new Date(a.at).getTime(),
      )
      .slice(0, MAX_ACTIVITY_ENTRIES)
  } catch {
    console.warn(
      "Impossible de lire le journal d'activité.",
    )

    return []
  }
}

/* =========================================================
   ENREGISTREMENT

   À appeler UNIQUEMENT après une action réussie.
   ========================================================= */

export function recordActivity(
  data: NewActivityEntry,
): boolean {
  try {
    const entry: ActivityEntry = {
      ...data,
      source: data.source ?? 'metier',

      id: createActivityId(),

      at: new Date().toISOString(),
    }

    const existing = readActivityLog()

    const updated = [
      entry,
      ...existing,
    ].slice(
      0,
      MAX_ACTIVITY_ENTRIES,
    )

    localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify(updated),
    )

    // Actualisation immédiate des composants
    // ouverts dans le même onglet.
    window.dispatchEvent(
      new Event(ACTIVITY_EVENT_NAME),
    )

    return true
  } catch {
    console.warn(
      "L'action a été effectuée, mais sa journalisation a échoué.",
    )

    return false
  }
}
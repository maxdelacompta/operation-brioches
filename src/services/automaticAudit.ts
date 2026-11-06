/**
 * Collecteur de sauvegardes locales, complémentaire aux journaux explicites.
 * Ce code ne stocke ni valeur personnelle ni contenu d'enregistrement.
 * Le prototype ne fournit pas de piste d'audit inter-postes sécurisée.
 */
import {
  recordActivity,
  readActivityLog,
  ACTIVITY_STORAGE_KEY,
  type ActivityCategory,
} from './activityLog'

const SKIP = /(?:credential|password|auth|session|token|secret|jwt|salt|hash|cache|geocod|sidebar|floating|pinned|page-size|widget|dashboard-layout|theme|campagne-selection|test-mode|backup|sauvegarde|current-user|search|preferences|local-credentials)/i

// Les collections principales sont directement journalisées dans ObDataProvider.
// Ne pas produire deux traces pour la même sauvegarde.
const DIRECT_AUDIT_KEYS = new Set([
  'ob-donateurs', 'ob-commandes', 'ob-fiches-caisse', 'ob-campagnes-v1',
])
const PROBE_KEY = 'ob-audit-probe-v1'

type Runtime = {
  installed: boolean
  interceptedWrites: number
  matchedWrites: number
  lastKey: string | null
  lastError: string | null
  probeSequence: number
  busy: boolean
}

type AuditWindow = Window & { __obAutomaticAuditRuntimeV2?: Runtime }

function runtime(): Runtime | null {
  if (typeof window === 'undefined') return null
  const current = window as AuditWindow
  if (!current.__obAutomaticAuditRuntimeV2) {
    current.__obAutomaticAuditRuntimeV2 = {
      installed: false,
      interceptedWrites: 0,
      matchedWrites: 0,
      lastKey: null,
      lastError: null,
      probeSequence: 0,
      busy: false,
    }
  }
  return current.__obAutomaticAuditRuntimeV2
}

function categoryForKey(key: string): ActivityCategory | null {
  if (key === PROBE_KEY) return 'journal'
  if (key === ACTIVITY_STORAGE_KEY || DIRECT_AUDIT_KEYS.has(key) || SKIP.test(key)) return null
  if (!/^(?:ob[-\d_]|operation[-_]|brioche[-_])/i.test(key)) return null
  if (/livraison|retrait|tournee|tournée|route|affectation/i.test(key)) return 'livraisons'
  if (/stand|compteur|cloture|clôture/i.test(key)) return 'stands'
  if (/stock|brioche|mouvement/i.test(key)) return 'stocks'
  if (/facture|reglement|règlement/i.test(key)) return 'factures'
  if (/justificatif|jdi|jdp|chorus/i.test(key)) return 'justificatifs'
  if (/cheque|chèque|remise|banque|coffre|caisse|tpe|encaissement|depot|dépôt/i.test(key)) return 'encaissements'
  if (/benevole|bénévole/i.test(key)) return 'benevoles'
  if (/mairie|\brs\b/i.test(key)) return 'mairies'
  if (/fournisseur|artisan|industriel|gms|achats/i.test(key)) return 'fournisseurs'
  if (/commande/i.test(key)) return 'commandes'
  if (/donateur/i.test(key)) return 'donateurs'
  if (/campagne/i.test(key)) return 'campagnes'
  if (/permission|roles|rôles/i.test(key)) return 'roles'
  if (/users|utilisateur/i.test(key)) return 'utilisateurs'
  if (/parametre|paramètre|settings|configuration/i.test(key)) return 'parametres'
  return null
}

function actor(): { actorId: string | null; actorName: string } {
  try {
    const id = sessionStorage.getItem('ob2026-auth-session-v1')
    if (!id) return { actorId: null, actorName: 'Session locale non identifiée' }
    const users: unknown = JSON.parse(localStorage.getItem('ob-users-v1') || '[]')
    if (Array.isArray(users)) {
      const user = users.find(item =>
        typeof item === 'object' && item !== null && 'id' in item && item.id === id,
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

function campaign(): string {
  try { return localStorage.getItem('ob-campagne-selection-v1') || 'campagne non précisée' }
  catch { return 'campagne non précisée' }
}

function describe(key: string): string {
  return key.length <= 90 ? key : `${key.slice(0, 87)}...`
}

function readOld(storage: Storage, key: string): string | null {
  try { return Storage.prototype.getItem.call(storage, key) }
  catch { return null }
}

export function isAutomaticAuditInstalled(): boolean {
  return runtime()?.installed ?? false
}

export function getAutomaticAuditDiagnostics(): {
  installed: boolean; interceptedWrites: number; matchedWrites: number;
  lastKey: string | null; lastError: string | null
} {
  const state = runtime()
  return {
    installed: state?.installed ?? false,
    interceptedWrites: state?.interceptedWrites ?? 0,
    matchedWrites: state?.matchedWrites ?? 0,
    lastKey: state?.lastKey ?? null,
    lastError: state?.lastError ?? null,
  }
}

export function installAutomaticAudit(): void {
  const state = runtime()
  if (!state || state.installed) return
  try {
    // Si Vite recharge ce module, ne pas empiler plusieurs intercepteurs.
    const originalSetItem = Storage.prototype.setItem
    const originalRemoveItem = Storage.prototype.removeItem

    Storage.prototype.setItem = function (key: string, value: string): void {
      const isLocal = this === window.localStorage
      const before = isLocal && !state.busy ? readOld(this, key) : null
      originalSetItem.call(this, key, value)
      if (!isLocal || state.busy) return
      state.interceptedWrites += 1
      state.lastKey = key
      if (before === value) return
      const category = categoryForKey(key)
      if (!category) return
      state.matchedWrites += 1
      state.busy = true
      try {
        const test = key === PROBE_KEY
        const success = recordActivity({
          ...actor(),
          category,
          source: test ? 'diagnostic' : 'automatique',
          action: 'modification',
          target: test ? 'Test de capture automatique' : describe(key),
          message: test
            ? 'TEST TECHNIQUE — Le collecteur a intercepté une sauvegarde locale.'
            : `Sauvegarde détectée (${campaign()}). Nature exacte de l'action à confirmer dans le journal métier.`,
        })
        if (!success) state.lastError = `Journalisation refusée pour ${describe(key)}`
      } finally {
        state.busy = false
      }
    }

    Storage.prototype.removeItem = function (key: string): void {
      const isLocal = this === window.localStorage
      const before = isLocal && !state.busy ? readOld(this, key) : null
      originalRemoveItem.call(this, key)
      if (!isLocal || state.busy || before === null) return
      state.interceptedWrites += 1
      state.lastKey = key
      const category = categoryForKey(key)
      if (!category || key === PROBE_KEY) return
      state.matchedWrites += 1
      state.busy = true
      try {
        const success = recordActivity({
          ...actor(), category, source: 'automatique', action: 'suppression', target: describe(key),
          message: `Suppression d'un stockage local (${campaign()}). Nature exacte de l'action à confirmer dans le journal métier.`,
        })
        if (!success) state.lastError = `Journalisation refusée pour ${describe(key)}`
      } finally {
        state.busy = false
      }
    }
    state.installed = true
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : 'Interception indisponible'
  }
}

/** Vérifie vraiment l'interception localStorage, pas seulement recordActivity. */
export function probeAutomaticAudit(): { success: boolean; message: string } {
  const state = runtime()
  if (!state?.installed) return { success: false, message: 'Collecteur non installé au démarrage.' }
  const before = readActivityLog()
  const knownIds = new Set(before.map(entry => entry.id))
  try {
    state.probeSequence += 1
    window.localStorage.setItem(PROBE_KEY, `${Date.now()}-${state.probeSequence}`)
    const captured = readActivityLog().some(entry =>
      !knownIds.has(entry.id) && entry.target === 'Test de capture automatique',
    )
    return {
      success: captured,
      message: captured
        ? 'Interception et journalisation confirmées.'
        : 'La sauvegarde test n’a pas produit d’événement. Vérifier le collecteur et les erreurs de stockage.',
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Échec du test de sauvegarde.' }
  }
}

// Compatibilité : les anciennes versions de main.tsx importaient ce module
// uniquement pour son effet de démarrage.
installAutomaticAudit()

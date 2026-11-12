/** Réinitialisation locale sélective d'OB 2026.
 * N'effectue JAMAIS localStorage.clear() et ne supprime aucune entrée 2025.
 * Les données non datées/non rattachées restent intactes, par prudence.
 */
export const RESET_YEAR = 2026

export type StorageChange = {
  key: string
  previous: string | null
  next: string | null
  removed: number
  kept: number
  label: string
}
export type ResetPlan = {
  changes: StorageChange[]
  unclassified: string[]
  totalRemoved: number
  estCount: number
  profilesCount: number
  protected2025Refs: number
}

type RecordData = Record<string, unknown>
const item = (value: unknown): value is RecordData =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
const year = (value: unknown) => String(value ?? '').match(/(?:^|[^0-9])2026(?:[^0-9]|$)/) !== null
const year2025 = (value: unknown) => String(value ?? '').match(/(?:^|[^0-9])2025(?:[^0-9]|$)/) !== null
const id = (value: unknown) => value == null ? '' : String(value)
const readJson = (storage: Storage, key: string): unknown => {
  const raw = storage.getItem(key)
  if (raw === null) return null
  try { return JSON.parse(raw) as unknown }
  catch { throw new Error(`Impossible de lire « ${key} » : JSON invalide. Aucune suppression effectuée.`) }
}
const array = (storage: Storage, key: string): unknown[] => {
  const value = readJson(storage, key)
  if (value === null) return []
  if (!Array.isArray(value)) throw new Error(`Format de tableau inattendu dans « ${key} » : arrêt par sécurité.`)
  return value
}
const object = (storage: Storage, key: string): RecordData => {
  const value = readJson(storage, key)
  if (value === null) return {}
  if (!item(value)) throw new Error(`Format d'objet inattendu dans « ${key} » : arrêt par sécurité.`)
  return value
}
const campaignValue = (row: RecordData) => row.campagne ?? row.campagneId ?? row.campaignId
const exact2026 = (row: RecordData) => year(campaignValue(row)) || (row.annee === 2026 && campaignValue(row) == null)
const hasCampaign = (row: RecordData) => campaignValue(row) != null && id(campaignValue(row)).trim() !== ''
const dated2026 = (row: RecordData) => !hasCampaign(row) && year(id(row.date).slice(0, 10))
const rowId = (row: unknown) => item(row) ? id(row.id) : ''

export function buildResetPlan(storage: Storage, administratorId: string): ResetPlan {
  const changes: StorageChange[] = []
  const touched = new Set<string>()
  const add = (key: string, next: string | null, removed: number, kept: number, label: string) => {
    const previous = storage.getItem(key)
    if (previous === null || previous === next) return
    changes.push({ key, previous, next, removed, kept, label })
    touched.add(key)
  }
  const filtered = (key: string, label: string, predicate: (row: RecordData) => boolean) => {
    const list = array(storage, key)
    const kept = list.filter(row => !item(row) || !predicate(row))
    add(key, JSON.stringify(kept), list.length - kept.length, kept.length, label)
    return list.filter(row => item(row) && predicate(row))
  }
  const removedCommands = filtered('ob-commandes', 'Commandes entreprises 2026', exact2026)
  filtered('ob-fiches-caisse', 'Fiches de caisse 2026', exact2026)
  filtered('ob-depots-banque-v1', 'Dépôts bancaires 2026', exact2026)
  filtered('ob-commandes-artisans-v1', 'Achats fournisseurs 2026', exact2026)
  filtered('ob-commandes-gms-v1', 'Achats GMS 2026', exact2026)
  filtered('ob-commandes-mairies-rs-v1', 'Commandes Mairies / RS 2026', exact2026)
  filtered('ob-justificatifs-dons-v1', 'Justificatifs JDI / JDP 2026', exact2026)
  filtered('ob-suivi-caisse-tpe-v1', 'Mouvements Caisse / TPE 2026', exact2026)
  filtered('ob-mecenat-table-v1', 'Mécénat 2026', exact2026)
  filtered('ob-pertes-ecarts-table-v1', 'Pertes / écarts 2026', exact2026)
  filtered('ob-user-alerts-v1', 'Alertes 2026', exact2026)
  filtered('ob-justificatifs-mail-suivi-v1', 'Préparations e-mails JD 2026', exact2026)

  const removedFactures = filtered('ob2026-factures-paiements-v1', 'Factures fournisseurs 2026', exact2026)
  const facturesIds = new Set(removedFactures.map(rowId).filter(Boolean))
  filtered('ob2026-reglements-factures-v1', 'Règlements des factures 2026', row =>
    exact2026(row) || facturesIds.has(id(row.factureId)))

  const removedCheques = filtered('ob2026-cheques-v1', 'Chèques 2026', exact2026)
  const removedChequeRemises = new Set(removedCheques.filter(item).map(row => id(row.remiseId)).filter(Boolean))
  filtered('ob2026-remises-cheques-v1', 'Remises chèques 2026', row =>
    exact2026(row) || removedChequeRemises.has(id(row.id)))

  const removedOrderIds = new Set(removedCommands.map(rowId).filter(Boolean))
  // Missions sans campagne : uniquement celles liées à une commande supprimée.
  filtered('ob-livraisons-retraits-v1', 'Livraisons liées aux commandes 2026', row =>
    exact2026(row) || removedOrderIds.has(id(row.commandeId)))
  const multiKey = 'ob-livraisons-multisites-v1'
  const multi = object(storage, multiKey)
  const multiKept = Object.fromEntries(Object.entries(multi).filter(([key, value]) => {
    if (!item(value)) return true
    return !exact2026(value) && !removedOrderIds.has(id(value.commandeId)) &&
      !removedOrderIds.has(key.split(':')[0])
  }))
  add(multiKey, JSON.stringify(multiKept), Object.keys(multi).length - Object.keys(multiKept).length, Object.keys(multiKept).length, 'Affectations multi-sites 2026')

  const standsDeleted = filtered('ob-stands-brioches-v1', 'Stands 2026', row =>
    exact2026(row) || dated2026(row))
  const standIds = new Set(standsDeleted.map(rowId).filter(Boolean))
  const standPrefixes = [
    'ob-stand-operations-v1-', 'ob-stand-operations-audit-v1-', 'ob-stand-cloture-v1-',
  ]
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (!key) continue
    for (const prefix of standPrefixes) {
      if (key.startsWith(prefix) && standIds.has(key.slice(prefix.length))) {
        add(key, null, 1, 0, 'Compteur / clôture du stand 2026')
        break
      }
    }
    if ((key.startsWith('ob-stands-weeks-locked-v1-') || key.startsWith('ob-stands-reattributions-v1-')) && year(key)) {
      add(key, null, 1, 0, 'Paramètres stands 2026')
    }
  }

  // Anciennes clés 'ob2026' : elles ont parfois accueilli des mouvements
  // datés de 2025 avant la séparation par campagne. Ne jamais les effacer.
  for (const key of [
    'ob2026-stock-brioches-demo-v1', 'ob2026-demo-dons-contrepartie-v1',
    'ob-2026-stock-brioches-v1', 'ob-2026-dons-contrepartie-v1',
  ]) {
    const list = array(storage, key)
    const kept = list.filter(row => item(row) && (
      year2025(campaignValue(row)) || year2025(id(row.date).slice(0, 10))
    ))
    add(key, JSON.stringify(kept), list.length - kept.length, kept.length, 'Stock et dons de brioches 2026 (historique 2025 conservé)')
  }

  // Métadonnées de tournée : retirer les entrées explicitement 2026.
  for (const key of [
    'ob-livraisons-departs-v1', 'ob-livraisons-ordre-v1',
    'ob-livraisons-horaires-depart-v1', 'ob-livraisons-routes-v1',
    'ob-livraisons-reattribution-v1',
  ]) {
    const data = object(storage, key)
    const kept = Object.fromEntries(Object.entries(data).filter(([subkey, value]) =>
      !year(subkey) && !(item(value) && exact2026(value))))
    add(key, JSON.stringify(kept), Object.keys(data).length - Object.keys(kept).length, Object.keys(kept).length, 'Planning de livraisons 2026')
  }

  // Réglages de justificatifs par campagne : conserver toutes les entrées 2025.
  const settingsKey = 'ob-campagne-justificatifs-v1'
  const settings = object(storage, settingsKey)
  const keptSettings = Object.fromEntries(Object.entries(settings).filter(([key]) => !year(key)))
  add(settingsKey, JSON.stringify(keptSettings), Object.keys(settings).length - Object.keys(keptSettings).length, Object.keys(keptSettings).length, 'Réglages PDF JDI/JDP 2026')

  // La campagne 2026 reste comme conteneur vide, nécessaire pour les imports.
  const campaignKey = 'ob-campagnes-v1'
  const campaigns = array(storage, campaignKey)
  const nextCampaigns = campaigns.map(row => {
    if (!item(row) || !year(row.id) && row.annee !== 2026) return row
    return {
      ...row, statut: 'A_CONFIGURER', description: '', dateDebut: '', dateFin: '',
      objectifBrioches: null, objectifDonateurs: null, budgetPrevisionnel: null,
      prixUnitaire: null,
    }
  })
  add(campaignKey, JSON.stringify(nextCampaigns), campaigns.filter(row => item(row) && (year(row.id) || row.annee === 2026)).length,
    campaigns.filter(row => item(row) && (year2025(row.id) || row.annee === 2025)).length, 'Remise à zéro des paramètres OB 2026 (conserve la campagne)')

  // Bases partagées : suppression explicite demandée, indépendamment des campagnes.
  const etabs = array(storage, 'ob-etablissements-aeim-v1')
  add('ob-etablissements-aeim-v1', '[]', etabs.length, 0, 'BDD Établissements (globale)')
  const users = array(storage, 'ob-users-v1')
  const keptUsers = users.filter(row => item(row) && row.id === administratorId && row.role === 'administrateur')
  if (keptUsers.length !== 1) throw new Error('Compte administrateur à conserver introuvable : reset annulé.')
  add('ob-users-v1', JSON.stringify(keptUsers), users.length - keptUsers.length, keptUsers.length, 'Profils (conserve administrateur)')
  const credentialsKey = 'ob2026-local-credentials-v1'
  const credentials = object(storage, credentialsKey)
  const keptCred = Object.fromEntries(Object.entries(credentials).filter(([key]) => key === administratorId))
  add(credentialsKey, JSON.stringify(keptCred), Object.keys(credentials).length - Object.keys(keptCred).length, Object.keys(keptCred).length, 'Identifiants des profils supprimés')

  // Les droits globaux, comptes bancaires, donateurs, mairies, bénévoles et
  // fournisseurs sont conservés : leurs données peuvent être utilisées en 2025.
  const protected2025Refs = array(storage, 'ob-fiches-caisse')
    .filter(row => item(row) && year2025(campaignValue(row)) && Boolean(row.etablissementId)).length +
    array(storage, 'ob-2025-stock-brioches-v1').length

  const unclassified: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && !touched.has(key) && /^(ob[-_]|ob2026[-_])/i.test(key) && year(key) &&
        !['ob2026-local-credentials-v1','ob2026-auth-session-v1','ob2026-remises-cheques-chrono-v1','ob2026-dev-test-mode-v1'].includes(key)) {
      unclassified.push(key)
    }
  }
  return { changes, unclassified, totalRemoved: changes.reduce((n,c) => n+c.removed,0),
    estCount: etabs.length, profilesCount: users.length-keptUsers.length, protected2025Refs }
}

/** Vérification anti-régression : compare toutes les entrées historiques 2025 avant et après. */
export function assert2025Preserved(storage: Storage, before: Record<string,string|null>): void {
  for (const [key, previous] of Object.entries(before)) {
    const old: unknown = previous ? JSON.parse(previous) : null
    const now = storage.getItem(key)
    const next: unknown = now ? JSON.parse(now) : null
    const select2025 = (source: unknown) => Array.isArray(source)
      ? source.filter(row => item(row) && (year2025(campaignValue(row)) || (!hasCampaign(row) && (year2025(row.id) || row.annee === 2025))))
      : []
    if (Array.isArray(old) && JSON.stringify(select2025(old)) !== JSON.stringify(select2025(next)))
      throw new Error(`L'historique 2025 a changé dans ${key}. Restauration immédiate.`)
    if (key.includes('2025') && now !== previous)
      throw new Error(`Une clé réservée à OB 2025 a changé : ${key}`)
  }
}

export function applyResetPlan(storage: Storage, plan: ResetPlan): void {
  const prior: Record<string, string | null> = {}
  try {
    for (const change of plan.changes) {
      if (storage.getItem(change.key) !== change.previous) throw new Error(`Les données « ${change.key} » ont changé depuis l'aperçu : recommence.`)
      prior[change.key] = change.previous
      if (change.next === null) storage.removeItem(change.key)
      else storage.setItem(change.key, change.next)
    }
    assert2025Preserved(storage, prior)
  } catch (error) {
    for (const [key, before] of Object.entries(prior)) {
      if (before === null) storage.removeItem(key)
      else storage.setItem(key, before)
    }
    throw error
  }
}

export function snapshotAllObStorage(storage: Storage): Record<string,string|null> {
  const result: Record<string,string|null> = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && /^(ob[-_]|ob2026[-_]|operation-brioches[-_])/i.test(key)) result[key] = storage.getItem(key)
  }
  return result
}

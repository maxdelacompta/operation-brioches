import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUsers, DEMO_CURRENT_USER_ID } from '../contexts/UsersContext'
import './ResetOB2026.css'

const VERSION = '2026-10-reset-v1'
const EMPTY_LIST_KEYS = [
  'ob-donateurs', 'ob-commandes', 'ob-fiches-caisse', 'ob-campagnes-v1',
  'ob-depots-banque-v1', 'ob-fournisseurs-v1', 'ob-artisans-v1',
  'ob-commandes-artisans-v1', 'ob-bdd-mairies-v1', 'ob-bdd-benevoles-v1',
  'ob-etablissements-aeim-v1', 'ob-commandes-mairies-rs-v1',
  'ob-justificatifs-dons-v1', 'ob-livraisons-retraits-v1',
  'ob2026-stock-brioches-demo-v1', 'ob2026-demo-dons-contrepartie-v1',
  'ob-suivi-caisse-tpe-v1',
]
const isOBKey = (key: string) => /^(ob[-_]|ob2026[-_]|operation-brioches[-_])/i.test(key)
const storageSnapshot = (storage: Storage) => Object.fromEntries(
  Array.from({length: storage.length}, (_, i) => storage.key(i))
    .filter((key): key is string => Boolean(key && isOBKey(key)))
    .map(key => [key, storage.getItem(key)]),
)
function downloadJson(value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `OB2026-sauvegarde-avant-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
export default function ResetOB2026() {
  const { currentUser, users } = useUsers()
  const navigate = useNavigate()
  const [backedUp, setBackedUp] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState('')
  const isAdmin = currentUser?.role === 'administrateur'
  const stats = useMemo(() => ({
    local: Object.keys(storageSnapshot(localStorage)).length,
    session: Object.keys(storageSnapshot(sessionStorage)).length,
  }), [])
  function backup() {
    try {
      downloadJson({version: VERSION, exportedAt: new Date().toISOString(), origin: window.location.origin,
        localStorage: storageSnapshot(localStorage), sessionStorage: storageSnapshot(sessionStorage),
        note: 'Cette sauvegarde concerne uniquement localStorage et sessionStorage, pas IndexedDB, fichiers ou serveur.'})
      setBackedUp(true)
      setError('')
    } catch {
      setError('La sauvegarde a échoué. Aucune donnée n’a été effacée.')
    }
  }
  function reset() {
    if (!isAdmin || !backedUp || !confirmed || phrase !== 'RESET OB2026') return
    if (!window.confirm('Dernière confirmation : vider les données locales OB2026 et conserver uniquement le compte Administrateur ?')) return
    try {
      const admin = users.find(user => user.id === DEMO_CURRENT_USER_ID)
      if (!admin) throw new Error('Compte administrateur de démonstration introuvable.')
      const localKeys = Object.keys(storageSnapshot(localStorage))
      const sessionKeys = Object.keys(storageSnapshot(sessionStorage))
      // Écriture explicite des tableaux vides : évite de recharger les données de démonstration.
      const update = new Map<string,string>()
      for (const key of EMPTY_LIST_KEYS) update.set(key, '[]')
      update.set('ob-users-v1', JSON.stringify([{...admin, role: 'administrateur', status: 'actif', etablissementId: '', etablissementIds: [], allEtablissements: true}]))
      // Préparation puis bascule des clés OB seulement. Aucun clear() global.
      for (const key of localKeys) if (!update.has(key)) localStorage.removeItem(key)
      for (const [key, value] of update) localStorage.setItem(key, value)
      for (const key of sessionKeys) sessionStorage.removeItem(key)
      sessionStorage.setItem('ob-test-current-user-v1', DEMO_CURRENT_USER_ID)
      navigate('/', {replace: true})
      window.location.reload()
    } catch (e) {
      setError(`Réinitialisation interrompue : ${e instanceof Error ? e.message : 'erreur inconnue'}. Restaure la sauvegarde avant de recommencer.`)
    }
  }
  if (!isAdmin) return <main className="ob-reset-page"><h1>Accès réservé</h1><p>Seul le compte Administrateur peut effectuer cette opération.</p></main>
  return <main className="ob-reset-page">
    <header><span>ADMINISTRATION / MAINTENANCE</span><h1>Réinitialiser OB2026</h1><p>Repartir de données et paramètres locaux vierges, sans modifier le code du logiciel.</p></header>
    <section className="ob-reset-card"><h2>1. Sauvegarde avant suppression</h2>
      <p>{stats.local} clés locales et {stats.session} clés de session OB2026 détectées. Télécharge la copie JSON puis vérifie sa présence dans tes téléchargements.</p>
      <button type="button" className="ob-reset-backup" onClick={backup}>Télécharger la sauvegarde JSON</button>
      {backedUp && <p className="ob-reset-note">Sauvegarde déclenchée. Vérifie que le fichier a bien été téléchargé.</p>}
    </section>
    <section className="ob-reset-card"><h2>2. Confirmer le reset</h2>
      <p>Seront réinitialisés : fournisseurs, achats, donateurs, mairies, bénévoles, établissements, commandes, fiches de caisse, stocks, dons, préférences, rôles et permissions locales. Le profil Administrateur restera actif.</p>
      <p className="ob-reset-warning">Les pièces/documents stockés en IndexedDB, fichiers importés sur disque et données serveur ne sont pas inclus : ne les considère pas sauvegardés ni effacés par cet outil.</p>
      <label className="ob-reset-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> J'ai vérifié ma sauvegarde et j'accepte l'effacement des données locales OB2026.</label>
      <label className="ob-reset-label">Saisis <strong>RESET OB2026</strong> pour confirmer<input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="RESET OB2026" autoComplete="off" /></label>
      <button type="button" className="ob-reset-danger" disabled={!backedUp || !confirmed || phrase !== 'RESET OB2026'} onClick={reset}>Réinitialiser les données locales</button>
      {error && <p role="alert" className="ob-reset-error">{error}</p>}
    </section>
  </main>
}

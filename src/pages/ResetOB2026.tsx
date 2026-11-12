import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUsers } from '../contexts/UsersContext'
import { applyResetPlan, buildResetPlan, snapshotAllObStorage } from '../lib/resetCampagne2026'
import './ResetOB2026.css'

const PHRASE = 'EFFACER OB 2026'
function downloadBackup(value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Operation-Brioche-sauvegarde-complete-avant-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export default function ResetOB2026() {
  const { currentUser } = useUsers()
  const admin = currentUser?.role === 'administrateur'
  const [backupDone, setBackupDone] = useState(false)
  const [checked, setChecked] = useState(false)
  const [sharedChecked, setSharedChecked] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [running, setRunning] = useState(false)
  const plan = useMemo(() => {
    if (!admin) return null
    try { void revision; return { data: buildResetPlan(localStorage, currentUser?.id ?? ''), error: '' } }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : 'Données locales illisibles.' } }
  // Recalcul explicite après actualisation de l'aperçu ; les clés contrôlées sont revérifiées à l'application.
  }, [admin, currentUser?.id, revision])

  function sauvegarder() {
    if (!admin) return
    try {
      downloadBackup({
        format: 'operation-brioches-local-backup-v1',
        createdAt: new Date().toISOString(),
        origin: window.location.origin,
        localStorage: snapshotAllObStorage(localStorage),
        sessionStorage: snapshotAllObStorage(sessionStorage),
        notice: 'Sauvegarde du navigateur uniquement. Les fichiers IndexedDB, disques, SharePoint ou serveur ne sont pas inclus. Contient des données personnelles et des empreintes de mot de passe : conserver en lieu sûr.',
      })
      setBackupDone(true)
      setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de créer la sauvegarde.') }
  }
  function executer() {
    const adminId = currentUser?.id
    if (!admin || !adminId || !plan?.data || !backupDone || !checked || !sharedChecked || phrase !== PHRASE || running) return
    if (!window.confirm('Dernière confirmation : effacer les données 2026 ainsi que les établissements et profils (sauf l’administrateur), en conservant 2025 ?')) return
    setRunning(true)
    try {
      // Un plan obsolète est refusé à l'exécution, sans suppression partielle.
      applyResetPlan(localStorage, plan.data)
      sessionStorage.removeItem('ob-test-current-user-v1')
      sessionStorage.setItem('ob2026-auth-session-v1', adminId)
      localStorage.setItem('ob-campagne-selection-v1', 'OB 2026')
      window.location.assign('/administration/campagnes')
    } catch (e) {
      setRunning(false)
      setBackupDone(false)
      setRevision(v => v + 1)
      setError(e instanceof Error ? e.message : 'Réinitialisation interrompue, aucune suppression confirmée.')
    }
  }
  if (!admin) return <main className="ob-reset-page"><h1>Accès réservé</h1><p>Cette opération est réservée à l'administrateur.</p></main>
  return <main className="ob-reset-page">
    <header><span>ADMINISTRATION / MAINTENANCE</span><h1>Réinitialiser la campagne 2026</h1>
      <p>Préserver OB 2025, repartir de données 2026 vierges et réimporter les bonnes informations.</p></header>
    <section className="ob-reset-card"><h2>1. Aperçu des suppressions</h2>
      <p>Les listes mixtes 2025/2026 sont filtrées en conservant leurs lignes 2025. La campagne OB 2026 restera disponible, avec ses objectifs et paramètres remis à zéro pour faciliter les imports.</p>
      {plan?.error && <p role="alert" className="ob-reset-error">{plan.error}</p>}
      {plan?.data && <>
        <div className="ob-reset-metrics"><strong>{plan.data.totalRemoved} éléments ciblés</strong><strong>{plan.data.estCount} établissements</strong><strong>{plan.data.profilesCount} profils supprimés</strong></div>
        <div className="ob-reset-scroll"><table><thead><tr><th>Module / type</th><th>Supprimés</th><th>Conservés</th></tr></thead><tbody>{plan.data.changes.map(c=><tr key={c.key}><td>{c.label}<small>{c.key}</small></td><td>{c.removed}</td><td>{c.kept}</td></tr>)}</tbody></table></div>
        {plan.data.unclassified.length>0 && <p className="ob-reset-warning">Clés non classées, conservées par prudence : {plan.data.unclassified.join(', ')}.</p>}
        <button type="button" className="ob-reset-refresh" onClick={()=>{setRevision(v=>v+1);setBackupDone(false);setChecked(false);setSharedChecked(false)}}>Actualiser l'aperçu</button>
      </>}
    </section>
    <section className="ob-reset-card"><h2>2. Sauvegarde avant suppression</h2>
      <p>Une copie JSON de toutes les clés locales OB est créée avant toute action. Vérifie qu'elle est bien enregistrée. Ce fichier peut contenir des données personnelles : protège-le.</p>
      <button type="button" className="ob-reset-backup" onClick={sauvegarder}>Télécharger la sauvegarde JSON</button>
      {backupDone && <p className="ob-reset-note">Téléchargement déclenché. Vérifie le fichier avant de continuer.</p>}
    </section>
    <section className="ob-reset-card"><h2>3. Validation du périmètre</h2>
      <p>Seront supprimés : opérations 2026 (fiches, commandes, JDI/JDP, stocks, dépôts, factures, stands…), la <strong>BDD globale des établissements</strong> et les <strong>profils utilisateurs sauf l'administrateur connecté</strong>.</p>
      <p>Seront conservés : toutes les opérations OB 2025, les donateurs, mairies, bénévoles, fournisseurs et les paramètres globaux de permissions.</p>
      <p className="ob-reset-warning"><strong>Attention aux données partagées :</strong> supprimer les établissements est global. Des opérations OB 2025 conserveront leurs données, mais leurs liens vers la BDD Établissements peuvent devenir introuvables. {plan?.data?.protected2025Refs ? `${plan.data.protected2025Refs} référence(s)/mouvement(s) historiques ont été détectés.` : ''} La sauvegarde permettra de restaurer les établissements si nécessaire.</p>
      <p className="ob-reset-warning">Les fichiers et pièces jointes stockés dans IndexedDB, les données sur disque et les données serveur ne sont ni supprimés ni sauvegardés par cet outil.</p>
      <label className="ob-reset-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> J'ai téléchargé et vérifié ma sauvegarde.</label>
      <label className="ob-reset-check"><input type="checkbox" checked={sharedChecked} onChange={e=>setSharedChecked(e.target.checked)}/> Je confirme la suppression globale des établissements et des profils, en comprenant l'impact possible sur certains liens historiques 2025.</label>
      <label className="ob-reset-label">Saisis <strong>{PHRASE}</strong> pour confirmer
        <input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder={PHRASE} autoComplete="off"/>
      </label>
      <button type="button" className="ob-reset-danger" disabled={!plan?.data || !backupDone || !checked || !sharedChecked || phrase!==PHRASE || running} onClick={executer}>{running ? 'Réinitialisation…' : 'Supprimer les données sélectionnées'}</button>
      {error && <p role="alert" className="ob-reset-error">{error}</p>}
      <p className="ob-reset-note">Cette action est locale à ce navigateur. <Link to="/administration/campagnes">Retour aux campagnes</Link>.</p>
    </section>
  </main>
}

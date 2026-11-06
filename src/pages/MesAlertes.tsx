import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BellRing, CheckCircle2, Clock3, Plus, Search, Trash2, X } from 'lucide-react'
import { useUsers, getUserDisplayName } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import {
  ALERTS_EVENT, ALERT_MODULES, createUserAlert, deleteUserAlert, readUserAlerts,
  setUserAlertStatus, type AlertPriority, type AlertStatus, type UserAlert,
} from '../services/userAlerts'
import './MesAlertes.css'

const statusLabels: Record<AlertStatus, string> = {
  a_faire: 'À traiter', en_cours: 'En cours', terminee: 'Terminée',
}
const priorityLabels: Record<AlertPriority, string> = {
  basse: 'Basse', normale: 'Normale', haute: 'Haute',
}

export default function MesAlertes() {
  const { currentUser, users } = useUsers()
  const { selectedCampagne, activeCampagne, campagnes } = useObData()
  const [alerts, setAlerts] = useState<UserAlert[]>(readUserAlerts)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('attribuees')
  const [statusFilter, setStatusFilter] = useState('ouvertes')
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [module, setModule] = useState<string>(ALERT_MODULES[0])
  const [assigneeId, setAssigneeId] = useState(currentUser?.id ?? '')
  const [priority, setPriority] = useState<AlertPriority>('normale')
  const [dueDate, setDueDate] = useState('')
  const [campagneId, setCampagneId] = useState((selectedCampagne ?? activeCampagne)?.id ?? '')
  const isAdmin = currentUser?.role === 'administrateur'
  const currentId = currentUser?.id ?? ''

  useEffect(() => {
    const update = () => setAlerts(readUserAlerts())
    window.addEventListener(ALERTS_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(ALERTS_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  const visible = useMemo(() => alerts.filter(alert => {
    const allowed = scope === 'toutes' && isAdmin ? true :
      scope === 'creees' ? alert.creatorId === currentId : alert.assigneeId === currentId
    const matchesStatus = statusFilter === 'toutes' ||
      (statusFilter === 'ouvertes' ? alert.status !== 'terminee' : alert.status === statusFilter)
    const haystack = `${alert.title} ${alert.description} ${alert.module}`.toLocaleLowerCase('fr')
    return allowed && matchesStatus && haystack.includes(search.toLocaleLowerCase('fr'))
  }).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt.localeCompare(a.createdAt)),
  [alerts, scope, isAdmin, currentId, statusFilter, search])

  const assigned = alerts.filter(alert => alert.assigneeId === currentId)
  const open = assigned.filter(alert => alert.status !== 'terminee')
  const late = open.filter(alert => alert.dueDate && alert.dueDate < new Date().toLocaleDateString('en-CA'))
  const staff = users.filter(user => user.status === 'actif')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentId) return
    if (!isAdmin && campagneId && campagnes.find(c => c.id === campagneId)?.statut !== 'ACTIVE') {
      setError('Une campagne inactive ne peut pas recevoir de nouvelles alertes.'); return
    }
    try {
      createUserAlert({
        title, description, module, assigneeId: assigneeId || currentId,
        creatorId: currentId, priority, dueDate, campagneId,
      })
      setTitle(''); setDescription(''); setDueDate(''); setError(''); setShowForm(false)
      setScope('creees'); setStatusFilter('toutes')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.') }
  }

  function changeStatus(id: string, status: AlertStatus) {
    if (!currentId) return
    try { setUserAlertStatus(id, status, currentId, isAdmin); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Modification impossible.') }
  }

  function remove(id: string) {
    if (!currentId || !window.confirm('Supprimer cette alerte ?')) return
    try { deleteUserAlert(id, currentId, isAdmin); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression impossible.') }
  }

  return (
    <main className="ob-alerts-page">
      <header className="ob-alerts-header">
        <div><span className="ob-alerts-eyebrow">CENTRE DE NOTIFICATIONS</span><h1>Je crée mes alertes</h1>
          <p>Retrouver les alertes attribuées, organiser les priorités et suivre les actions à réaliser.</p></div>
        <button className="ob-alerts-primary" onClick={() => { setAssigneeId(currentId); setCampagneId((selectedCampagne ?? activeCampagne)?.id ?? ''); setShowForm(true) }} type="button"><Plus size={17}/> Créer une alerte</button>
      </header>

      <section className="ob-alerts-stats" aria-label="Synthèse de mes alertes">
        <div><BellRing size={21}/><span>Alertes attribuées</span><strong>{assigned.length}</strong></div>
        <div><Clock3 size={21}/><span>À traiter / en cours</span><strong>{open.length}</strong></div>
        <div><Clock3 size={21}/><span>En retard</span><strong>{late.length}</strong></div>
        <div><CheckCircle2 size={21}/><span>Terminées</span><strong>{assigned.length - open.length}</strong></div>
      </section>

      <section className="ob-alerts-board">
        <div className="ob-alerts-toolbar">
          <div className="ob-alerts-search"><Search size={16}/><input aria-label="Rechercher une alerte" placeholder="Rechercher une alerte…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select aria-label="Liste d'alertes" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="attribuees">Mes alertes attribuées</option><option value="creees">Alertes que j'ai créées</option>
            {isAdmin && <option value="toutes">Toutes les alertes</option>}
          </select>
          <select aria-label="Filtrer par statut" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ouvertes">Ouvertes</option><option value="toutes">Tous les statuts</option>
            <option value="a_faire">À traiter</option><option value="en_cours">En cours</option><option value="terminee">Terminées</option>
          </select>
        </div>
        {error && <p className="ob-alerts-error" role="alert">{error}</p>}
        <div className="ob-alerts-list">
          {visible.length === 0 ? <div className="ob-alerts-empty"><BellRing size={34}/><h2>Aucune alerte pour ces filtres</h2><p>Crée ta première alerte ou affiche les alertes terminées.</p></div> : visible.map(alert => (
            <article className="ob-alerts-item" key={alert.id}>
              <div className={`ob-alerts-priority ob-alerts-priority--${alert.priority}`}/>
              <div className="ob-alerts-item-main">
                <div className="ob-alerts-item-top"><strong>{alert.title}</strong><span>{priorityLabels[alert.priority]}</span></div>
                <p>{alert.description || 'Aucune description'}</p>
                <div className="ob-alerts-meta"><span>{alert.module}</span>{alert.campagneId && <span>{alert.campagneId}</span>}
                  <span>Attribuée à {getUserDisplayName(users.find(user => user.id === alert.assigneeId))}</span>
                  {alert.dueDate && <span>Échéance : {new Date(`${alert.dueDate}T12:00:00`).toLocaleDateString('fr-FR')}</span>}</div>
              </div>
              <div className="ob-alerts-item-actions">
                <select aria-label={`Statut de ${alert.title}`} value={alert.status} disabled={!isAdmin && alert.assigneeId !== currentId} onChange={e => changeStatus(alert.id, e.target.value as AlertStatus)}>
                  {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
                {(isAdmin || alert.creatorId === currentId) && <button type="button" aria-label={`Supprimer ${alert.title}`} title="Supprimer" onClick={() => remove(alert.id)}><Trash2 size={17}/></button>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {showForm && <div className="ob-alerts-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
        <section className="ob-alerts-modal" role="dialog" aria-modal="true" aria-labelledby="ob-alert-create-title">
          <header><div><span className="ob-alerts-eyebrow">NOUVELLE ACTION</span><h2 id="ob-alert-create-title">Créer une alerte</h2></div><button type="button" aria-label="Fermer" onClick={() => setShowForm(false)}><X size={20}/></button></header>
          <form onSubmit={submit}>
            <label>Titre de l'alerte *<input maxLength={130} required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Vérifier les fiches de caisse du secteur"/></label>
            <label>Description<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Consignes et éléments à contrôler"/></label>
            <div className="ob-alerts-fields">
              <label>Attribuer à<select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required>{staff.map(user => <option value={user.id} key={user.id}>{getUserDisplayName(user)}</option>)}</select></label>
              <label>Module<select value={module} onChange={e => setModule(e.target.value)}>{ALERT_MODULES.map(name => <option key={name}>{name}</option>)}</select></label>
              <label>Campagne<select value={campagneId} onChange={e => setCampagneId(e.target.value)}><option value="">Transversale / sans campagne</option>{campagnes.filter(c => isAdmin || c.statut === 'ACTIVE').map(c => <option value={c.id} key={c.id}>{c.nom || c.id} · {c.statut}</option>)}</select></label>
              <label>Priorité<select value={priority} onChange={e => setPriority(e.target.value as AlertPriority)}><option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option></select></label>
              <label>Échéance<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>
            </div>
            <p className="ob-alerts-local-note">Les alertes sont enregistrées dans ce navigateur. Elles ne sont pas encore partagées entre postes.</p>
            {error && <p role="alert" className="ob-alerts-error">{error}</p>}
            <footer><button type="button" onClick={() => setShowForm(false)}>Annuler</button><button className="ob-alerts-primary" type="submit">Enregistrer l'alerte</button></footer>
          </form>
        </section>
      </div>}
    </main>
  )
}

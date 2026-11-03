import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, ClipboardList, Plus, ShieldAlert, Users } from 'lucide-react'
import { getUserDisplayName, POLE_LABELS, useUsers, type UserPole } from '../contexts/UsersContext'
import './GestionMonEquipe.css'

type Priority = 'normale' | 'haute' | 'urgente'
type TaskStatus = 'a_faire' | 'en_cours' | 'terminee'
type TeamTask = {
  id: string; pole: UserPole; authorId: string; assigneeId: string
  title: string; description: string; priority: Priority; status: TaskStatus; createdAt: string
}
const STORAGE_KEY = 'ob-team-alerts-v1'
function loadTasks(): TeamTask[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((task): task is TeamTask => task && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.assigneeId === 'string' && (task.pole === 'comptabilite' || task.pole === 'communication') && ['normale','haute','urgente'].includes(task.priority) && ['a_faire','en_cours','terminee'].includes(task.status))
  } catch { return [] }
}
const statusLabels: Record<TaskStatus, string> = {a_faire:'À faire', en_cours:'En cours', terminee:'Terminée'}
const priorityLabels: Record<Priority, string> = {normale:'Normale', haute:'Haute', urgente:'Urgente'}

export default function GestionMonEquipe() {
  const { users, currentUser } = useUsers()
  const pole = currentUser?.pole
  const isManager = Boolean(currentUser && currentUser.status === 'actif' && currentUser.responsablePole && pole)
  const members = useMemo(() => users.filter(u => u.status === 'actif' && u.pole === pole), [users, pole])
  const [tasks, setTasks] = useState<TeamTask[]>(loadTasks)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState<Priority>('normale')
  const [filter, setFilter] = useState('tous')
  const [error, setError] = useState('')
  useEffect(() => { try {localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))} catch { /* browser storage unavailable */ } }, [tasks])
  const validAssigneeId = members.some(m => m.id === assigneeId) ? assigneeId : ''
  const teamTasks = tasks.filter(t => t.pole === pole)
  const displayed = teamTasks.filter(t => filter === 'tous' || t.assigneeId === filter)
  function createTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isManager || !currentUser || !pole) return
    if (!title.trim() || !members.some(u=>u.id === validAssigneeId)) {setError('Indique une alerte et un membre de ton équipe.'); return}
    setTasks(old => [{id:crypto.randomUUID(), pole, authorId:currentUser.id, assigneeId:validAssigneeId, title:title.trim(), description:description.trim(), priority, status:'a_faire', createdAt:new Date().toISOString()},...old])
    setTitle('');setDescription('');setPriority('normale');setError('')
  }
  function updateTask(id:string, change:Partial<Pick<TeamTask,'assigneeId'|'priority'|'status'>>) {
    if (!isManager) return
    if (change.assigneeId && !members.some(u=>u.id === change.assigneeId)) return
    setTasks(old => old.map(t => t.id === id && t.pole === pole ? {...t,...change}:t))
  }
  if (!isManager || !pole) return null
  return <section className="ob-team" aria-label="Gestion de mon équipe">
    <header className="ob-team-header"><div><h2><Users size={22}/> Gestion de mon équipe</h2><p>Équipe {POLE_LABELS[pole]} · Attribution des alertes et priorités</p></div><span className="ob-team-count">{members.length} membre{members.length>1?'s':''}</span></header>
    <div className="ob-team-members">
      {members.map(u=><div className="ob-team-member" key={u.id}><span className="ob-team-avatar">{(u.prenom || u.name).trim().slice(0,1).toUpperCase()}</span><span><strong>{getUserDisplayName(u)}</strong><small>{u.poste || (u.responsablePole ? 'Responsable de pôle' : 'Membre de l’équipe')}</small></span><span className="ob-team-member-count">{teamTasks.filter(t=>t.assigneeId===u.id&&t.status!=='terminee').length} en cours</span></div>)}
      {members.length===0 && <p>Aucun membre actif dans ce pôle.</p>}
    </div>
    <div className="ob-team-layout">
      <section className="ob-team-panel"><h3><Plus size={18}/> Créer une alerte pour l’équipe</h3>
        <form onSubmit={createTask} className="ob-team-form">
          <label>Objet de l’alerte<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. Vérifier les stands sans bénévole" maxLength={160} required/></label>
          <label>Attribuer à<select value={validAssigneeId} onChange={e=>setAssigneeId(e.target.value)} required><option value="">Choisir un membre</option>{members.map(u=><option key={u.id} value={u.id}>{getUserDisplayName(u)}</option>)}</select></label>
          <label>Priorité<select value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option value="normale">Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option></select></label>
          <label>Consignes (facultatif)<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Informations utiles pour la personne concernée"/></label>
          {error && <p className="ob-team-error" role="alert">{error}</p>}
          <button type="submit" className="ob-team-button"><Plus size={16}/> Attribuer l’alerte</button>
        </form>
      </section>
      <section className="ob-team-panel"><div className="ob-team-list-heading"><h3><ClipboardList size={18}/> Alertes de l’équipe</h3><select aria-label="Filtrer les alertes par personne" value={filter} onChange={e=>setFilter(e.target.value)}><option value="tous">Toute l’équipe</option>{members.map(u=><option value={u.id} key={u.id}>{getUserDisplayName(u)}</option>)}</select></div>
        {displayed.length===0 ? <div className="ob-team-empty"><CheckCircle2 size={24}/><p>Aucune alerte attribuée pour ce filtre.</p></div> : <div className="ob-team-tasks">{displayed.map(task=><article className="ob-team-task" key={task.id}>
          <div className="ob-team-task-top"><strong>{task.priority==='urgente'?<ShieldAlert size={16}/>:<AlertCircle size={16}/>} {task.title}</strong><span className={'ob-team-priority ob-team-priority-'+task.priority}>{priorityLabels[task.priority]}</span></div>
          {task.description&&<p>{task.description}</p>}
          <div className="ob-team-task-controls"><label>Attribuée à<select aria-label={'Responsable de '+task.title} value={task.assigneeId} onChange={e=>updateTask(task.id,{assigneeId:e.target.value})}>{members.map(u=><option value={u.id} key={u.id}>{getUserDisplayName(u)}</option>)}</select></label>
          <label>Priorité<select aria-label={'Priorité de '+task.title} value={task.priority} onChange={e=>updateTask(task.id,{priority:e.target.value as Priority})}><option value="normale">Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option></select></label>
          <label>Statut<select aria-label={'Statut de '+task.title} value={task.status} onChange={e=>updateTask(task.id,{status:e.target.value as TaskStatus})}>{(Object.keys(statusLabels) as TaskStatus[]).map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label></div>
        </article>)}</div>}
      </section>
    </div>
    <p className="ob-team-note">Première version : ces alertes sont créées manuellement et stockées dans ce navigateur. Les alertes automatiques des modules et la synchronisation sécurisée entre collègues nécessitent une base de données et des contrôles d’accès côté serveur.</p>
  </section>
}

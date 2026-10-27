import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUsers } from '../contexts/UsersContext'
import './AccesConnexion.css'
export default function AccesConnexion() {
  const { userId, setPassword, hasPassword } = useAuth()
  const { users } = useUsers()
  const [selected, setSelected] = useState('')
  const [password, setValue] = useState('')
  const [feedback, setFeedback] = useState('')
  if (!users.some(u => u.id === userId && u.role === 'administrateur')) return <Navigate to="/" replace />
  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback('')
    try { await setPassword(selected, password); setValue(''); setFeedback('Mot de passe local enregistré pour ce compte.') }
    catch (e) { setFeedback(e instanceof Error ? e.message : 'Erreur') }
  }
  return <main className="ob-access-page"><header><span>ADMINISTRATION</span><h1>Accès de connexion</h1><p>Configure un mot de passe local pour les utilisateurs actifs. La connexion Microsoft pourra être ajoutée ultérieurement.</p></header>
    <section><h2>Comptes utilisateurs</h2><form onSubmit={submit}><label>Utilisateur<select required value={selected} onChange={e=>{setSelected(e.target.value);setFeedback('')}}><option value="">Sélectionner un compte</option>{users.filter(u=>u.status==='actif' && u.email.trim()).map(u=><option key={u.id} value={u.id}>{u.name} — {u.email}{hasPassword(u.id)?' ✓':''}</option>)}</select></label><label>Nouveau mot de passe (12 caractères minimum)<input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e=>setValue(e.target.value)}/></label><button type="submit">Enregistrer le mot de passe</button></form>{feedback && <p role="status">{feedback}</p>}<small>Les utilisateurs se connectent avec leur adresse e-mail configurée dans Administration → Utilisateurs. Le compte système utilise « admin ».</small></section>
    <p className="ob-access-caution">Prototype local : mots de passe dérivés et stockés dans le navigateur. Ni cette page ni les contrôles React ne remplacent une authentification serveur sécurisée.</p>
  </main>
}

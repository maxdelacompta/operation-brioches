import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, LockKeyhole, UserRound } from 'lucide-react'
import { getUserDisplayName, POLE_LABELS, ROLE_LABELS, useUsers } from '../contexts/UsersContext'
import './GestionMonCompte.css'
import GestionMonEquipe from './GestionMonEquipe'

export default function GestionMonCompte() {
  const { currentUser } = useUsers()
  if (!currentUser) return <main className="ob-account"><p>Compte utilisateur indisponible.</p></main>
  return <GestionMonCompteForm key={currentUser.id} />
}

function GestionMonCompteForm() {
  const { currentUser, updateUser } = useUsers()
  const [prenom, setPrenom] = useState(() => currentUser?.prenom || '')
  const [nom, setNom] = useState(() => currentUser?.nom || '')
  const [email, setEmail] = useState(() => currentUser?.email || '')
  const [poste, setPoste] = useState(() => currentUser?.poste || '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)


  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentUser) return
    const p = prenom.trim(), n = nom.trim(), e = email.trim().toLowerCase()
    if (!p || !n) { setError('Le prénom et le nom sont obligatoires.'); return }
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Adresse e-mail invalide.'); return }
    updateUser(currentUser.id, {
      name: `${p} ${n}`, prenom: p, nom: n, email: e, poste: poste.trim(),
      role: currentUser.role, pole: currentUser.pole,
      responsablePole: currentUser.responsablePole,
      perimetre: currentUser.perimetre,
      etablissementId: currentUser.etablissementId,
      etablissementIds: currentUser.etablissementIds,
      tousEtablissements: currentUser.tousEtablissements,
    })
    setError('')
    setSaved(true)
  }

  if (!currentUser) return <main className="ob-account"><p>Compte utilisateur indisponible.</p></main>

  return <main className="ob-account">
    <Link className="ob-account-back" to="/"><ArrowLeft size={17}/> Retour à l’accueil</Link>
    <header className="ob-account-heading">
      <div className="ob-account-icon"><UserRound size={27}/></div>
      <div><h1>Gestion de mon compte</h1><p>Mes informations personnelles et mon rattachement dans Opération Brioche.</p></div>
    </header>
    <div className="ob-account-grid">
      <section className="ob-account-card">
        <h2>Mes informations</h2>
        <p className="ob-account-subtitle">Tu peux modifier tes coordonnées. Tes droits restent gérés par un administrateur.</p>
        <form onSubmit={save}>
          <div className="ob-account-name-row">
            <label>Prénom<input value={prenom} onChange={e => {setPrenom(e.target.value);setSaved(false)}} required autoComplete="given-name"/></label>
            <label>Nom<input value={nom} onChange={e => {setNom(e.target.value);setSaved(false)}} required autoComplete="family-name"/></label>
          </div>
          <label>Adresse e-mail<input type="email" value={email} onChange={e => {setEmail(e.target.value);setSaved(false)}} autoComplete="email" placeholder="prenom.nom@exemple.fr"/></label>
          <label>Poste / fonction<input value={poste} onChange={e => {setPoste(e.target.value);setSaved(false)}} placeholder="Fonction dans le service"/></label>
          {error && <p className="ob-account-error" role="alert">{error}</p>}
          {saved && <p className="ob-account-success" role="status"><CheckCircle2 size={16}/> Informations enregistrées</p>}
          <button className="ob-account-save" type="submit">Enregistrer mes modifications</button>
        </form>
      </section>
      <section className="ob-account-card">
        <h2><LockKeyhole size={19}/> Mon accès</h2>
        <dl>
          <dt>Utilisateur</dt><dd>{getUserDisplayName(currentUser)}</dd>
          <dt>Rôle</dt><dd>{ROLE_LABELS[currentUser.role]}</dd>
          <dt>Pôle</dt><dd>{currentUser.pole ? POLE_LABELS[currentUser.pole] : 'Non attribué'}</dd>
          <dt>Responsabilité</dt><dd>{currentUser.responsablePole ? 'Responsable de pôle' : 'Membre de l’équipe'}</dd>
          <dt>Statut</dt><dd>{currentUser.status === 'actif' ? 'Actif' : 'Inactif'}</dd>
        </dl>
        <p className="ob-account-note">Pour changer de rôle, de pôle ou d’autorisations, contacte un administrateur. Cette page ne modifie pas les droits d’accès.</p>
      </section>
    </div>
    {currentUser.responsablePole && currentUser.pole && <GestionMonEquipe />}
  </main>
}

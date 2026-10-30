import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './Connexion.css'

/** Page d'accueil de connexion — conserve l'authentification locale existante. */
export default function Connexion() {
  const { authenticated, needsSetup, signIn, initializeAdmin, changePassword } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [renew, setRenew] = useState(false)
  const [forced, setForced] = useState(false)
  const [renewalPassword, setRenewalPassword] = useState('')
  const [renewalConfirmation, setRenewalConfirmation] = useState('')

  if (authenticated) return <Navigate to="/" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (needsSetup) {
        if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.')
        await initializeAdmin(password)
        setIdentifier('admin')
        setPassword('')
        setConfirmation('')
      } else if (renew || forced) {
        if (confirmation !== renewalConfirmation) throw new Error('Les nouveaux mots de passe ne correspondent pas.')
        await changePassword(identifier, password, renewalPassword)
        setRenew(false); setForced(false); setPassword(''); setRenewalPassword(''); setRenewalConfirmation('')
        setError('Mot de passe renouvelé. Connectez-vous avec votre nouveau mot de passe.')
      } else {
        const message = await signIn(identifier, password)
        if (message === 'PASSWORD_CHANGE_REQUIRED') { setForced(true); setRenew(true); setError('Première connexion : choisissez votre propre mot de passe.') }
        else if (message) setError(message)
        else navigate('/', { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de se connecter.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="ob-login-page">
      <div className="ob-login-shell">
        <section className="ob-login-form-panel" aria-labelledby="ob-login-title">
          <div className="ob-login-logo">
            <img src="/ob/logo-operation-brioches-transparent.png" alt="Opération Brioches" />
            <span className="ob-login-logo-tag">Plateforme de gestion · AEIM</span>
          </div>

          <div className="ob-login-heading">
            <span className="ob-login-eyebrow">UNIS AUTOUR D'UNE MÊME OPÉRATION</span>
            <h1 id="ob-login-title">{needsSetup ? 'Bienvenue, administrateur.' : 'Heureux de vous retrouver.'}</h1>
            <p>{needsSetup
              ? 'Définissez votre mot de passe local pour commencer à utiliser cette installation.'
              : renew ? 'Renouvelez votre mot de passe à l’aide de votre mot de passe actuel.' : 'Connectez-vous pour retrouver vos équipes, vos commandes et toutes les actions de l’Opération Brioches.'}</p>
          </div>

          <form onSubmit={submit}>
            {!needsSetup && (
              <label>
                <span>Adresse professionnelle ou identifiant</span>
                <input autoComplete="username" required value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="prenom.nom@aeim.eu ou admin" />
              </label>
            )}
            <label>
              <span>{renew ? 'Mot de passe actuel / provisoire' : 'Mot de passe'}</span>
              <div className="ob-login-password">
                <input type={show ? 'text' : 'password'}
                  autoComplete={needsSetup ? 'new-password' : 'current-password'}
                  minLength={needsSetup ? 12 : undefined} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe" />
                <button type="button" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShow(!show)}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </label>
            {needsSetup && (
              <label>
                <span>Confirmer le mot de passe</span>
                <input type="password" autoComplete="new-password" required minLength={12}
                  value={confirmation} onChange={e => setConfirmation(e.target.value)} />
              </label>
            )}
            {renew && !needsSetup && <>
              <label><span>Nouveau mot de passe (12 caractères minimum)</span><input type="password" autoComplete="new-password" required minLength={12} value={renewalPassword} onChange={e=>setRenewalPassword(e.target.value)}/></label>
              <label><span>Confirmer le nouveau mot de passe</span><input type="password" autoComplete="new-password" required minLength={12} value={renewalConfirmation} onChange={e=>setRenewalConfirmation(e.target.value)}/></label>
            </>}
            {error && <div className="ob-login-error" role="alert">{error}</div>}
            <button className="ob-login-submit" disabled={busy} type="submit">
              {busy ? 'Un instant…' : needsSetup ? 'Activer mon accès' : renew ? 'Enregistrer mon nouveau mot de passe' : 'Accéder à mon espace'}
              {!busy && <ArrowRight size={19} />}
            </button>
          </form>
          {!needsSetup && <button type="button" className="ob-login-renew" onClick={()=>{if(!forced) setRenew(!renew);setError('')}}>{renew ? 'Retour à la connexion' : 'Renouveler mon mot de passe'}</button>}

          <div className="ob-login-divider"><span>ou</span></div>
          <div className="ob-login-future" aria-label="Connexion Microsoft 365, bientôt disponible">
            <span className="ob-login-ms-logo" aria-hidden="true"><i/><i/><i/><i/></span>
            <div>
              <strong>Connexion Microsoft 365</strong>
              <p>Bientôt disponible. La connexion par identifiant restera proposée en alternative.</p>
            </div>
            <ArrowRight size={17} aria-hidden="true" />
          </div>
          <p className="ob-login-warning"><LockKeyhole size={15} aria-hidden="true" />
            Version locale de développement : accès non sécurisé côté serveur.</p>
        </section>

        <aside className="ob-login-brand ob-login-brand--complete" aria-label="Illustration du vivre-ensemble et du partage">
          <img
            className="ob-login-hero-full"
            src="/ob/visuel-connexion-valide.webp"
            alt="Opération Brioches : des personnes de toutes les générations, dont des personnes en situation de handicap, partagent des brioches. Ensemble, partageons bien plus qu’une brioche."
          />
        </aside>
      </div>
    </main>
  )
}

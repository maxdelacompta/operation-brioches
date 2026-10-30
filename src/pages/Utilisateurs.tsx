import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TEST_MODE_AVAILABLE, TEST_MODE_EVENT, setTestModeEnabled, testModeEnabled } from '../lib/testMode'
import { DEMO_CURRENT_USER_ID } from '../contexts/UsersContext'
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  UserRound,
  Users,
  UserX,
  X,
} from 'lucide-react'

import {
  ROLE_LABELS,
  POLE_LABELS,
  useUsers,
  getUserDisplayName,
  type AppUser,
  type UserInput,
  type UserRole,
  type UserPole,
  type UserStatus,
} from '../contexts/UsersContext'

import { useEtablissements } from '../contexts/EtablissementsContext'

import './Utilisateurs.css'

/* =========================================================
   FORMULAIRE VIDE
   ========================================================= */

const emptyForm: UserInput = {
  name: '',
  nom: '',
  prenom: '',
  email: '',
  poste: '',
  pole: null,
  responsablePole: false,
  role: 'etablissement',
  perimetre: '',
  etablissementId: '',
}

const roleOptions = Object.keys(
  ROLE_LABELS,
) as UserRole[]

/* =========================================================
   UTILITAIRES
   ========================================================= */

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** Compatibilité avec les profils créés avant la séparation des champs. */
function identiteUtilisateur(user: AppUser) {
  if (user.nom || user.prenom) return { nom: user.nom || '', prenom: user.prenom || '' }
  const full = user.name.trim()
  if (!full) return { nom: '', prenom: '' }
  if (user.id === DEMO_CURRENT_USER_ID) {
    const parts = full.split(/\s+/)
    return { prenom: parts[0] || '', nom: parts.slice(1).join(' ') }
  }
  const parts = full.split(/\s+/)
  return { nom: parts[0] || '', prenom: parts.slice(1).join(' ') }
}

/* =========================================================
   PAGE
   ========================================================= */

function Utilisateurs() {
  const { etablissements } = useEtablissements()
  const { userId: authenticatedUserId } = useAuth()
  const [testEnabled, setTestEnabled] = useState(testModeEnabled)
  useEffect(() => {
    const refresh = () => setTestEnabled(testModeEnabled())
    window.addEventListener(TEST_MODE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener(TEST_MODE_EVENT, refresh); window.removeEventListener('storage', refresh) }
  }, [])
  const etablissementById = new Map(etablissements.map((e) => [e.id, e.nom]))
  const {
    users,
    currentUserId,
    addUser,
    updateUser,
    toggleUserStatus,
  } = useUsers()

  const [poleFilter, setPoleFilter] = useState<UserPole | 'tous' | 'sans'>('tous')
  const [search, setSearch] = useState('')

  const [roleFilter, setRoleFilter] = useState<
    UserRole | 'tous'
  >('tous')

  const [statusFilter, setStatusFilter] = useState<
    UserStatus | 'tous'
  >('tous')

  const [formOpen, setFormOpen] = useState(false)

  const [editingId, setEditingId] = useState<
    string | null
  >(null)

  const [form, setForm] = useState<UserInput>({
    ...emptyForm,
  })

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  /* =======================================================
     STATISTIQUES
     ======================================================= */

  const activeCount = users.filter(
    (user) => user.status === 'actif',
  ).length

  const inactiveCount = users.length - activeCount

  /* =======================================================
     RECHERCHE ET FILTRES
     ======================================================= */

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return users.filter((user) => {
      const text = [
        getUserDisplayName(user),
        user.email,
        user.poste,
        user.pole ? POLE_LABELS[user.pole] : '',
        user.perimetre,
        ROLE_LABELS[user.role],
      ]
        .join(' ')
        .toLowerCase()

      return (
        (!query || text.includes(query)) &&
        (poleFilter === 'tous' || (poleFilter === 'sans' ? !user.pole : user.pole === poleFilter)) &&
        (roleFilter === 'tous' ||
          user.role === roleFilter) &&
        (statusFilter === 'tous' ||
          user.status === statusFilter)
      )
    })
  }, [
    users,
    search,
    roleFilter,
    poleFilter,
    statusFilter,
  ])

  /* =======================================================
     OUVRIR LE FORMULAIRE
     ======================================================= */

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEdit(user: AppUser) {
    setEditingId(user.id)

    setForm({
      name: user.name,
      ...identiteUtilisateur(user),
      email: user.email,
      poste: user.poste,
      pole: user.pole || null,
      responsablePole: Boolean(user.responsablePole),
      role: user.role,
      perimetre: user.perimetre,
      etablissementId: user.etablissementId || '',
      etablissementIds: user.etablissementIds,
      tousEtablissements: user.tousEtablissements,
    })

    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setError('')
  }

  /* =======================================================
     ENREGISTREMENT
     ======================================================= */

  function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const input: UserInput = {
      nom: (form.nom || '').trim(),
      prenom: (form.prenom || '').trim(),
      name: `${(form.prenom || '').trim()} ${(form.nom || '').trim()}`.trim(),
      email: form.email.trim().toLowerCase(),
      poste: form.poste.trim(),
      pole: form.pole || null,
      responsablePole: Boolean(form.pole && form.responsablePole),
      role: form.role,
      perimetre: form.perimetre.trim(),
      etablissementId: form.etablissementId || '',
      etablissementIds: form.etablissementIds,
      tousEtablissements: form.tousEtablissements,
    }

    if (!input.nom || !input.prenom) {
      setError('Le nom et le prénom sont obligatoires.')
      return
    }

    // Le compte de démonstration existe déjà sans
    // adresse e-mail. Les nouveaux profils doivent
    // en posséder une.
    if (
      !input.email &&
      editingId !== currentUserId
    ) {
      setError("L'adresse e-mail est obligatoire.")
      return
    }

    const duplicate = users.some(
      (user) =>
        input.email !== '' &&
        user.email.toLowerCase() === input.email &&
        user.id !== editingId,
    )

    if (duplicate) {
      setError(
        'Cette adresse e-mail est déjà utilisée.',
      )
      return
    }

    if (input.pole && input.responsablePole) {
      const already = users.find(u => u.id !== editingId && u.status === 'actif' && u.pole === input.pole && u.responsablePole)
      if (already) {
        setError(`Le pôle ${POLE_LABELS[input.pole]} possède déjà un responsable : ${already.name}. Retire d'abord sa responsabilité.`)
        return
      }
    }

    if (editingId) {
      updateUser(editingId, input)
      setNotice('Utilisateur modifié.')
    } else {
      addUser(input)
      setNotice('Utilisateur ajouté au référentiel local.')
    }

    closeForm()
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="users-page">

      <section style={{ border: '1px solid #dce5ef', borderRadius: 14, padding: 17, marginBottom: 18, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong style={{ color: '#123b79' }}>Mode test des utilisateurs</strong>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
              {TEST_MODE_AVAILABLE ? 'Autorise le compte Administrateur à simuler les profils actifs pendant le développement.' : 'Désactivé définitivement dans cette version de production. Un nouveau build de développement est nécessaire pour le réactiver.'}
            </p>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 700, color: '#123b79' }}>
            <input type="checkbox" checked={TEST_MODE_AVAILABLE && testEnabled}
              disabled={!TEST_MODE_AVAILABLE || authenticatedUserId !== DEMO_CURRENT_USER_ID}
              onChange={event => {
                if (authenticatedUserId !== DEMO_CURRENT_USER_ID) return
                const enabled = event.target.checked
                setTestModeEnabled(enabled)
                setTestEnabled(enabled)
              }} />
            Mode test {TEST_MODE_AVAILABLE && testEnabled ? 'activé' : 'désactivé'}
          </label>
        </div>
      </section>

      {/* EN-TÊTE */}

      <header className="users-header">
        <div>
          <Link
            to="/administration"
            className="users-back"
          >
            <ArrowLeft size={16} />
            Administration
          </Link>

          <span className="users-eyebrow">
            GESTION DES ACCÈS
          </span>

          <h1>Utilisateurs</h1>

          <p>
            Gérez les profils utilisés dans
            Opération Brioches.
          </p>
        </div>

        <button
          type="button"
          className="users-primary-button"
          onClick={openCreate}
        >
          <Plus size={18} />
          Ajouter un utilisateur
        </button>
      </header>

      {/* INFORMATION IMPORTANTE */}

      <div className="users-demo-notice">
        Mode démonstration : les profils sont enregistrés
        dans ce navigateur. Aucun compte réel n'est créé.
      </div>

      {/* STATISTIQUES */}

      <div className="users-stats">

        <div className="users-stat">
          <Users size={23} />
          <div>
            <strong>{users.length}</strong>
            <span>Utilisateurs</span>
          </div>
        </div>

        <div className="users-stat green">
          <CheckCircle2 size={23} />
          <div>
            <strong>{activeCount}</strong>
            <span>Actifs</span>
          </div>
        </div>

        <div className="users-stat red">
          <UserX size={23} />
          <div>
            <strong>{inactiveCount}</strong>
            <span>Inactifs</span>
          </div>
        </div>

      </div>

      <section className="users-poles">
        {(Object.keys(POLE_LABELS) as UserPole[]).map(pole => {
          const membres = users.filter(u => u.pole === pole)
          const responsable = membres.find(u => u.responsablePole && u.status === 'actif')
          return <article className="users-pole-card" key={pole}>
            <div className="users-pole-head"><strong>Pôle {POLE_LABELS[pole]}</strong><span>{membres.length} membre(s)</span></div>
            <p>Responsable : <strong>{responsable ? getUserDisplayName(responsable) : 'À désigner'}</strong></p>
            <small>{membres.filter(u => u.status === 'actif').length} utilisateur(s) actif(s)</small>
          </article>
        })}
      </section>

      {/* MESSAGE DE CONFIRMATION */}

      {notice && (
        <p className="users-success" role="status">
          {notice}
        </p>
      )}

      {/* FORMULAIRE */}

      {formOpen && (
        <section className="users-form-card">

          <div className="users-form-heading">
            <h2>
              {editingId
                ? "Modifier l'utilisateur"
                : 'Ajouter un utilisateur'}
            </h2>

            <button
              type="button"
              className="users-icon-button"
              onClick={closeForm}
              aria-label="Fermer le formulaire"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={saveUser}>

            <div className="users-form-grid">

              <label>
                Nom *
                <input
                  value={form.nom || ''}
                  onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
                  required
                  autoComplete="family-name"
                  placeholder="CLAUDEL"
                />
              </label>

              <label>
                Prénom *
                <input
                  value={form.prenom || ''}
                  onChange={(event) => setForm((current) => ({ ...current, prenom: event.target.value }))}
                  required
                  autoComplete="given-name"
                  placeholder="Maxime"
                />
              </label>

              <label>
                Adresse e-mail
                {editingId !== currentUserId && ' *'}

                <input
                  type="email"
                  value={form.email}
                  required={
                    editingId !== currentUserId
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="prenom.nom@exemple.fr"
                />
              </label>

              <label>
                Poste
                <input
                  value={form.poste}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      poste: event.target.value,
                    }))
                  }
                  placeholder="Intitulé du poste"
                />
              </label>

              <label>
                Pôle
                <select value={form.pole || ''} onChange={event => setForm(current => ({...current, pole: (event.target.value || null) as UserPole | null, responsablePole: false}))}>
                  <option value="">Aucun pôle</option>
                  {(Object.keys(POLE_LABELS) as UserPole[]).map(pole => <option key={pole} value={pole}>{POLE_LABELS[pole]}</option>)}
                </select>
              </label>

              <label className="users-pole-check">
                <input type="checkbox" checked={Boolean(form.responsablePole)} disabled={!form.pole} onChange={event => setForm(current => ({...current, responsablePole:event.target.checked}))} />
                Responsable de ce pôle
                <small>Organisation de l'équipe uniquement : aucun droit administrateur supplémentaire.</small>
              </label>

              <label>
                Rôle
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as UserRole,
                      pole: event.target.value === 'stagiaire_communication'
                        ? 'communication'
                        : event.target.value === 'stagiaire_comptabilite'
                          ? 'comptabilite'
                          : current.pole,
                      responsablePole: event.target.value.startsWith('stagiaire_')
                        ? false
                        : current.responsablePole,
                    }))
                  }
                >
                  {roleOptions.map((role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="users-form-wide">
                Établissement affecté
                <select
                  value={form.etablissementId || ''}
                  onChange={(event) => setForm((current) => ({ ...current, etablissementId: event.target.value }))}
                >
                  <option value="">Aucun établissement affecté</option>
                  {etablissements.map((etablissement) => (
                    <option key={etablissement.id} value={etablissement.id}>
                      {etablissement.nom}
                    </option>
                  ))}
                </select>
              </label>

              <label className="users-form-wide">
                Établissement / périmètre
                <input
                  value={form.perimetre}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      perimetre: event.target.value,
                    }))
                  }
                  placeholder="Raccordement aux structures à venir"
                />
              </label>

            </div>

            {error && (
              <p className="users-error" role="alert">
                {error}
              </p>
            )}

            <div className="users-form-actions">
              <button
                type="button"
                className="users-secondary-button"
                onClick={closeForm}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="users-primary-button"
              >
                {editingId
                  ? 'Enregistrer'
                  : "Ajouter l'utilisateur"}
              </button>
            </div>

          </form>
        </section>
      )}

      {/* TABLEAU */}

      <section className="users-table-card">

        <div className="users-toolbar">

          <div className="users-search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Rechercher un utilisateur..."
              aria-label="Rechercher un utilisateur"
            />
          </div>

          <select value={poleFilter} aria-label="Filtrer par pôle" onChange={event => setPoleFilter(event.target.value as UserPole | 'tous' | 'sans')}>
            <option value="tous">Tous les pôles</option>
            {(Object.keys(POLE_LABELS) as UserPole[]).map(pole => <option key={pole} value={pole}>{POLE_LABELS[pole]}</option>)}
            <option value="sans">Sans pôle</option>
          </select>

          <select
            value={roleFilter}
            aria-label="Filtrer par rôle"
            onChange={(event) =>
              setRoleFilter(
                event.target.value as UserRole | 'tous',
              )
            }
          >
            <option value="tous">
              Tous les rôles
            </option>

            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            aria-label="Filtrer par statut"
            onChange={(event) =>
              setStatusFilter(
                event.target.value as UserStatus | 'tous',
              )
            }
          >
            <option value="tous">
              Tous les statuts
            </option>

            <option value="actif">
              Actifs
            </option>

            <option value="inactif">
              Inactifs
            </option>
          </select>

        </div>

        <div className="users-table-scroll">
          <table className="users-table">

            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Poste</th>
                <th>Pôle / responsabilité</th>
                <th>Rôle</th>
                <th>Établissement</th>
                <th>Périmètre</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredUsers.map((user) => (
                <tr key={user.id}>

                  <td>
                    <div className="users-person">

                      <div className="users-avatar">
                        {initials(getUserDisplayName(user)) || (
                          <UserRound size={18} />
                        )}
                      </div>

                      <div>
                        <strong>{getUserDisplayName(user)}</strong>

                        <span>
                          {user.email ||
                            'Profil de démonstration'}
                        </span>
                      </div>

                    </div>
                  </td>

                  <td>
                    {user.poste || '—'}
                  </td>

                  <td>
                    <span className="users-pole-label">{user.pole ? POLE_LABELS[user.pole] : '—'}</span>
                    {user.responsablePole && user.pole && <span className="users-pole-leader">Responsable</span>}
                  </td>

                  <td>
                    <span className="users-role">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>

                  <td>{user.etablissementId ? (etablissementById.get(user.etablissementId) || 'Établissement supprimé') : '—'}</td>

                  <td>
                    {user.perimetre || '—'}
                  </td>

                  <td>
                    <span
                      className={`users-status ${
                        user.status
                      }`}
                    >
                      {user.status === 'actif'
                        ? 'Actif'
                        : 'Inactif'}
                    </span>
                  </td>

                  <td>
                    <div className="users-row-actions">

                      <button
                        type="button"
                        title={`Modifier ${getUserDisplayName(user)}`}
                        aria-label={`Modifier ${getUserDisplayName(user)}`}
                        onClick={() => openEdit(user)}
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        type="button"
                        disabled={
                          user.id === currentUserId
                        }
                        title={
                          user.id === currentUserId
                            ? 'Profil de démonstration protégé'
                            : user.status === 'actif'
                              ? 'Désactiver'
                              : 'Activer'
                        }
                        aria-label={`${
                          user.status === 'actif'
                            ? 'Désactiver'
                            : 'Activer'
                        } ${getUserDisplayName(user)}`}
                        onClick={() => {
                          toggleUserStatus(user.id)

                          setNotice(
                            user.status === 'actif'
                              ? `${getUserDisplayName(user)} désactivé.`
                              : `${getUserDisplayName(user)} activé.`,
                          )
                        }}
                      >
                        {user.status === 'actif' ? (
                          <UserX size={17} />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}
                      </button>

                    </div>
                  </td>

                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="users-empty"
                  >
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

      </section>

    </div>
  )
}

export default Utilisateurs
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
  useUsers,
  type AppUser,
  type UserInput,
  type UserRole,
  type UserStatus,
} from '../contexts/UsersContext'

import './Utilisateurs.css'

/* =========================================================
   FORMULAIRE VIDE
   ========================================================= */

const emptyForm: UserInput = {
  name: '',
  email: '',
  poste: '',
  role: 'etablissement',
  perimetre: '',
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

/* =========================================================
   PAGE
   ========================================================= */

function Utilisateurs() {
  const {
    users,
    currentUserId,
    addUser,
    updateUser,
    toggleUserStatus,
  } = useUsers()

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
        user.name,
        user.email,
        user.poste,
        user.perimetre,
        ROLE_LABELS[user.role],
      ]
        .join(' ')
        .toLowerCase()

      return (
        (!query || text.includes(query)) &&
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
      email: user.email,
      poste: user.poste,
      role: user.role,
      perimetre: user.perimetre,
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
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      poste: form.poste.trim(),
      role: form.role,
      perimetre: form.perimetre.trim(),
    }

    if (!input.name) {
      setError('Le nom est obligatoire.')
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
                Nom et prénom *
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  placeholder="Nom Prénom"
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
                Rôle
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as UserRole,
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
                <th>Rôle</th>
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
                        {initials(user.name) || (
                          <UserRound size={18} />
                        )}
                      </div>

                      <div>
                        <strong>{user.name}</strong>

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
                    <span className="users-role">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>

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
                        title={`Modifier ${user.name}`}
                        aria-label={`Modifier ${user.name}`}
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
                        } ${user.name}`}
                        onClick={() => {
                          toggleUserStatus(user.id)

                          setNotice(
                            user.status === 'actif'
                              ? `${user.name} désactivé.`
                              : `${user.name} activé.`,
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
                    colSpan={6}
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
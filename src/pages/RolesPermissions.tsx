import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Crown,
  Database,
  Euro,
  FileSpreadsheet,
  Home,
  KeyRound,
  Megaphone,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

/* =========================================================
   UTILISATEURS
   ========================================================= */

import {
  ROLE_LABELS,
  useUsers,
  type UserRole,
} from '../contexts/UsersContext'

/* =========================================================
   PERMISSIONS
   ========================================================= */

import {
  PERMISSION_MODULES,
  usePermissions,
  type PermissionAction,
  type PermissionModule,
} from '../contexts/PermissionsContext'

/* =========================================================
   JOURNAL D'ACTIVITÉ
   ========================================================= */

import {
  recordActivity,
} from '../services/activityLog'

/* =========================================================
   CSS EXISTANT
   ========================================================= */

import './RolesPermissions.css'

/* =========================================================
   TYPES
   ========================================================= */

type RoleMeta = {
  description: string
  perimetre: string
}

type RoleMetaMap = Record<
  UserRole,
  RoleMeta
>

/* =========================================================
   RÔLES EXISTANTS

   On utilise les six rôles définis dans UsersContext.
   Aucun rôle fictif n'est ajouté.
   ========================================================= */

const roles = Object.keys(
  ROLE_LABELS,
) as UserRole[]

/* =========================================================
   ICÔNES DES RÔLES
   ========================================================= */

const roleIcons: Record<
  UserRole,
  LucideIcon
> = {
  administrateur: Crown,
  communication: Megaphone,
  comptabilite: Euro,
  etablissement: Building2,
  terrain: Users,
  direction: ShieldCheck,
}

/* =========================================================
   ICÔNES DES MODULES
   ========================================================= */

const moduleIcons: Record<
  PermissionModule,
  LucideIcon
> = {
  accueil: Home,
  dashboard: BarChart3,
  commandes: ShoppingCart,
  fiches_caisse: FileSpreadsheet,
  communication: Megaphone,
  comptabilite: Euro,
  etablissement: Building2,
  bdd: Database,
  donateurs: Users,
  administration: Settings,
  utilisateurs: Users,
  roles: KeyRound,
}

/* =========================================================
   COLONNES DE LA MATRICE
   ========================================================= */

const permissionColumns: {
  key: PermissionAction
  label: string
}[] = [
  {
    key: 'consulter',
    label: 'Lecture',
  },
  {
    key: 'creer',
    label: 'Création',
  },
  {
    key: 'modifier',
    label: 'Modification',
  },
  {
    key: 'supprimer',
    label: 'Suppression',
  },
  {
    key: 'exporter',
    label: 'Export',
  },
  {
    key: 'valider',
    label: 'Validation',
  },
]

/* =========================================================
   DESCRIPTIONS INITIALES DES RÔLES

   Ces informations sont descriptives.
   Elles ne constituent pas un contrôle d'accès.
   ========================================================= */

const defaultMetadata: RoleMetaMap = {
  administrateur: {
    description:
      "Profil de référence disposant de toutes les permissions de l'application.",
    perimetre: 'Global',
  },

  communication: {
    description:
      'Profil destiné aux activités de communication.',
    perimetre: 'À définir',
  },

  comptabilite: {
    description:
      'Profil destiné aux activités comptables et financières.',
    perimetre: 'À définir',
  },

  etablissement: {
    description:
      'Profil destiné aux utilisateurs rattachés à un établissement.',
    perimetre: 'À définir',
  },

  terrain: {
    description:
      'Profil destiné à la coordination des activités de terrain.',
    perimetre: 'À définir',
  },

  direction: {
    description:
      'Profil destiné aux activités de direction et de pilotage.',
    perimetre: 'À définir',
  },
}

/* =========================================================
   STOCKAGE DES FICHES DE RÔLES

   On conserve la clé utilisée précédemment.
   ========================================================= */

const METADATA_STORAGE_KEY =
  'ob-roles-metadata-v1'

/* =========================================================
   CHARGEMENT DES FICHES DE RÔLES
   ========================================================= */

function loadMetadata(): RoleMetaMap {
  const defaults: RoleMetaMap = {
    ...defaultMetadata,
  }

  try {
    const stored = localStorage.getItem(
      METADATA_STORAGE_KEY,
    )

    if (!stored) {
      return defaults
    }

    const parsed: unknown = JSON.parse(
      stored,
    )

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return defaults
    }

    const saved = parsed as Record<
      string,
      unknown
    >

    for (const role of roles) {
      /*
       * La fiche administrateur est fixe.
       */

      if (role === 'administrateur') {
        continue
      }

      const data = saved[role]

      if (
        typeof data !== 'object' ||
        data === null ||
        Array.isArray(data)
      ) {
        continue
      }

      const item = data as Record<
        string,
        unknown
      >

      defaults[role] = {
        description:
          typeof item.description === 'string'
            ? item.description
            : defaultMetadata[role].description,

        perimetre:
          typeof item.perimetre === 'string'
            ? item.perimetre
            : defaultMetadata[role].perimetre,
      }
    }

    return defaults
  } catch {
    return defaults
  }
}

/* =========================================================
   INITIALES DES UTILISATEURS
   ========================================================= */

function getInitials(
  name: string,
): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0).toUpperCase(),
    )
    .join('')

  return initials || '?'
}

/* =========================================================
   PAGE
   ========================================================= */

function RolesPermissions() {
  /* =======================================================
     CONTEXTE UTILISATEURS
     ======================================================= */

  const {
    users,
    currentUser,
  } = useUsers()

  /* =======================================================
     CONTEXTE PERMISSIONS
     ======================================================= */

  const {
    permissions,
    togglePermission,
    resetRole,
  } = usePermissions()

  /* =======================================================
     ÉTATS
     ======================================================= */

  const [
    selectedRole,
    setSelectedRole,
  ] = useState<UserRole>(
    'communication',
  )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    metadata,
    setMetadata,
  ] = useState<RoleMetaMap>(
    loadMetadata,
  )

  const [
    editing,
    setEditing,
  ] = useState(false)

  const [
    draftDescription,
    setDraftDescription,
  ] = useState('')

  const [
    draftPerimetre,
    setDraftPerimetre,
  ] = useState('')

  const [
    notice,
    setNotice,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  /* =======================================================
     IDENTITÉ ET AUTORISATION D'INTERFACE

     Ce contrôle reste local.
     Un backend devra réellement faire respecter
     les permissions avant le déploiement.
     ======================================================= */

  const canManage =
    currentUser?.role === 'administrateur'

  const actorId =
    currentUser?.id ?? null

  const actorName =
    currentUser?.name ??
    'Utilisateur non identifié'

  /* =======================================================
     RÔLE SÉLECTIONNÉ
     ======================================================= */

  const selectedMeta =
    metadata[selectedRole]

  const SelectedIcon =
    roleIcons[selectedRole]

  const isSystemRole =
    selectedRole === 'administrateur'

  const canEditSelectedRole =
    canManage && !isSystemRole

  /* =======================================================
     UTILISATEURS ASSOCIÉS AU RÔLE
     ======================================================= */

  const roleUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.role === selectedRole,
      ),
    [
      users,
      selectedRole,
    ],
  )

  const activeRoleUsers =
    roleUsers.filter(
      (user) =>
        user.status === 'actif',
    ).length

  /* =======================================================
     LISTE DES RÔLES FILTRÉS
     ======================================================= */

  const filteredRoles = roles.filter(
    (role) => {
      const searchableText = [
        ROLE_LABELS[role],
        metadata[role].description,
        metadata[role].perimetre,
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(
        search.trim().toLowerCase(),
      )
    },
  )

  /* =======================================================
     NOMBRE DE PERMISSIONS DU RÔLE SÉLECTIONNÉ
     ======================================================= */

  const selectedPermissionsCount =
    PERMISSION_MODULES.reduce(
      (total, module) =>
        total +
        permissions[selectedRole][
          module.key
        ].length,
      0,
    )

  /* =======================================================
     NOMBRE TOTAL DE PERMISSIONS
     ======================================================= */

  const totalPermissions = roles.reduce(
    (total, role) =>
      total +
      PERMISSION_MODULES.reduce(
        (moduleTotal, module) =>
          moduleTotal +
          permissions[role][
            module.key
          ].length,
        0,
      ),
    0,
  )

  /* =======================================================
     UTILISATEURS ACTIFS
     ======================================================= */

  const activeUsersCount =
    users.filter(
      (user) =>
        user.status === 'actif',
    ).length

  /* =======================================================
     JOURNALISATION

     On n'enregistre pas le contenu des descriptions.
     On conserve uniquement l'action et le rôle concerné.
     ======================================================= */

  function logRoleActivity(
    action:
      | 'modification'
      | 'reinitialisation',

    message: string,
  ) {
    return recordActivity({
      actorId,
      actorName,

      category: 'roles',
      action,

      target:
        ROLE_LABELS[selectedRole],

      message,
    })
  }

  /* =======================================================
     SÉLECTION D'UN RÔLE
     ======================================================= */

  function selectRole(
    role: UserRole,
  ) {
    setSelectedRole(role)

    setEditing(false)

    setNotice('')
    setError('')
  }

  /* =======================================================
     OUVERTURE DU FORMULAIRE D'ÉDITION
     ======================================================= */

  function startEditing() {
    if (!canEditSelectedRole) {
      return
    }

    setDraftDescription(
      selectedMeta.description,
    )

    setDraftPerimetre(
      selectedMeta.perimetre,
    )

    setEditing(true)

    setNotice('')
    setError('')
  }

  /* =======================================================
     ENREGISTREMENT DE LA FICHE DU RÔLE
     ======================================================= */

  function saveMetadata(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!canEditSelectedRole) {
      return
    }

    const description =
      draftDescription.trim()

    const perimetre =
      draftPerimetre.trim() ||
      'À définir'

    if (!description) {
      setError(
        'La description du rôle est obligatoire.',
      )

      return
    }

    /* Aucune modification réelle */

    if (
      description ===
        selectedMeta.description &&
      perimetre ===
        selectedMeta.perimetre
    ) {
      setEditing(false)

      setError('')

      setNotice(
        'Aucune modification à enregistrer.',
      )

      return
    }

    const updatedMetadata: RoleMetaMap = {
      ...metadata,

      [selectedRole]: {
        description,
        perimetre,
      },
    }

    /*
     * Sauvegarde avant confirmation.
     * En cas d'erreur, la fiche n'est pas modifiée.
     */

    try {
      localStorage.setItem(
        METADATA_STORAGE_KEY,
        JSON.stringify(
          updatedMetadata,
        ),
      )
    } catch {
      setError(
        "Impossible d'enregistrer la fiche du rôle dans ce navigateur.",
      )

      return
    }

    setMetadata(
      updatedMetadata,
    )

    setEditing(false)

    setError('')

    setNotice(
      'Fiche du rôle enregistrée.',
    )

    /* JOURNAL */

    logRoleActivity(
      'modification',
      'Description ou périmètre descriptif du rôle modifié.',
    )
  }

  /* =======================================================
     MODIFICATION D'UNE PERMISSION
     ======================================================= */

  function handlePermissionToggle(
    moduleKey: PermissionModule,
    action: PermissionAction,
    moduleLabel: string,
    actionLabel: string,
  ) {
    if (!canEditSelectedRole) {
      return
    }

    const moduleDefinition =
      PERMISSION_MODULES.find(
        (module) =>
          module.key === moduleKey,
      )

    if (
      !moduleDefinition ||
      !moduleDefinition.actions.some(
        (availableAction) =>
          availableAction === action,
      )
    ) {
      return
    }

    const existing =
      permissions[selectedRole][moduleKey]

    const wasGranted =
      existing.includes(action)

    /*
     * PermissionsContext applique les règles :
     *
     * - accorder une action accorde aussi "consulter" ;
     * - retirer "consulter" retire les autres actions ;
     * - l'administrateur reste verrouillé.
     */

    togglePermission(
      selectedRole,
      moduleKey,
      action,
    )

    setError('')

    setNotice(
      'Permissions mises à jour.',
    )

    /* JOURNAL */

    const message =
      action === 'consulter' &&
      wasGranted &&
      existing.length > 1
        ? `Accès au module « ${moduleLabel} » retiré, ainsi que ses autres permissions.`
        : `Permission « ${actionLabel} » ${
            wasGranted
              ? 'retirée'
              : 'accordée'
          } pour le module « ${moduleLabel} ». `

    logRoleActivity(
      'modification',
      message.trim(),
    )
  }

  /* =======================================================
     RÉINITIALISATION DES PERMISSIONS
     ======================================================= */

  function handleReset() {
    if (
      !canEditSelectedRole ||
      selectedPermissionsCount === 0
    ) {
      return
    }

    const confirmed = window.confirm(
      `Retirer toutes les permissions du rôle « ${ROLE_LABELS[selectedRole]} » ? Les utilisateurs conserveront leur rôle, mais les permissions configurées pour celui-ci seront retirées.`,
    )

    if (!confirmed) {
      return
    }

    resetRole(
      selectedRole,
    )

    setError('')

    setNotice(
      `Permissions du rôle « ${ROLE_LABELS[selectedRole]} » réinitialisées.`,
    )

    /* JOURNAL */

    logRoleActivity(
      'reinitialisation',
      'Toutes les permissions configurées pour ce rôle ont été réinitialisées.',
    )
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="rp-page">

      {/* ===================================================
          EN-TÊTE
      =================================================== */}

      <header className="rp-header">

        <div>

          <Link
            to="/administration"
            className="rp-back"
          >
            <ArrowLeft size={16} />

            Administration
          </Link>

          <span className="rp-eyebrow">
            GESTION DES ACCÈS
          </span>

          <h1>
            Rôles et permissions
          </h1>

          <p>
            Gérez les rôles existants
            et configurez leurs autorisations.
          </p>

        </div>

        <button
          type="button"
          className="rp-primary-button"
          disabled
          title="La création de rôles personnalisés sera disponible lorsque le référentiel des rôles sera dynamique."
        >
          <Plus size={18} />

          Créer un rôle
        </button>

      </header>

      {/* ===================================================
          INFORMATION PROTOTYPE
      =================================================== */}

      <div className="rp-demo-notice">

        <ShieldCheck size={18} />

        <span>
          Configuration locale de démonstration :
          les permissions sont enregistrées
          dans ce navigateur. Leur application
          aux routes et aux données côté serveur
          reste à développer.
        </span>

      </div>

      {/* ===================================================
          STATISTIQUES
      =================================================== */}

      <div className="rp-stats">

        {/* RÔLES */}

        <div className="rp-stat">

          <Users size={24} />

          <div>

            <strong>
              {roles.length}
            </strong>

            <span>
              Rôles existants
            </span>

          </div>

        </div>

        {/* MODULES */}

        <div className="rp-stat">

          <Database size={24} />

          <div>

            <strong>
              {PERMISSION_MODULES.length}
            </strong>

            <span>
              Modules configurés
            </span>

          </div>

        </div>

        {/* PERMISSIONS */}

        <div className="rp-stat green">

          <ShieldCheck size={24} />

          <div>

            <strong>
              {totalPermissions}
            </strong>

            <span>
              Permissions accordées
            </span>

          </div>

        </div>

        {/* UTILISATEURS */}

        <div className="rp-stat purple">

          <CheckCircle2 size={24} />

          <div>

            <strong>
              {activeUsersCount}
            </strong>

            <span>
              Utilisateurs actifs
            </span>

          </div>

        </div>

      </div>

      {/* ===================================================
          CONFIRMATION
      =================================================== */}

      {notice && (

        <div
          className="rp-success"
          role="status"
        >

          <CheckCircle2 size={17} />

          {notice}

        </div>

      )}

      {/* ===================================================
          ERREUR
      =================================================== */}

      {error && (

        <div
          className="rp-demo-notice"
          role="alert"
        >

          <X size={17} />

          {error}

        </div>

      )}

      {/* ===================================================
          LAYOUT DEUX COLONNES
      =================================================== */}

      <div className="rp-layout">

        {/* ================================================
            COLONNE GAUCHE
        ================================================ */}

        <div className="rp-left-column">

          {/* ==============================================
              LISTE DES RÔLES
          ============================================== */}

          <section className="rp-card">

            <div className="rp-card-heading">

              <h2>
                Liste des rôles
              </h2>

            </div>

            {/* RECHERCHE */}

            <div className="rp-search">

              <Search size={18} />

              <input
                type="search"
                value={search}
                placeholder="Rechercher un rôle..."
                aria-label="Rechercher un rôle"
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
              />

            </div>

            {/* LISTE */}

            <div className="rp-role-list">

              {filteredRoles.length === 0 && (

                <p className="rp-empty">
                  Aucun rôle trouvé.
                </p>

              )}

              {filteredRoles.map(
                (role) => {
                  const RoleIcon =
                    roleIcons[role]

                  const count =
                    users.filter(
                      (user) =>
                        user.role === role,
                    ).length

                  return (

                    <button
                      key={role}
                      type="button"
                      className={`rp-role-item ${
                        selectedRole === role
                          ? 'active'
                          : ''
                      }`}
                      aria-pressed={
                        selectedRole === role
                      }
                      onClick={() =>
                        selectRole(role)
                      }
                    >

                      <div className="rp-role-icon">

                        <RoleIcon size={20} />

                      </div>

                      <div className="rp-role-text">

                        <strong>
                          {ROLE_LABELS[role]}
                        </strong>

                        <span>
                          {
                            metadata[role]
                              .description
                          }
                        </span>

                      </div>

                      <span className="rp-role-count">

                        {count}

                      </span>

                    </button>

                  )
                },
              )}

            </div>

          </section>

          {/* ==============================================
              UTILISATEURS ASSOCIÉS
          ============================================== */}

          <section className="rp-card">

            <div className="rp-card-heading rp-users-heading">

              <h2>

                Utilisateurs associés
                {' '}
                ({roleUsers.length})

              </h2>

              <Link
                to="/administration/utilisateurs"
                title="Gérer les utilisateurs"
                aria-label="Gérer les utilisateurs"
              >

                <Pencil size={16} />

              </Link>

            </div>

            {roleUsers.length === 0 ? (

              <p className="rp-empty">
                Aucun utilisateur associé à ce rôle.
              </p>

            ) : (

              <div className="rp-users-list">

                {roleUsers.map(
                  (user) => (

                    <div
                      key={user.id}
                      className="rp-user"
                    >

                      {/* AVATAR */}

                      <div className="rp-user-avatar">

                        {getInitials(user.name)}

                      </div>

                      {/* IDENTITÉ */}

                      <div className="rp-user-details">

                        <strong>
                          {user.name}
                        </strong>

                        <span>
                          {user.email ||
                            'Aucune adresse e-mail'}
                        </span>

                        {user.poste && (

                          <small>
                            {user.poste}
                          </small>

                        )}

                      </div>

                      {/* STATUT */}

                      <span
                        className={`rp-user-status ${user.status}`}
                      >

                        {user.status === 'actif'
                          ? 'Actif'
                          : 'Inactif'}

                      </span>

                    </div>

                  ),
                )}

              </div>

            )}

          </section>

        </div>

        {/* ================================================
            COLONNE DROITE
        ================================================ */}

        <div className="rp-right-column">

          {/* ==============================================
              FICHE DU RÔLE
          ============================================== */}

          <section className="rp-card">

            <div className="rp-card-heading rp-detail-heading">

              <h2>
                Détails du rôle
              </h2>

              {canEditSelectedRole &&
                !editing && (

                  <button
                    type="button"
                    className="rp-outline-button"
                    onClick={startEditing}
                  >

                    <Pencil size={16} />

                    Modifier la fiche

                  </button>

                )}

            </div>

            {/* IDENTITÉ DU RÔLE */}

            <div className="rp-role-detail">

              <div className="rp-detail-icon">

                <SelectedIcon size={27} />

              </div>

              <div className="rp-detail-title">

                <h3>
                  {
                    ROLE_LABELS[
                      selectedRole
                    ]
                  }
                </h3>

                <p>
                  {
                    selectedMeta.description
                  }
                </p>

              </div>

            </div>

            {/* ============================================
                FORMULAIRE D'ÉDITION
            ============================================ */}

            {editing &&
              canEditSelectedRole && (

                <form
                  className="rp-edit-form"
                  onSubmit={saveMetadata}
                >

                  <label>

                    Description du rôle

                    <textarea
                      required
                      maxLength={500}
                      rows={3}
                      value={
                        draftDescription
                      }
                      onChange={(event) =>
                        setDraftDescription(
                          event.target.value,
                        )
                      }
                    />

                  </label>

                  <label>

                    Périmètre descriptif

                    <input
                      type="text"
                      maxLength={150}
                      value={
                        draftPerimetre
                      }
                      onChange={(event) =>
                        setDraftPerimetre(
                          event.target.value,
                        )
                      }
                    />

                  </label>

                  <p>
                    Le périmètre est descriptif :
                    il ne limite pas encore
                    les données accessibles.
                  </p>

                  <div className="rp-edit-actions">

                    <button
                      type="button"
                      className="rp-outline-button"
                      onClick={() => {
                        setEditing(false)
                        setError('')
                      }}
                    >

                      <X size={16} />

                      Annuler

                    </button>

                    <button
                      type="submit"
                      className="rp-primary-button"
                    >

                      <Check size={16} />

                      Enregistrer

                    </button>

                  </div>

                </form>

              )}

            {/* ============================================
                INFORMATIONS
            ============================================ */}

            <div className="rp-detail-grid">

              {/* DESCRIPTION */}

              <div className="rp-detail-info">

                <div className="rp-detail-label">

                  <ShieldCheck size={17} />

                  Description

                </div>

                <p>

                  {selectedMeta.description}

                </p>

              </div>

              {/* PÉRIMÈTRE */}

              <div className="rp-detail-info">

                <div className="rp-detail-label">

                  <Building2 size={17} />

                  Périmètre descriptif

                </div>

                <p>

                  {selectedMeta.perimetre}

                </p>

              </div>

              {/* CONFIGURATION */}

              <div className="rp-detail-info">

                <div className="rp-detail-label">

                  <CheckCircle2 size={17} />

                  Configuration

                </div>

                <span
                  className={`rp-role-badge ${
                    isSystemRole
                      ? 'system'
                      : 'editable'
                  }`}
                >

                  {isSystemRole
                    ? 'Rôle système'
                    : 'Configurable'}

                </span>

                {isSystemRole && (

                  <small>
                    Permissions verrouillées
                  </small>

                )}

                {!canManage && (

                  <small>
                    Consultation uniquement
                  </small>

                )}

              </div>

            </div>

          </section>

          {/* ==============================================
              MATRICE DES PERMISSIONS
          ============================================== */}

          <section className="rp-card">

            <div className="rp-card-heading rp-permissions-heading">

              <div>

                <h2>
                  Permissions par module
                </h2>

                <p>
                  {selectedPermissionsCount}
                  {' permission(s) accordée(s)'}
                  {' • '}
                  {activeRoleUsers}
                  {' utilisateur(s) actif(s)'}
                </p>

              </div>

              <button
                type="button"
                className="rp-reset-button"
                onClick={handleReset}
                disabled={
                  !canEditSelectedRole ||
                  selectedPermissionsCount === 0
                }
                title={
                  isSystemRole
                    ? 'Permissions administrateur verrouillées'
                    : !canManage
                      ? 'Modification réservée à l’administrateur'
                      : selectedPermissionsCount === 0
                        ? 'Aucune permission à réinitialiser'
                        : 'Réinitialiser les permissions'
                }
              >

                <RotateCcw size={16} />

                Réinitialiser

              </button>

            </div>

            {/* RÔLE SYSTÈME */}

            {isSystemRole && (

              <div className="rp-system-notice">

                Les permissions du rôle
                Administrateur sont verrouillées
                dans cette démonstration.

              </div>

            )}

            {/* LECTURE SEULE */}

            {!canManage && (

              <div className="rp-system-notice">

                Votre profil permet uniquement
                de consulter cette configuration.

              </div>

            )}

            {/* ============================================
                TABLEAU
            ============================================ */}

            <div className="rp-table-wrapper">

              <table className="rp-table">

                <thead>

                  <tr>

                    <th scope="col">
                      Module
                    </th>

                    {permissionColumns.map(
                      (column) => (

                        <th
                          key={column.key}
                          scope="col"
                        >

                          {column.label}

                        </th>

                      ),
                    )}

                  </tr>

                </thead>

                <tbody>

                  {PERMISSION_MODULES.map(
                    (module) => {
                      const ModuleIcon =
                        moduleIcons[
                          module.key
                        ]

                      const granted =
                        permissions[
                          selectedRole
                        ][module.key]

                      return (

                        <tr key={module.key}>

                          {/* MODULE */}

                          <td>

                            <div className="rp-module-name">

                              <ModuleIcon
                                size={17}
                              />

                              <strong>
                                {module.label}
                              </strong>

                            </div>

                          </td>

                          {/* ACTIONS */}

                          {permissionColumns.map(
                            (column) => {
                              const available =
                                module.actions.some(
                                  (action) =>
                                    action ===
                                    column.key,
                                )

                              if (!available) {
                                return (

                                  <td
                                    key={column.key}
                                    className="rp-unavailable"
                                    aria-label="Action indisponible"
                                  >

                                    —

                                  </td>

                                )
                              }

                              const checked =
                                granted.includes(
                                  column.key,
                                )

                              return (

                                <td
                                  key={column.key}
                                >

                                  <input
                                    type="checkbox"
                                    className="rp-checkbox"
                                    checked={checked}
                                    disabled={
                                      !canEditSelectedRole
                                    }
                                    aria-label={`${column.label} — ${module.label} — ${ROLE_LABELS[selectedRole]}`}
                                    onChange={() =>
                                      handlePermissionToggle(
                                        module.key,
                                        column.key,
                                        module.label,
                                        column.label,
                                      )
                                    }
                                  />

                                </td>

                              )
                            },
                          )}

                        </tr>

                      )
                    },
                  )}

                </tbody>

              </table>

            </div>

            {/* ============================================
                PIED DU TABLEAU
            ============================================ */}

            <div className="rp-table-footer">

              <span>

                Les changements de permissions
                sont enregistrés localement
                et transmis au journal d'activité.

              </span>

              <Link
                to="/administration/utilisateurs"
              >

                Gérer les utilisateurs

              </Link>

            </div>

          </section>

        </div>

      </div>

    </div>
  )
}

export default RolesPermissions
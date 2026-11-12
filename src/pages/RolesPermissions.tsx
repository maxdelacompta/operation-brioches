import {
  Fragment,
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
  ChevronDown,
  ChevronRight,
  HandCoins,
  LayoutGrid,
  Map,
  Package,
  Wallet,
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
  Code2,
  GraduationCap,
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
  allowedForRole,
  usePermissions,
  type PermissionAction,
  type PermissionModule,
} from '../contexts/permissionsState'

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
  stagiaire_communication: GraduationCap,
  stagiaire_comptabilite: GraduationCap,
  developpeur: Code2,
}

/* =========================================================
   ICÔNES DES MODULES
   ========================================================= */

const moduleIcons: Partial<Record<PermissionModule, LucideIcon>> = {
  accueil: Home,
  dashboard: BarChart3,
  commandes: ShoppingCart,
  fiches_caisse: FileSpreadsheet,
  communication: Megaphone,
  comptabilite: Euro,
  etablissement: Building2,
  stock_brioches: Building2,
  suivi_brioches: ShoppingCart,
  recap_etablissements: BarChart3,
  bdd: Database,
  donateurs: Users,
  administration: Settings,
  utilisateurs: Users,
  roles: KeyRound,
}

/* =========================================================
   ARBORESCENCE DES DROITS — ORDRE DE LA SIDEBAR

   On réutilise les clés de permissions existantes : aucune
   migration, nouvelle permission ou modification du stockage.
   Les droits généraux absents de la Sidebar sont conservés
   dans « Autres droits » pour ne rien masquer de la matrice.
   ========================================================= */

type PermissionNavItem = {
  key: PermissionModule
  label: string
}

type PermissionNavGroup = {
  id: string
  label: string
  icon: LucideIcon
  parent?: PermissionNavItem
  children: PermissionNavItem[]
}

const permissionNavGroups: PermissionNavGroup[] = [
  {
    id: 'gestion', label: 'Gestion', icon: LayoutGrid,
    children: [
      { key: 'dashboard', label: 'Tableau de bord' },
      { key: 'suivi_caisse_tpe', label: 'Suivi caisse et TPE' },
      { key: 'stands_brioches', label: 'Stands Brioches' },
    ],
  },
  {
    id: 'bdd', label: 'BDD', icon: Database,
    parent: { key: 'bdd', label: 'Accès général à la BDD' },
    children: [
      { key: 'donateurs', label: 'Donateurs' },
      { key: 'mairies', label: 'Mairies' },
      { key: 'benevoles', label: 'Bénévoles' },
    ],
  },
  {
    id: 'commandes-dons', label: 'Commandes dons', icon: ShoppingCart,
    children: [
      { key: 'commandes', label: 'Commandes entreprises' },
      { key: 'livraisons', label: 'Livraisons / Retraits' },
      { key: 'suivi_entreprises', label: 'Suivi global entreprises' },
      { key: 'commandes_mairies', label: 'Commandes Mairies & RS' },
    ],
  },
  {
    id: 'commandes-achats', label: 'Commandes achats', icon: Package,
    children: [
      { key: 'suivi_achats', label: 'Suivi global achats' },
      { key: 'fournisseurs', label: 'Fournisseurs' },
      { key: 'artisans', label: 'Artisans' },
      { key: 'gms', label: 'GMS' },
      { key: 'industriels', label: 'Industriels' },
    ],
  },
  {
    id: 'etablissements', label: 'Établissements', icon: Building2,
    children: [
      { key: 'stock_brioches', label: 'Stock Brioches' },
      { key: 'suivi_brioches', label: 'Suivi Brioches' },
      { key: 'recap_etablissements', label: 'Récap global' },
    ],
  },
  {
    id: 'dons-percus', label: 'Dons perçus', icon: HandCoins,
    children: [
      { key: 'fiches_caisse', label: 'Fiches de caisse' },
      { key: 'coffre', label: 'Coffre' },
      { key: 'gestion_cheques', label: 'Gestion des chèques' },
      { key: 'suivi_banque', label: 'Suivi banque' },
      { key: 'recapitulatif', label: 'Récapitulatif global' },
    ],
  },
  {
    id: 'finance', label: 'Documents', icon: Wallet,
    children: [
      { key: 'factures_paiements', label: 'Factures & Paiements' },
      { key: 'justificatifs', label: 'Justificatifs de dons' },
      { key: 'mecenat', label: 'Mécénat' },
      { key: 'pertes_ecarts', label: 'Pertes / Écarts' },
    ],
  },
  {
    id: 'geographie', label: 'Géographie', icon: Map,
    parent: { key: 'geographie', label: 'Accès général à la géographie' },
    children: [
      { key: 'geo_carte', label: 'Carte des ventes' },
    ],
  },
  {
    id: 'administration', label: 'Administration', icon: Settings,
    parent: { key: 'administration', label: 'Accès général à l’administration' },
    children: [
      { key: 'admin_etablissements', label: 'Liste des établissements' },
      { key: 'acces_connexion', label: 'Accès de connexion' },
      { key: 'utilisateurs', label: 'Utilisateurs' },
      { key: 'roles', label: 'Rôles et permissions' },
      { key: 'campagnes', label: 'Campagnes' },
      { key: 'parametres', label: 'Paramètres généraux' },
      { key: 'journal', label: 'Journal d’activité' },
    ],
  },
]

const modulesInNavigation = new Set<PermissionModule>([
  'accueil',
  ...permissionNavGroups.flatMap(group => [
    ...(group.parent ? [group.parent.key] : []),
    ...group.children.map(item => item.key),
  ]),
])

const secondaryPermissionModules: PermissionNavItem[] = PERMISSION_MODULES
  .filter(module => !modulesInNavigation.has(module.key))
  .map(module => ({ key: module.key, label: module.label }))

const permissionGroups: PermissionNavGroup[] = [
  ...permissionNavGroups,
  ...(secondaryPermissionModules.length > 0 ? [{
    id: 'autres', label: 'Autres droits (hors Sidebar)', icon: Settings,
    children: secondaryPermissionModules,
  }] : []),
]

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
  stagiaire_communication: {
    description: 'Accès temporaire en lecture aux activités du pôle Communication, sans données sensibles ni gestion des utilisateurs.',
    perimetre: 'Pôle Communication',
  },
  stagiaire_comptabilite: {
    description: 'Accès temporaire en lecture aux activités comptables autorisées, sans validation ni opérations financières.',
    perimetre: 'Pôle Comptabilité',
  },
  developpeur: {
    description: 'Accès technique étendu : pas de suppression ni de modification des utilisateurs, droits, paramètres ou opérations financières sensibles.',
    perimetre: 'Technique — accès étendu contrôlé',
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

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(permissionGroups.map(group => [group.id, group.id !== 'gestion']))
  )

  const toggleGroup = (id: string) => {
    setCollapsedGroups(current => ({ ...current, [id]: !current[id] }))
  }

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

  function handleAllModulePermissions(moduleKey: PermissionModule) {
    if (!canEditSelectedRole) return
    const definition = PERMISSION_MODULES.find((item) => item.key === moduleKey)
    if (!definition) return
    const granted = permissions[selectedRole][moduleKey]
    const allGranted = definition.actions.every((action) => granted.includes(action))
    if (allGranted) {
      // Désactiver "Voir" retire toutes les autorisations du module.
      if (granted.includes('consulter')) togglePermission(selectedRole, moduleKey, 'consulter')
    } else {
      // Le hook emploie une mise à jour fonctionnelle, sans écrasement des changements.
      definition.actions.forEach((action) => {
        if (!granted.includes(action) && allowedForRole(selectedRole, moduleKey, action)) togglePermission(selectedRole, moduleKey, action)
      })
    }
    setNotice('Autorisations du module mises à jour.')
    setError('')
  }

  function handlePermissionToggle(
    moduleKey: PermissionModule,
    action: PermissionAction,
    moduleLabel: string,
    actionLabel: string,
  ) {
    if (!canEditSelectedRole || !allowedForRole(selectedRole, moduleKey, action)) {
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
     SÉLECTION GROUPÉE PAR RUBRIQUE

     La sélection agit sur chaque module individuellement via le
     moteur actuel, sans créer de droit « virtuel ».
     ======================================================= */

  function modulesDuGroupe(group: PermissionNavGroup): PermissionModule[] {
    return [
      ...(group.parent ? [group.parent.key] : []),
      ...group.children.map(item => item.key),
    ]
  }

  function droitsAutorisés(moduleKey: PermissionModule): PermissionAction[] {
    const definition = PERMISSION_MODULES.find(item => item.key === moduleKey)
    return definition?.actions.filter(action => allowedForRole(selectedRole, moduleKey, action)) ?? []
  }

  function handleGroupAction(group: PermissionNavGroup, action: PermissionAction) {
    if (!canEditSelectedRole) return
    const eligible = modulesDuGroupe(group).filter(key => droitsAutorisés(key).includes(action))
    if (!eligible.length) return
    const grant = eligible.some(key => !permissions[selectedRole][key].includes(action))
    eligible.forEach(key => {
      const currentlyGranted = permissions[selectedRole][key].includes(action)
      if (currentlyGranted !== grant) togglePermission(selectedRole, key, action)
    })
    setNotice(`Droits « ${action} » de la rubrique « ${group.label} » mis à jour.`)
    setError('')
    logRoleActivity('modification', `Permissions groupées « ${action} » modifiées pour « ${group.label} ».`)
  }

  function handleGroupAll(group: PermissionNavGroup) {
    if (!canEditSelectedRole) return
    const entries = modulesDuGroupe(group).map(key => ({ key, actions: droitsAutorisés(key) }))
      .filter(item => item.actions.length > 0)
    if (!entries.length) return
    const allGranted = entries.every(item => item.actions.every(action =>
      permissions[selectedRole][item.key].includes(action)))

    for (const item of entries) {
      if (allGranted) {
        if (permissions[selectedRole][item.key].includes('consulter')) {
          togglePermission(selectedRole, item.key, 'consulter')
        }
      } else {
        for (const action of item.actions) {
          if (!permissions[selectedRole][item.key].includes(action)) {
            togglePermission(selectedRole, item.key, action)
          }
        }
      }
    }
    setNotice(`Permissions de la rubrique « ${group.label} » mises à jour.`)
    setError('')
    logRoleActivity('modification', `Droits de toute la rubrique « ${group.label} » ${allGranted ? 'retirés' : 'accordés'}.`)
  }

  function renderPermissionRow(item: PermissionNavItem, nested: boolean) {
    const module = PERMISSION_MODULES.find(definition => definition.key === item.key)
    if (!module) return null
    const ModuleIcon = moduleIcons[module.key] ?? ShieldCheck
    const granted = permissions[selectedRole][module.key]
    return (
      <tr key={module.key} className={nested ? 'rp-nav-child-row' : 'rp-nav-main-row'}>
        <td>
          <div className="rp-module-name">
            <ModuleIcon size={16} aria-hidden="true" />
            <strong>{item.label}</strong>
          </div>
        </td>
        {permissionColumns.map(column => {
          const available = module.actions.some(action => action === column.key)
          if (!available) return <td key={column.key} className="rp-unavailable">—</td>
          return (
            <td key={column.key}>
              <input
                type="checkbox"
                className="rp-checkbox"
                checked={granted.includes(column.key)}
                disabled={!canEditSelectedRole || !allowedForRole(selectedRole, module.key, column.key)}
                aria-label={`${column.label} — ${item.label} — ${ROLE_LABELS[selectedRole]}`}
                onChange={() => handlePermissionToggle(module.key, column.key, item.label, column.label)}
              />
            </td>
          )
        })}
        <td>
          <input
            type="checkbox"
            className="rp-checkbox"
            checked={module.actions.every(action => granted.includes(action))}
            disabled={!canEditSelectedRole || module.actions.some(action => !allowedForRole(selectedRole, module.key, action))}
            aria-label={`Tous les droits — ${item.label} — ${ROLE_LABELS[selectedRole]}`}
            onChange={() => handleAllModulePermissions(module.key)}
          />
        </td>
      </tr>
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

                <p className="rp-nav-hint">
                  Les rubriques suivent la Sidebar. Coche une rubrique pour appliquer un droit
                  à ses sous-pages, ou déplie-la pour régler chaque page séparément.
                </p>

              </div>

              <div className="rp-nav-toolbar">
                <button type="button" className="rp-nav-expand-button" onClick={() => setCollapsedGroups({})}>
                  Tout déplier
                </button>
                <button type="button" className="rp-nav-expand-button" onClick={() =>
                  setCollapsedGroups(Object.fromEntries(permissionGroups.map(group => [group.id, true])))
                }>
                  Tout replier
                </button>
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

                    <th scope="col">Tous les droits</th>

                  </tr>

                </thead>

                <tbody>
                  {renderPermissionRow({ key: 'accueil', label: 'Accueil' }, false)}

                  {permissionGroups.map(group => {
                    const keys = modulesDuGroupe(group)
                    const expanded = !collapsedGroups[group.id]
                    const GroupIcon = group.icon
                    return (
                      <Fragment key={group.id}>
                        <tr className="rp-nav-group-row">
                          <th scope="row" className="rp-nav-group-label">
                            <button
                              type="button"
                              className="rp-nav-group-toggle"
                              onClick={() => toggleGroup(group.id)}
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Replier' : 'Déplier'} ${group.label}`}
                            >
                              <GroupIcon size={17} aria-hidden="true" />
                              <strong>{group.label}</strong>
                              <span className="rp-nav-group-count">{keys.length}</span>
                              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </th>
                          {permissionColumns.map(column => {
                            const eligible = keys.filter(key => droitsAutorisés(key).includes(column.key))
                            const count = eligible.filter(key => permissions[selectedRole][key].includes(column.key)).length
                            return (
                              <td key={column.key}>
                                {eligible.length ? (
                                  <input
                                    type="checkbox"
                                    className="rp-checkbox rp-group-checkbox"
                                    checked={count === eligible.length}
                                    disabled={!canEditSelectedRole}
                                    title={`${count}/${eligible.length} module(s) — ${column.label} dans ${group.label}`}
                                    aria-label={`${column.label} pour toute la rubrique ${group.label}`}
                                    onChange={() => handleGroupAction(group, column.key)}
                                  />
                                ) : <span className="rp-unavailable">—</span>}
                              </td>
                            )
                          })}
                          <td>
                            <input
                              type="checkbox"
                              className="rp-checkbox rp-group-checkbox"
                              checked={keys.every(key => {
                                const actions = droitsAutorisés(key)
                                return actions.length === 0 || actions.every(action => permissions[selectedRole][key].includes(action))
                              })}
                              disabled={!canEditSelectedRole || keys.every(key => droitsAutorisés(key).length === 0)}
                              title={`Activer ou retirer tous les droits autorisés de ${group.label}`}
                              aria-label={`Tous les droits autorisés — rubrique ${group.label}`}
                              onChange={() => handleGroupAll(group)}
                            />
                          </td>
                        </tr>
                        {expanded && group.parent && renderPermissionRow(group.parent, true)}
                        {expanded && group.children.map(item => renderPermissionRow(item, true))}
                      </Fragment>
                    )
                  })}
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
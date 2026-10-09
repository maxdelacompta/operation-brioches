export type PermissionAction =
  | 'consulter'
  | 'creer'
  | 'modifier'
  | 'valider'
  | 'exporter'
  | 'supprimer'

export const PERMISSION_ACTIONS = [
  { key: 'consulter', label: 'Voir' },
  { key: 'creer', label: 'Créer' },
  { key: 'modifier', label: 'Modifier' },
  { key: 'valider', label: 'Valider' },
  { key: 'exporter', label: 'Exporter' },
  { key: 'supprimer', label: 'Supprimer' },
] as const

/* =========================================================
   MODULES EXISTANTS
   ========================================================= */

export const PERMISSION_MODULES = [
  {
    key: 'accueil',
    label: 'Accueil',
    path: '/',
    actions: ['consulter'],
  },
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    path: '/dashboard',
    actions: ['consulter', 'exporter'],
  },
  {
    key: 'commandes',
    label: 'Commandes',
    path: '/commandes',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'valider',
      'exporter',
      'supprimer',
    ],
  },
  {
    key: 'fiches_caisse',
    label: 'Fiches de caisse',
    path: '/encaissements/fiches-caisse',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'valider',
      'exporter',
      'supprimer',
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    path: '/communication',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'valider',
      'exporter',
      'supprimer',
    ],
  },
  {
    key: 'comptabilite',
    label: 'Comptabilité',
    path: '/comptabilite',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'valider',
      'exporter',
      'supprimer',
    ],
  },
  {
    key: 'etablissement',
    label: 'Établissement',
    path: '/etablissement',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'valider',
      'exporter',
    ],
  },
  {
    key: 'bdd',
    label: 'Base de données',
    path: '/bdd',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'exporter',
      'supprimer',
    ],
  },
  {
    key: 'donateurs',
    label: 'Donateurs',
    path: '/bdd/donateurs',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'exporter',
      'supprimer',
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    path: '/administration',
    actions: ['consulter'],
  },
  {
    key: 'utilisateurs',
    label: 'Utilisateurs',
    path: '/administration/utilisateurs',
    actions: [
      'consulter',
      'creer',
      'modifier',
      'supprimer',
    ],
  },
  {
    key: 'roles',
    label: 'Rôles et permissions',
    path: '/administration/roles',
    actions: ['consulter', 'modifier'],
  },
  // Modules Établissements : affichage libre durant la phase de développement.
  { key: 'stock_brioches', label: 'Stock Brioches', path: '/etablissements/stock-brioches', actions: ['consulter'] },
  { key: 'suivi_brioches', label: 'Suivi Brioches', path: '/etablissements/suivi-brioches', actions: ['consulter'] },
  { key: 'recap_brioches', label: 'Récap global Brioches', path: '/etablissements/recap-global', actions: ['consulter'] },
  { key: 'suivi_caisse_tpe', label: 'Suivi caisse et TPE', path: '/gestion/suivi-caisse-tpe', actions: ['consulter'] },
  { key: 'mairies', label: 'Mairies', path: '/bdd/mairies', actions: ['consulter'] },
  { key: 'livraisons', label: 'Livraisons / Retraits', path: '/commandes/livraisons-retraits', actions: ['consulter'] },
  { key: 'suivi_entreprises', label: 'Suivi global entreprises', path: '/commandes/suivi-global-entreprises', actions: ['consulter'] },
  { key: 'commandes_mairies', label: 'Commandes Mairies et RS', path: '/commandes/mairies-rs', actions: ['consulter'] },
  { key: 'artisans', label: 'Commandes artisans', path: '/commandes-achats/artisans', actions: ['consulter'] },
  { key: 'fournisseurs', label: 'Fournisseurs', path: '/commandes-achats/fournisseurs', actions: ['consulter'] },
  { key: 'gms', label: 'Commandes GMS', path: '/commandes-achats/gms', actions: ['consulter'] },
  { key: 'coffre', label: 'Coffre', path: '/encaissements/coffre', actions: ['consulter'] },
  { key: 'suivi_banque', label: 'Suivi banque', path: '/encaissements/suivi-banque', actions: ['consulter'] },
  { key: 'recapitulatif', label: 'Récapitulatif global', path: '/encaissements/recapitulatif-global', actions: ['consulter'] },
  { key: 'justificatifs', label: 'Justificatifs de dons', path: '/finance/justificatifs-dons', actions: ['consulter'] },
  { key: 'geographie', label: 'Géographie', path: '/geographie', actions: ['consulter'] },
  { key: 'campagnes', label: 'Campagnes', path: '/administration/campagnes', actions: ['consulter'] },
  { key: 'admin_etablissements', label: 'Gestion des établissements', path: '/administration/etablissements', actions: ['consulter'] },
  { key: 'parametres', label: 'Paramètres généraux', path: '/administration/parametres', actions: ['consulter'] },
  { key: 'journal', label: 'Journal d’activité', path: '/administration/journal', actions: ['consulter'] },
  { key: 'theme', label: 'Aperçu du thème', path: '/theme-preview', actions: ['consulter'] },
] as const satisfies readonly {
  key: string
  label: string
  path: string
  actions: readonly PermissionAction[]
}[]

export type PermissionModule =
  (typeof PERMISSION_MODULES)[number]['key']


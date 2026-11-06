import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Download,
  FileClock,
  FilterX,
  Info,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'

import {
  getUserDisplayName,
  useUsers,
} from '../contexts/UsersContext'

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_EVENT_NAME,
  ACTIVITY_STORAGE_KEY,
  MAX_ACTIVITY_ENTRIES,
  readActivityLog,
  recordActivity,
  type ActivityAction,
  type ActivityCategory,
  type ActivityEntry,
} from '../services/activityLog'

import {
  getAutomaticAuditDiagnostics,
  isAutomaticAuditInstalled,
  probeAutomaticAudit,
} from '../services/automaticAudit'

import './JournalActivite.css'

/* =========================================================
   FORMATAGE DES DATES
   ========================================================= */

const dateFormatter = new Intl.DateTimeFormat(
  'fr-FR',
  {
    dateStyle: 'short',
    timeStyle: 'medium',
  },
)

function formatDate(
  value: string,
): string {
  return dateFormatter.format(
    new Date(value),
  )
}

function getLocalDate(
  value: string,
): string {
  const date = new Date(value)

  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/* =========================================================
   PROTECTION CSV

   Empêche qu'un texte commençant par une formule soit
   interprété directement comme formule de tableur.
   ========================================================= */

function escapeCsv(
  value: string,
): string {
  const sanitized =
    /^[\s]*[=+\-@]/.test(value)
      ? `'${value}`
      : value

  return `"${sanitized.replaceAll(
    '"',
    '""',
  )}"`
}

/* =========================================================
   PAGE
   ========================================================= */

function isTechnicalTrace(entry: ActivityEntry): boolean {
  return entry.source === 'automatique' ||
    entry.source === 'diagnostic' ||
    entry.message.startsWith('TEST TECHNIQUE') ||
    entry.message.includes('Nature exacte de l\'action à confirmer') ||
    entry.message.startsWith('Suppression d\'un enregistrement local')
}

function JournalActivite() {
  const {
    currentUser,
    users,
  } = useUsers()

  /* =======================================================
     ÉVÉNEMENTS
     ======================================================= */

  const [
    entries,
    setEntries,
  ] = useState<ActivityEntry[]>(
    readActivityLog,
  )

  /* =======================================================
     FILTRES
     ======================================================= */

  const [search, setSearch] =
    useState('')

  const [actorFilter, setActorFilter] =
    useState('TOUS')

  const [categoryFilter, setCategoryFilter] =
    useState('TOUTES')

  const [actionFilter, setActionFilter] =
    useState('TOUTES')

  const [sourceFilter, setSourceFilter] = useState('TOUTES')

  const [dateFrom, setDateFrom] =
    useState('')

  const [dateTo, setDateTo] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const [auditDiagnostic, setAuditDiagnostic] = useState(getAutomaticAuditDiagnostics)

  /* =======================================================
     SYNCHRONISATION DU JOURNAL

     Même onglet : événement personnalisé.
     Autre onglet : événement storage.
     ======================================================= */

  useEffect(() => {
    function refresh() {
      setEntries(
        readActivityLog(),
      )
    }

    function handleStorage(
      event: StorageEvent,
    ) {
      if (
        event.key === ACTIVITY_STORAGE_KEY ||
        event.key === null
      ) {
        refresh()
      }
    }

    window.addEventListener(
      ACTIVITY_EVENT_NAME,
      refresh,
    )

    window.addEventListener(
      'storage',
      handleStorage,
    )

    return () => {
      window.removeEventListener(
        ACTIVITY_EVENT_NAME,
        refresh,
      )

      window.removeEventListener(
        'storage',
        handleStorage,
      )
    }
  }, [])

  // Les anciens comptes restent sélectionnables tant que leurs
  // événements figurent dans le journal local.
  const actorOptions = useMemo(() => {
    const registered = users.map(user => ({
      id: user.id,
      label: getUserDisplayName(user),
    }))
    const known = new Set(registered.map(user => user.id))
    const historical = entries
      .filter(entry => entry.actorId && !known.has(entry.actorId))
      .map(entry => ({
        id: entry.actorId as string,
        label: `${entry.actorName} (ancien compte)`,
      }))
    const uniqueHistorical = Array.from(
      new Map(historical.map(user => [user.id, user])).values(),
    )
    return [...registered, ...uniqueHistorical]
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [users, entries])

  const selectedActor = actorOptions.find(user => user.id === actorFilter)
  const actorEntries = actorFilter === 'TOUS'
    ? entries
    : entries.filter(entry => entry.actorId === actorFilter)

  /* =======================================================
     RÉSULTATS FILTRÉS
     ======================================================= */

  const filteredEntries = useMemo(
    () => {
      const query = search
        .trim()
        .toLowerCase()

      return entries.filter(
        (entry) => {
          const matchesActor =
            actorFilter === 'TOUS' || entry.actorId === actorFilter

          const matchesCategory =
            categoryFilter === 'TOUTES' ||
            entry.category === categoryFilter

          const matchesAction =
            actionFilter === 'TOUTES' ||
            entry.action === actionFilter

          const technicalTrace = isTechnicalTrace(entry)
          const matchesSource =
            sourceFilter === 'TOUTES' ||
            (sourceFilter === 'TECHNIQUE' ? technicalTrace : !technicalTrace)

          const entryDate =
            getLocalDate(entry.at)

          const matchesFrom =
            !dateFrom ||
            entryDate >= dateFrom

          const matchesTo =
            !dateTo ||
            entryDate <= dateTo

          const searchable = [
            entry.actorName,
            entry.actorId ?? '',
            entry.target,
            entry.message,
            ACTIVITY_CATEGORIES[
              entry.category
            ],
            ACTIVITY_ACTIONS[
              entry.action
            ],
          ]
            .join(' ')
            .toLowerCase()

          const matchesSearch =
            !query ||
            searchable.includes(query)

          return (
            matchesActor &&
            matchesCategory &&
            matchesAction &&
            matchesSource &&
            matchesFrom &&
            matchesTo &&
            matchesSearch
          )
        },
      )
    },
    [
      entries,
      actorFilter,
      search,
      categoryFilter,
      actionFilter,
      sourceFilter,
      dateFrom,
      dateTo,
    ],
  )

  /* =======================================================
     INDICATEURS
     ======================================================= */

  const technicalCount = filteredEntries.filter(isTechnicalTrace).length
  const businessCount = filteredEntries.length - technicalCount
  const actorModuleCounts = Object.entries(
    actorEntries.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.category] = (counts[entry.category] || 0) + 1
      return counts
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const today = getLocalDate(
    new Date().toISOString(),
  )

  const todayCount = entries.filter(
    (entry) =>
      getLocalDate(entry.at) === today,
  ).length

  const actorsCount = new Set(
    entries
      .map((entry) => entry.actorId)
      .filter(Boolean),
  ).size

  const modulesCount = new Set(
    entries.map(
      (entry) => entry.category,
    ),
  ).size

  /* =======================================================
     RÉINITIALISATION DES FILTRES
     ======================================================= */

  function resetFilters() {
    setSearch('')
    setActorFilter('TOUS')
    setCategoryFilter('TOUTES')
    setActionFilter('TOUTES')
    setSourceFilter('TOUTES')
    setDateFrom('')
    setDateTo('')
  }

  /* =======================================================
     EXPORT CSV
     ======================================================= */

  function handleExport() {
    if (
      filteredEntries.length === 0 ||
      currentUser?.role !== 'administrateur'
    ) {
      return
    }

    setNotice('')

    const headers = [
      'Date',
      'Utilisateur',
      'Identifiant utilisateur',
      'Module',
      'Action',
      'Élément',
      'Description',
      'Type de trace',
    ]

    const rows = filteredEntries.map(
      (entry) => [
        formatDate(entry.at),
        entry.actorName,
        entry.actorId ?? '',
        ACTIVITY_CATEGORIES[
          entry.category
        ],
        ACTIVITY_ACTIONS[
          entry.action
        ],
        entry.target,
        entry.message,
        isTechnicalTrace(entry) ? 'Automatique (technique)' : 'Action métier',
      ],
    )

    const csv = [
      headers,
      ...rows,
    ]
      .map(
        (row) =>
          row
            .map(
              (value) =>
                escapeCsv(value),
            )
            .join(';'),
      )
      .join('\r\n')

    try {
      const blob = new Blob(
        [
          '\uFEFF',
          csv,
        ],
        {
          type: 'text/csv;charset=utf-8',
        },
      )

      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')

      link.href = url

      link.download =
        `journal-activite-${actorFilter === 'TOUS' ? 'tous' : actorFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}-${today}.csv`

      document.body.appendChild(link)

      link.click()

      link.remove()

      // Le téléchargement est déclenché.
      // Il reste soumis au comportement du navigateur.
      URL.revokeObjectURL(url)

      recordActivity({
        actorId: currentUser.id,
        actorName: currentUser.name,

        category: 'journal',
        action: 'export',

        target: 'Journal CSV',

        message:
          `Export CSV déclenché pour ${filteredEntries.length} événement(s).`,
      })

      setNotice(
        `Export déclenché : ${filteredEntries.length} événement(s).`,
      )
    } catch {
      setNotice(
        "L'export CSV n'a pas pu être déclenché.",
      )
    }
  }

  /* =======================================================
     CONTRÔLE D'AFFICHAGE

     Protection d'interface uniquement.
     ======================================================= */

  if (
    currentUser?.role !== 'administrateur'
  ) {
    return (
      <div className="activity-page">

        <Link
          to="/administration"
          className="activity-back"
        >
          <ArrowLeft size={16} />
          Administration
        </Link>

        <section className="activity-card activity-denied">

          <ShieldCheck size={32} />

          <h1>
            Accès non disponible
          </h1>

          <p>
            Cette page est réservée au profil
            Administrateur dans le prototype.
          </p>

        </section>

      </div>
    )
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="activity-page">

      {/* RETOUR */}

      <Link
        to="/administration"
        className="activity-back"
      >
        <ArrowLeft size={16} />
        Administration
      </Link>

      {/* ===================================================
          EN-TÊTE
      =================================================== */}

      <header className="activity-header">

        <div className="activity-header-left">

          <div className="activity-header-icon">
            <FileClock size={28} />
          </div>

          <div>

            <span className="activity-eyebrow">
              ADMINISTRATION
            </span>

            <h1>
              Journal d'activité
            </h1>

            <p>
              Consultez les actions enregistrées
              dans le prototype.
            </p>

          </div>

        </div>

        <button
          type="button"
          className="activity-export-button"
          onClick={handleExport}
          disabled={
            filteredEntries.length === 0
          }
        >

          <Download size={17} />

          Exporter CSV

        </button>

      </header>

      {/* ===================================================
          AVERTISSEMENT
      =================================================== */}

      <div className="activity-warning">

        <ShieldCheck size={19} />

        <span>
          Journal local de démonstration.
          Les événements ne sont pas encore
          centralisés, infalsifiables ou
          synchronisés entre les utilisateurs.
          Seules les actions raccordées
          au service de journalisation
          sont enregistrées.
        </span>

      </div>

      <div className="activity-warning" role="status">
        <Info size={19} />
        <span>
          Collecte automatique : <strong>{isAutomaticAuditInstalled() ? 'installée' : 'non installée'}</strong>.
          {' '}Les événements automatiques apparaissent uniquement après de nouvelles sauvegardes locales.
          {' '}Ils ne couvrent pas les simples consultations ni les actions non sauvegardées.
          {' '}Si les nouvelles traces apparaissent sous « Session locale non identifiée », vérifiez la connexion de l’utilisateur.
        </span>
      </div>

      <div className="activity-warning" role="group" aria-label="Diagnostic du journal">
        <Info size={19} />
        <span>
          <strong>Diagnostic de la source :</strong> crée une entrée de test clairement
          identifiée, sans modifier les données métier. Si elle s'affiche, le stockage
          et la lecture du journal fonctionnent ; il reste à tester une vraie modification.
        </span>
        <button
          type="button"
          onClick={() => {
            setActorFilter('TOUS')
            setCategoryFilter('TOUTES')
            setActionFilter('TOUTES')
            setSourceFilter('TOUTES')
            setDateFrom('')
            setDateTo('')
            setSearch('')
            const ok = recordActivity({
              actorId: currentUser?.id ?? null,
              actorName: currentUser ? getUserDisplayName(currentUser) : 'Session locale non identifiée',
              category: 'journal',
              source: 'diagnostic',
              action: 'consultation',
              target: 'Diagnostic du journal',
              message: 'TEST TECHNIQUE — Vérification explicite de la collecte et de l’affichage du journal.',
            })
            setNotice(ok ? 'Test enregistré. La nouvelle ligne « Diagnostic du journal » doit apparaître ci-dessous.' : 'Test impossible : écriture du journal local refusée.')
          }}
        >
          Tester le journal
        </button>
        <button
          type="button"
          onClick={() => {
            setActorFilter('TOUS')
            setCategoryFilter('TOUTES')
            setActionFilter('TOUTES')
            setSourceFilter('TOUTES')
            setDateFrom('')
            setDateTo('')
            setSearch('')
            const result = probeAutomaticAudit()
            setAuditDiagnostic(getAutomaticAuditDiagnostics())
            setEntries(readActivityLog())
            setNotice(`Test de capture : ${result.message}`)
          }}
        >
          Tester la capture des sauvegardes
        </button>
        <span>
          Capture active : <strong>{auditDiagnostic.installed ? 'oui' : 'non'}</strong> ;
          {' '}écritures interceptées : <strong>{auditDiagnostic.interceptedWrites}</strong> ;
          {' '}écritures surveillées : <strong>{auditDiagnostic.matchedWrites}</strong>.
          {auditDiagnostic.lastError && (
            <span> Dernière erreur : {auditDiagnostic.lastError}</span>
          )}
        </span>
      </div>

      {/* CONFIRMATION */}

      {notice && (

        <div
          className="activity-notice"
          role="status"
        >
          <Info size={17} />

          {notice}

        </div>

      )}

      <section className="activity-card activity-person-report">
        <div className="activity-section-heading">
          <div>
            <h2>Rapport par utilisateur</h2>
            <p>Sélectionnez un compte pour examiner les opérations enregistrées à son nom.</p>
          </div>
        </div>
        <label className="activity-person-picker">
          <span>Personne à consulter</span>
          <select value={actorFilter} onChange={event => setActorFilter(event.target.value)}>
            <option value="TOUS">Tous les utilisateurs</option>
            {actorOptions.map(user => (
              <option key={user.id} value={user.id}>{user.label}</option>
            ))}
          </select>
        </label>
        {actorFilter !== 'TOUS' && (
          <div className="activity-person-summary" role="status">
            <div>
              <strong>{selectedActor?.label ?? 'Compte non retrouvé'}</strong>
              <span>{actorEntries.length} événement(s) conservé(s)</span>
            </div>
            <div>
              <strong>{new Set(actorEntries.map(entry => entry.category)).size}</strong>
              <span>Module(s) concerné(s)</span>
            </div>
            <div>
              <strong>{actorEntries[0] ? formatDate(actorEntries[0].at) : '—'}</strong>
              <span>Dernière activité conservée</span>
            </div>
          </div>
        )}
        {actorFilter !== 'TOUS' && actorModuleCounts.length > 0 && (
          <div className="activity-person-modules">
            <strong>Modules les plus concernés</strong>
            <div className="activity-module-chips">
              {actorModuleCounts.map(([category, count]) => (
                <span key={category}>
                  {ACTIVITY_CATEGORIES[category as ActivityCategory] ?? category} · {count}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="activity-person-caution">
          Ce rapport contient uniquement les opérations déjà journalisées dans ce navigateur.
          L'absence d'événement ne prouve pas qu'une personne n'a effectué aucune action.
        </p>
      </section>

      <section className="activity-audit-overview" aria-label="Nature des événements affichés">
        <div>
          <span>Événements correspondant aux filtres</span>
          <strong>{filteredEntries.length}</strong>
        </div>
        <div>
          <span>Actions métier journalisées</span>
          <strong>{businessCount}</strong>
        </div>
        <div>
          <span>Traces automatiques techniques</span>
          <strong>{technicalCount}</strong>
        </div>
      </section>

      {/* ===================================================
          INDICATEURS
      =================================================== */}

      <div className="activity-stats">

        <div className="activity-stat">

          <div className="activity-stat-icon blue">
            <Activity size={22} />
          </div>

          <div>

            <span>
              Événements conservés
            </span>

            <strong>
              {entries.length}
            </strong>

          </div>

        </div>

        <div className="activity-stat">

          <div className="activity-stat-icon orange">
            <CalendarDays size={22} />
          </div>

          <div>

            <span>
              Aujourd'hui
            </span>

            <strong>
              {todayCount}
            </strong>

          </div>

        </div>

        <div className="activity-stat">

          <div className="activity-stat-icon green">
            <Users size={22} />
          </div>

          <div>

            <span>
              Utilisateurs distincts
            </span>

            <strong>
              {actorsCount}
            </strong>

          </div>

        </div>

        <div className="activity-stat">

          <div className="activity-stat-icon purple">
            <FileClock size={22} />
          </div>

          <div>

            <span>
              Modules concernés
            </span>

            <strong>
              {modulesCount}
            </strong>

          </div>

        </div>

      </div>

      {/* ===================================================
          FILTRES
      =================================================== */}

      <section className="activity-card activity-filters">

        <div className="activity-section-heading">

          <div>

            <h2>
              Rechercher une activité
            </h2>

            <p>
              Filtrez les événements enregistrés.
            </p>

          </div>

          <button
            type="button"
            className="activity-reset-filters"
            onClick={resetFilters}
          >

            <FilterX size={16} />

            Effacer les filtres

          </button>

        </div>

        <div className="activity-filter-grid">

          {/* RECHERCHE */}

          <label className="activity-search-field">

            <span>
              Recherche
            </span>

            <div className="activity-search-input">

              <Search size={18} />

              <input
                type="search"
                placeholder="Utilisateur, élément, description..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
              />

            </div>

          </label>

          {/* MODULE */}

          <label>

            <span>
              Module
            </span>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value,
                )
              }
            >

              <option value="TOUTES">
                Tous les modules
              </option>

              {(
                Object.keys(
                  ACTIVITY_CATEGORIES,
                ) as ActivityCategory[]
              ).map(
                (category) => (

                  <option
                    key={category}
                    value={category}
                  >
                    {
                      ACTIVITY_CATEGORIES[
                        category
                      ]
                    }
                  </option>

                ),
              )}

            </select>

          </label>

          {/* ACTION */}

          <label>

            <span>
              Action
            </span>

            <select
              value={actionFilter}
              onChange={(event) =>
                setActionFilter(
                  event.target.value,
                )
              }
            >

              <option value="TOUTES">
                Toutes les actions
              </option>

              {(
                Object.keys(
                  ACTIVITY_ACTIONS,
                ) as ActivityAction[]
              ).map(
                (action) => (

                  <option
                    key={action}
                    value={action}
                  >
                    {
                      ACTIVITY_ACTIONS[
                        action
                      ]
                    }
                  </option>

                ),
              )}

            </select>

          </label>

          <label>
            <span>Type de trace</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="TOUTES">Toutes les traces</option>
              <option value="METIER">Actions métier</option>
              <option value="TECHNIQUE">Traces automatiques</option>
            </select>
          </label>

          {/* DATE DE DÉBUT */}

          <label>

            <span>
              Du
            </span>

            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) =>
                setDateFrom(
                  event.target.value,
                )
              }
            />

          </label>

          {/* DATE DE FIN */}

          <label>

            <span>
              Au
            </span>

            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) =>
                setDateTo(
                  event.target.value,
                )
              }
            />

          </label>

        </div>

      </section>

      {/* ===================================================
          TABLEAU
      =================================================== */}

      <section className="activity-card">

        <div className="activity-section-heading">

          <div>

            <h2>
              Historique des actions
            </h2>

            <p>
              Affichage chronologique,
              de la plus récente à la plus ancienne.
            </p>

          </div>

          <span className="activity-results-count">

            {filteredEntries.length}
            {' résultat(s)'}

          </span>

        </div>

        <div className="activity-table-wrapper">

          <table className="activity-table">

            <thead>

              <tr>

                <th>
                  Date et heure
                </th>

                <th>
                  Utilisateur
                </th>

                <th>
                  Module
                </th>

                <th>
                  Action
                </th>

                <th>
                  Élément
                </th>

                <th>
                  Description
                </th>

                <th>
                  Source
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredEntries.map(
                (entry) => (

                  <tr key={entry.id}>

                    <td className="activity-date">
                      {formatDate(entry.at)}
                    </td>

                    <td>

                      <div className="activity-user">

                        <span className="activity-avatar">

                          {entry.actorName
                            .trim()
                            .charAt(0)
                            .toUpperCase() || '?'}

                        </span>

                        <div>

                          <strong>
                            {entry.actorName}
                          </strong>

                          <small>
                            {entry.actorId ??
                              'Identifiant indisponible'}
                          </small>

                        </div>

                      </div>

                    </td>

                    <td>

                      <span className="activity-module">

                        {
                          ACTIVITY_CATEGORIES[
                            entry.category
                          ]
                        }

                      </span>

                    </td>

                    <td>

                      <span
                        className={`activity-action activity-action-${entry.action}`}
                      >

                        {
                          ACTIVITY_ACTIONS[
                            entry.action
                          ]
                        }

                      </span>

                    </td>

                    <td className="activity-target">

                      {entry.target || '—'}

                    </td>

                    <td className="activity-description">

                      {entry.message}

                    </td>

                    <td>
                      <span className={`activity-trace-label ${isTechnicalTrace(entry) ? 'technical' : ''}`}>
                        {isTechnicalTrace(entry) ? 'Automatique' : 'Métier'}
                      </span>
                    </td>

                  </tr>

                ),
              )}

            </tbody>

          </table>

          {/* ÉTAT VIDE */}

          {filteredEntries.length === 0 && (

            <div className="activity-empty">

              <div className="activity-empty-icon">

                <FileClock size={31} />

              </div>

              <h3>

                {entries.length === 0
                  ? 'Aucune activité enregistrée'
                  : 'Aucun résultat'}

              </h3>

              <p>

                {entries.length === 0
                  ? "Les actions apparaîtront ici lorsque nous aurons connecté les modules au journal."
                  : 'Modifiez les filtres pour retrouver une activité.'}

              </p>

            </div>

          )}

        </div>

        {/* =================================================
            PIED DE TABLEAU
        ================================================= */}

        <div className="activity-table-footer">

          <span>

            Historique local limité à
            {' '}
            {MAX_ACTIVITY_ENTRIES}
            {' événements.'}

          </span>

          <span>

            {filteredEntries.length}
            {' affiché(s) sur '}
            {entries.length}

          </span>

        </div>

      </section>

    </div>
  )
}

export default JournalActivite
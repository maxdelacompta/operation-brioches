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

function JournalActivite() {
  const {
    currentUser,
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

  const [categoryFilter, setCategoryFilter] =
    useState('TOUTES')

  const [actionFilter, setActionFilter] =
    useState('TOUTES')

  const [dateFrom, setDateFrom] =
    useState('')

  const [dateTo, setDateTo] =
    useState('')

  const [notice, setNotice] =
    useState('')

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
          const matchesCategory =
            categoryFilter === 'TOUTES' ||
            entry.category === categoryFilter

          const matchesAction =
            actionFilter === 'TOUTES' ||
            entry.action === actionFilter

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
            matchesCategory &&
            matchesAction &&
            matchesFrom &&
            matchesTo &&
            matchesSearch
          )
        },
      )
    },
    [
      entries,
      search,
      categoryFilter,
      actionFilter,
      dateFrom,
      dateTo,
    ],
  )

  /* =======================================================
     INDICATEURS
     ======================================================= */

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
    setCategoryFilter('TOUTES')
    setActionFilter('TOUTES')
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
        `journal-activite-${today}.csv`

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
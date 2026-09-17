import { Link, useParams } from 'react-router-dom'

import {
  Users,
  KeyRound,
  CalendarDays,
  Settings,
  History,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'

import './Administration.css'

/* =========================================================
   SECTIONS
   ========================================================= */

const sections = [
  {
    id: 'utilisateurs',
    title: 'Utilisateurs',
    description:
      'Gérer les comptes utilisateurs et leurs accès.',
    icon: Users,
  },
  {
    id: 'roles',
    title: 'Rôles et permissions',
    description:
      'Définir les autorisations de chaque profil.',
    icon: KeyRound,
  },
  {
    id: 'campagnes',
    title: 'Campagnes',
    description:
      'Gérer les différentes campagnes Opération Brioches.',
    icon: CalendarDays,
  },
  {
    id: 'parametres',
    title: 'Paramètres généraux',
    description:
      "Configurer les paramètres de l'application.",
    icon: Settings,
  },
  {
    id: 'journal',
    title: "Journal d'activité",
    description:
      'Consulter les événements et modifications enregistrés.',
    icon: History,
  },
]

/* =========================================================
   COMPOSANT
   ========================================================= */

function Administration() {
  const { section } = useParams<{ section?: string }>()

  const activeSection = sections.find(
    (item) => item.id === section,
  )

  /* =======================================================
     SECTION SPÉCIFIQUE
     ======================================================= */

  if (section) {
    if (!activeSection) {
      return (
        <div className="admin-page">
          <Link
            to="/administration"
            className="admin-back"
          >
            ← Retour à l'administration
          </Link>

          <h1>Section introuvable</h1>

          <p>
            Cette rubrique n'existe pas dans le menu
            Administration.
          </p>
        </div>
      )
    }

    const Icon = activeSection.icon

    return (
      <div className="admin-page">

        <Link
          to="/administration"
          className="admin-back"
        >
          ← Administration
        </Link>

        <div className="admin-heading">

          <div className="admin-heading-icon">
            <Icon size={25} />
          </div>

          <div>
            <span className="admin-eyebrow">
              ADMINISTRATION
            </span>

            <h1>{activeSection.title}</h1>

            <p>{activeSection.description}</p>
          </div>

        </div>

        <div className="admin-placeholder">

          <Icon size={30} />

          <h2>
            {activeSection.title}
          </h2>

          <p>
            L'espace est créé et accessible depuis
            le menu Administration. Nous allons
            maintenant construire ses fonctionnalités.
          </p>

        </div>

      </div>
    )
  }

  /* =======================================================
     VUE D'ENSEMBLE
     ======================================================= */

  return (
    <div className="admin-page">

      <div className="admin-heading">

        <div className="admin-heading-icon">
          <ShieldCheck size={26} />
        </div>

        <div>
          <span className="admin-eyebrow">
            PARAMÈTRES ET GESTION
          </span>

          <h1>Administration</h1>

          <p>
            Gérez les utilisateurs, les campagnes et
            les paramètres d'Opération Brioches.
          </p>
        </div>

      </div>

      <div className="admin-grid">

        {sections.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              to={`/administration/${item.id}`}
              className="admin-card"
            >

              <div className="admin-card-icon">
                <Icon size={24} />
              </div>

              <div className="admin-card-content">

                <h2>{item.title}</h2>

                <p>{item.description}</p>

              </div>

              <ArrowRight
                size={19}
                className="admin-card-arrow"
              />

            </Link>
          )
        })}

      </div>

    </div>
  )
}

export default Administration
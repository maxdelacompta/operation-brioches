import { useEffect, useState } from 'react'

import {
  NavLink,
  useLocation,
} from 'react-router-dom'

import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  Database,
  Euro,
  History,
  Home,
  KeyRound,
  LayoutDashboard,
  Map,
  Megaphone,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'

import './Sidebar.css'

/* =========================================================
   SIDEBAR — OPÉRATION BRIOCHES
   ========================================================= */

function Sidebar() {
  const location = useLocation()

  /* =======================================================
     ÉTAT DU MENU ADMINISTRATION
     ======================================================= */

  const isAdminRoute =
    location.pathname === '/administration' ||
    location.pathname.startsWith('/administration/')

  const [adminOpen, setAdminOpen] = useState(isAdminRoute)

  // Ouvrir automatiquement le menu quand on arrive
  // sur une page Administration.
  useEffect(() => {
    if (
      location.pathname === '/administration' ||
      location.pathname.startsWith('/administration/')
    ) {
      setAdminOpen(true)
    }
  }, [location.pathname])

  /* =======================================================
     CLASSES DES LIENS
     ======================================================= */

  const mainLinkClass = ({
    isActive,
  }: {
    isActive: boolean
  }) =>
    `sidebar-link ${isActive ? 'active' : ''}`

  const subLinkClass = ({
    isActive,
  }: {
    isActive: boolean
  }) =>
    `sidebar-submenu-link ${isActive ? 'active' : ''}`

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <aside className="sidebar">

      {/* =====================================================
          LOGO
      ===================================================== */}

      <div className="sidebar-logo">

        <div className="sidebar-logo-mark">
          OB
        </div>

        <div>
          <strong>Opération Brioches</strong>
          <span>AEIM</span>
        </div>

      </div>

      {/* =====================================================
          NAVIGATION PRINCIPALE
      ===================================================== */}

      <nav
        className="sidebar-nav"
        aria-label="Navigation principale"
      >

        {/* ===================================================
            ACCUEIL
        =================================================== */}

        <NavLink
          to="/"
          end
          className={mainLinkClass}
        >
          <Home size={19} />

          <span>Accueil</span>
        </NavLink>

        {/* ===================================================
            TABLEAU DE BORD
        =================================================== */}

        <NavLink
          to="/dashboard"
          className={mainLinkClass}
        >
          <BarChart3 size={19} />

          <span>Tableau de bord</span>
        </NavLink>

        {/* ===================================================
            OPÉRATION BRIOCHES
        =================================================== */}

        <div className="sidebar-menu-group">

          <div className="sidebar-section-title">

            <div className="sidebar-section-title-left">
              <ShoppingCart size={18} />

              <span>Opération</span>
            </div>

            <ChevronDown size={15} />

          </div>

          <div className="sidebar-submenu">

            <NavLink
              to="/commandes"
              className={subLinkClass}
            >
              Commandes
            </NavLink>

            <NavLink
              to="/livraisons"
              className={subLinkClass}
            >
              Livraisons / Retraits
            </NavLink>

            <NavLink
              to="/suivi-operation"
              className={subLinkClass}
            >
              Suivi global
            </NavLink>

          </div>

        </div>

        {/* ===================================================
            ENCAISSEMENTS
        =================================================== */}

        <div className="sidebar-menu-group">

          <div className="sidebar-section-title">

            <div className="sidebar-section-title-left">
              <Euro size={18} />

              <span>Encaissements</span>
            </div>

            <ChevronDown size={15} />

          </div>

          <div className="sidebar-submenu">

            <NavLink
              to="/encaissements/fiches-caisse"
              className={subLinkClass}
            >
              Fiches de caisse
            </NavLink>

            <NavLink
              to="/encaissements/etablissements"
              className={subLinkClass}
            >
              Établissements
            </NavLink>

            <NavLink
              to="/encaissements/entreprises"
              className={subLinkClass}
            >
              Entreprises
            </NavLink>

            <NavLink
              to="/encaissements/mairies"
              className={subLinkClass}
            >
              Mairies
            </NavLink>

            <NavLink
              to="/encaissements/stands"
              className={subLinkClass}
            >
              Stands
            </NavLink>

            <NavLink
              to="/encaissements/recap"
              className={subLinkClass}
            >
              Récap général
            </NavLink>

          </div>

        </div>

        {/* ===================================================
            FINANCE
        =================================================== */}

        <div className="sidebar-menu-group">

          <div className="sidebar-section-title">

            <div className="sidebar-section-title-left">
              <Euro size={18} />

              <span>Finance</span>
            </div>

            <ChevronDown size={15} />

          </div>

          <div className="sidebar-submenu">

            <NavLink
              to="/finance/recettes"
              className={subLinkClass}
            >
              Recettes
            </NavLink>

            <NavLink
              to="/finance/depenses"
              className={subLinkClass}
            >
              Dépenses
            </NavLink>

            <NavLink
              to="/finance/factures"
              className={subLinkClass}
            >
              Factures
            </NavLink>

            <NavLink
              to="/finance/mecenat"
              className={subLinkClass}
            >
              Mécénat / Sponsoring
            </NavLink>

            <NavLink
              to="/finance/pertes"
              className={subLinkClass}
            >
              Pertes / Écarts
            </NavLink>

          </div>

        </div>

        {/* ===================================================
            STRUCTURES
        =================================================== */}

        <NavLink
          to="/structures"
          className={mainLinkClass}
        >
          <Building2 size={19} />

          <span>Structures</span>
        </NavLink>

        {/* ===================================================
            GÉOGRAPHIE
        =================================================== */}

        <NavLink
          to="/geographie"
          className={mainLinkClass}
        >
          <Map size={19} />

          <span>Géographie</span>
        </NavLink>

        {/* ===================================================
            COMMUNICATION
        =================================================== */}

        <NavLink
          to="/communication"
          className={mainLinkClass}
        >
          <Megaphone size={19} />

          <span>Communication</span>
        </NavLink>

        {/* ===================================================
            BASE DE DONNÉES
        =================================================== */}

        <div className="sidebar-menu-group">

          <div className="sidebar-section-title">

            <div className="sidebar-section-title-left">
              <Database size={18} />

              <span>Base de données</span>
            </div>

            <ChevronDown size={15} />

          </div>

          <div className="sidebar-submenu">

            <NavLink
              to="/bdd"
              end
              className={subLinkClass}
            >
              <Database size={15} />

              Vue d'ensemble
            </NavLink>

            <NavLink
              to="/bdd/donateurs"
              className={subLinkClass}
            >
              <Users size={15} />

              Donateurs
            </NavLink>

          </div>

        </div>

        {/* ===================================================
            ADMINISTRATION
        =================================================== */}

        <div className="sidebar-menu-group">

          {/* BOUTON OUVRIR / FERMER */}

          <button
            type="button"
            className={`sidebar-section-title sidebar-section-button ${
              isAdminRoute ? 'is-current' : ''
            }`}
            aria-expanded={adminOpen}
            aria-controls="sidebar-admin-submenu"
            onClick={() =>
              setAdminOpen((current) => !current)
            }
          >

            <div className="sidebar-section-title-left">

              <ShieldCheck size={19} />

              <span>Administration</span>

            </div>

            <ChevronDown
              size={16}
              className={`sidebar-chevron ${
                adminOpen ? 'is-open' : ''
              }`}
            />

          </button>

          {/* SOUS-MENU ADMINISTRATION */}

          {adminOpen && (
            <div
              id="sidebar-admin-submenu"
              className="sidebar-submenu sidebar-admin-submenu"
            >

              {/* VUE D'ENSEMBLE */}

              <NavLink
                to="/administration"
                end
                className={subLinkClass}
              >
                <LayoutDashboard size={16} />

                <span>Vue d'ensemble</span>
              </NavLink>

              {/* UTILISATEURS */}

              <NavLink
                to="/administration/utilisateurs"
                className={subLinkClass}
              >
                <Users size={16} />

                <span>Utilisateurs</span>
              </NavLink>

              {/* RÔLES ET PERMISSIONS */}

              <NavLink
                to="/administration/roles"
                className={subLinkClass}
              >
                <KeyRound size={16} />

                <span>Rôles et permissions</span>
              </NavLink>

              {/* CAMPAGNES */}

              <NavLink
                to="/administration/campagnes"
                className={subLinkClass}
              >
                <CalendarDays size={16} />

                <span>Campagnes</span>
              </NavLink>

              {/* PARAMÈTRES */}

              <NavLink
                to="/administration/parametres"
                className={subLinkClass}
              >
                <Settings size={16} />

                <span>Paramètres généraux</span>
              </NavLink>

              {/* JOURNAL D'ACTIVITÉ */}

              <NavLink
                to="/administration/journal"
                className={subLinkClass}
              >
                <History size={16} />

                <span>Journal d'activité</span>
              </NavLink>

            </div>
          )}

        </div>

      </nav>

      {/* =====================================================
          BAS DE SIDEBAR
      ===================================================== */}

      <div className="sidebar-footer">

        <div className="sidebar-footer-icon">
          <Truck size={18} />
        </div>

        <div>
          <strong>Opération Brioches</strong>

          <span>
            Ensemble, faisons la différence.
          </span>
        </div>

      </div>

    </aside>
  )
}

export default Sidebar
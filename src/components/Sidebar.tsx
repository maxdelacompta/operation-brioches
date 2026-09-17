import {
  useEffect,
  useState,
  type ComponentType,
} from 'react'

import {
  NavLink,
  useLocation,
} from 'react-router-dom'

import {
  Building2,
  ChevronDown,
  House,
  LayoutGrid,
  Mail,
  Map,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  HandCoins,
  Wallet,
  X,
} from 'lucide-react'

import {
  useGeneralSettings,
} from '../contexts/GeneralSettingsContext'

import './Sidebar.css'

/* =========================================================
   TYPES
   ========================================================= */

type IconComponent = ComponentType<{
  size?: number
  strokeWidth?: number
  className?: string
}>

type SidebarItem = {
  label: string
  to?: string
  badge?: string
}

type SidebarSection = {
  id: string
  label: string
  icon: IconComponent
  items: SidebarItem[]
}

/* =========================================================
   ARBORESCENCE VALIDÉE
   ========================================================= */

const sections: SidebarSection[] = [
  {
    id: 'gestion',
    label: 'Gestion',
    icon: LayoutGrid,
    items: [
      {
        label: 'Tableau de bord',
        to: '/dashboard',
      },
      {
        label: 'Suivi caisse et TPE',
      },
      {
        label: 'BDD Donateurs',
        to: '/bdd/donateurs',
      },
      {
        label: 'BDD Mairies',
      },
    ],
  },

  {
    id: 'commandes-dons',
    label: 'Commandes dons',
    icon: ShoppingCart,
    items: [
      {
        label: 'Commandes entreprises',
        to: '/commandes',
        badge: 'Base',
      },
      {
        label: 'Livraisons / Retraits',
      },
      {
        label: 'Suivi global entreprises',
      },
      {
        label: 'Commandes Mairies & RS',
      },
    ],
  },

  {
    id: 'commandes-achats',
    label: 'Commandes achats',
    icon: Package,
    items: [
      {
        label: 'GMS',
      },
      {
        label: 'Artisans',
      },
    ],
  },

  {
    id: 'etablissements',
    label: 'Établissements',
    icon: Building2,
    items: [
      {
        label: "Vue d'ensemble",
        to: '/etablissement',
      },
      {
        label: 'Commandes établissements',
      },
      {
        label: 'Stocks',
      },
      {
        label: 'Ventes',
      },
      {
        label: 'Vue globale — Siège',
      },
    ],
  },

  {
    id: 'dons-percus',
    label: 'Dons perçus',
    icon: HandCoins,
    items: [
      {
        label: 'Fiches de caisse',
        to: '/encaissements/fiches-caisse',
      },
      {
        label: 'Coffre',
        to: '/encaissements/coffre',
      },
      {
        label: 'Suivi banque',
        to: '/encaissements/suivi-banque',
      },
      {
        label: 'Récapitulatif global',
        to: '/encaissements/recapitulatif-global',
      },
    ],
  },

  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    items: [
      {
        label: "Vue d'ensemble",
        to: '/comptabilite',
      },
      {
        label: 'Justificatifs de dons',
      },
      {
        label: 'Mécénat',
      },
      {
        label: 'Pertes / Écarts',
      },
    ],
  },

  {
    id: 'geographie',
    label: 'Géographie',
    icon: Map,
    items: [],
  },

  {
    id: 'communication',
    label: 'Communication',
    icon: Mail,
    items: [
      {
        label: "Vue d'ensemble",
        to: '/communication',
      },
      {
        label: 'Mails automatiques',
      },
      {
        label: 'Relances',
      },
    ],
  },

  {
    id: 'administration',
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      {
        label: "Vue d'ensemble",
        to: '/administration',
      },
      {
        label: 'Utilisateurs',
        to: '/administration/utilisateurs',
      },
      {
        label: 'Rôles et permissions',
        to: '/administration/roles',
        badge: 'Plus tard',
      },
      {
        label: 'Campagnes',
        to: '/administration/campagnes',
      },
      {
        label: 'Paramètres généraux',
        to: '/administration/parametres',
      },
      {
        label: "Journal d'activité",
        to: '/administration/journal',
      },
    ],
  },
]

/* =========================================================
   STOCKAGE DU MODE OUVERT / FERMÉ
   ========================================================= */

const SIDEBAR_STORAGE_KEY =
  'ob-sidebar-desktop-open-v1'

function loadDesktopOpen(): boolean {
  try {
    return (
      localStorage.getItem(
        SIDEBAR_STORAGE_KEY,
      ) !== 'false'
    )
  } catch {
    return true
  }
}

/* =========================================================
   DÉTECTION DU GROUPE ACTIF
   ========================================================= */

function getActiveSection(
  pathname: string,
): string | null {
  for (const section of sections) {
    const active = section.items.some(
      (item) => {
        if (!item.to) {
          return false
        }

        // Les vues d'ensemble correspondent
        // uniquement à leur route exacte.
        if (
          item.to === '/administration' ||
          item.to === '/communication' ||
          item.to === '/comptabilite' ||
          item.to === '/etablissement'
        ) {
          return pathname === item.to
        }

        return (
          pathname === item.to ||
          pathname.startsWith(
            `${item.to}/`,
          )
        )
      },
    )

    if (active) {
      return section.id
    }
  }

  return null
}

/* =========================================================
   COMPOSANT
   ========================================================= */

function Sidebar() {
  const location = useLocation()

  const {
    settings,
  } = useGeneralSettings()

  /* =======================================================
     ÉTATS
     ======================================================= */

  const [
    desktopOpen,
    setDesktopOpen,
  ] = useState<boolean>(
    loadDesktopOpen,
  )

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false)

  const [
    expandedSections,
    setExpandedSections,
  ] = useState<Record<string, boolean>>(
    {
      gestion: true,
    },
  )

  /* =======================================================
     IDENTITÉ
     ======================================================= */

  const applicationName =
    settings.applicationName.trim() ||
    'Opération Brioches'

  const organizationName =
    settings.organizationName.trim() ||
    'AEIM'

  /* =======================================================
     PAGE ACTIVE
     ======================================================= */

  const activeSection = getActiveSection(
    location.pathname,
  )

  /* =======================================================
     SAUVEGARDER LA PRÉFÉRENCE ORDINATEUR
     ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        String(desktopOpen),
      )
    } catch {
      // La navigation reste utilisable même
      // si le stockage est indisponible.
    }
  }, [desktopOpen])

  /* =======================================================
     CHANGEMENT DE PAGE
     ======================================================= */

  useEffect(() => {
    // Ouvrir automatiquement le groupe
    // correspondant à la nouvelle page.
    if (activeSection) {
      setExpandedSections(
        (current) => ({
          ...current,
          [activeSection]: true,
        }),
      )
    }

    // Fermer le tiroir mobile après navigation.
    setMobileOpen(false)
  }, [
    activeSection,
    location.pathname,
  ])

  /* =======================================================
     ÉCHAP : FERMETURE MOBILE
     ======================================================= */

  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [mobileOpen])

  /* =======================================================
     BURGER
     ======================================================= */

  function toggleDesktop() {
    setDesktopOpen(
      (current) => !current,
    )
  }

  function toggleMobile() {
    setMobileOpen(
      (current) => !current,
    )
  }

  /* =======================================================
     ACCORDÉONS
     ======================================================= */

  function toggleSection(
    id: string,
  ) {
    setExpandedSections(
      (current) => ({
        ...current,
        [id]: !current[id],
      }),
    )
  }

  /* =======================================================
     FERMER APRÈS NAVIGATION
     ======================================================= */

  function closeMobile() {
    setMobileOpen(false)
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <>

      {/* ================================================
          CONTENEUR DE LA SIDEBAR

          C'est lui qui passe de 276px à 0px.
          ================================================= */}

      <div
        className={`ob-sidebar-shell ${
          desktopOpen
            ? 'ob-sidebar-shell--open'
            : 'ob-sidebar-shell--closed'
        }`}
      >

        {/* ==============================================
            SIDEBAR
            ============================================== */}

        <aside
          id="ob-main-sidebar"
          className={`ob-sidebar ${
            mobileOpen
              ? 'ob-sidebar--mobile-open'
              : ''
          } ${
            desktopOpen
              ? ''
              : 'ob-sidebar--desktop-closed'
          }`}
          aria-label="Menu principal"
        >

          {/* ============================================
              EN-TÊTE
              ============================================ */}

          <div className="ob-sidebar-header">

            <NavLink
              to="/"
              className="ob-sidebar-brand"
              onClick={closeMobile}
            >

              <div className="ob-sidebar-logo">
                OB
              </div>

              <div className="ob-sidebar-brand-info">

                <strong>
                  {applicationName}
                </strong>

                <span>
                  {organizationName}
                </span>

              </div>

            </NavLink>

          </div>

          {/* ============================================
              NAVIGATION
              ============================================ */}

          <nav
            className="ob-sidebar-nav"
            aria-label="Rubriques Opération Brioches"
          >

            {/* ACCUEIL */}

            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `ob-sidebar-home ${
                  isActive
                    ? 'is-active'
                    : ''
                }`
              }
              onClick={closeMobile}
            >

              <House size={19} />

              <span>
                Accueil
              </span>

            </NavLink>

            <div className="ob-sidebar-separator" />

            {/* SECTIONS */}

            {sections.map(
              (section) => {
                const SectionIcon =
                  section.icon

                const expanded =
                  Boolean(
                    expandedSections[
                      section.id
                    ],
                  )

                const active =
                  activeSection ===
                  section.id

                /* ======================================
                   SECTION SANS PAGE
                   ====================================== */

                if (
                  section.items.length === 0
                ) {
                  return (

                    <div
                      key={section.id}
                      className="ob-sidebar-section"
                    >

                      <div
                        className="ob-sidebar-group ob-sidebar-group--disabled"
                        aria-disabled="true"
                      >

                        <SectionIcon size={19} />

                        <span className="ob-sidebar-group-label">
                          {section.label}
                        </span>

                        <span className="ob-sidebar-badge">
                          À venir
                        </span>

                      </div>

                    </div>

                  )
                }

                /* ======================================
                   SECTION AVEC SOUS-MENU
                   ====================================== */

                return (

                  <div
                    key={section.id}
                    className="ob-sidebar-section"
                  >

                    <button
                      type="button"
                      className={`ob-sidebar-group ${
                        active
                          ? 'is-current'
                          : ''
                      }`}
                      onClick={() =>
                        toggleSection(
                          section.id,
                        )
                      }
                      aria-expanded={
                        expanded
                      }
                      aria-controls={`ob-sidebar-panel-${section.id}`}
                    >

                      <SectionIcon size={19} />

                      <span className="ob-sidebar-group-label">
                        {section.label}
                      </span>

                      <ChevronDown
                        size={16}
                        className={`ob-sidebar-chevron ${
                          expanded
                            ? 'is-expanded'
                            : ''
                        }`}
                      />

                    </button>

                    {/* SOUS-MENU */}

                    <div
                      id={`ob-sidebar-panel-${section.id}`}
                      className="ob-sidebar-submenu"
                      hidden={!expanded}
                    >

                      {section.items.map(
                        (item) => {

                          /* ============================
                             RUBRIQUE À VENIR
                             ============================ */

                          if (!item.to) {
                            return (

                              <div
                                key={item.label}
                                className="ob-sidebar-link ob-sidebar-link--disabled"
                                aria-disabled="true"
                                title="Rubrique à développer"
                              >

                                <span className="ob-sidebar-dot" />

                                <span className="ob-sidebar-link-label">
                                  {item.label}
                                </span>

                                <span className="ob-sidebar-badge">
                                  À venir
                                </span>

                              </div>

                            )
                          }

                          /* ============================
                             LIEN EXISTANT
                             ============================ */

                          return (

                            <NavLink
                              key={item.label}
                              to={item.to}
                              end
                              className={({ isActive }) =>
                                `ob-sidebar-link ${
                                  isActive
                                    ? 'is-active'
                                    : ''
                                }`
                              }
                              onClick={closeMobile}
                            >

                              <span className="ob-sidebar-dot" />

                              <span className="ob-sidebar-link-label">
                                {item.label}
                              </span>

                              {item.badge && (

                                <span className="ob-sidebar-badge ob-sidebar-badge--special">

                                  {item.badge}

                                </span>

                              )}

                            </NavLink>

                          )
                        },
                      )}

                    </div>

                  </div>

                )
              },
            )}

          </nav>

          {/* ============================================
              PIED DE PAGE
              ============================================ */}

          <footer className="ob-sidebar-footer">

            <div className="ob-sidebar-footer-icon">
              <Settings size={18} />
            </div>

            <div>

              <strong>
                {applicationName}
              </strong>

              <span>
                Application en développement
              </span>

            </div>

          </footer>

        </aside>

      </div>

      {/* ================================================
          BURGER ORDINATEUR

          Toujours visible, même menu fermé.
          ================================================= */}

      <button
        type="button"
        className={`ob-sidebar-burger ob-sidebar-burger--desktop ${
          desktopOpen
            ? 'is-open'
            : 'is-closed'
        }`}
        onClick={toggleDesktop}
        aria-label={
          desktopOpen
            ? 'Fermer le menu latéral'
            : 'Ouvrir le menu latéral'
        }
        aria-controls="ob-main-sidebar"
        aria-expanded={desktopOpen}
        title={
          desktopOpen
            ? 'Masquer le menu'
            : 'Afficher le menu'
        }
      >

        {desktopOpen ? (
          <X size={21} />
        ) : (
          <Menu size={21} />
        )}

      </button>

      {/* ================================================
          BURGER MOBILE
          ================================================= */}

      <button
        type="button"
        className={`ob-sidebar-burger ob-sidebar-burger--mobile ${
          mobileOpen
            ? 'is-mobile-open'
            : ''
        }`}
        onClick={toggleMobile}
        aria-label={
          mobileOpen
            ? 'Fermer le menu'
            : 'Ouvrir le menu'
        }
        aria-controls="ob-main-sidebar"
        aria-expanded={mobileOpen}
      >

        {mobileOpen ? (
          <X size={21} />
        ) : (
          <Menu size={21} />
        )}

      </button>

      {/* ================================================
          FOND MOBILE
          ================================================= */}

      {mobileOpen && (

        <button
          type="button"
          className="ob-sidebar-overlay"
          aria-label="Fermer le menu"
          onClick={closeMobile}
        />

      )}

    </>
  )
}

export default Sidebar
import {
  useEffect,
  useRef,
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
  HandCoins,
  House,
  LayoutGrid,
  Mail,
  Map,
  Menu,
  Package,
  ShieldCheck,
  ShoppingCart,
  Wallet,
  X,
} from 'lucide-react'

import { useUsers } from '../contexts/UsersContext'

import {
  useGeneralSettings,
} from '../contexts/GeneralSettingsContext'


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
        to: '/gestion/suivi-caisse-tpe',
      },
      {
        label: 'BDD Donateurs',
        to: '/bdd/donateurs',
      },
      {
        label: 'BDD Mairies',
        to: '/bdd/mairies',
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
      },
      {
        label: 'Livraisons / Retraits',
        to: '/commandes/livraisons-retraits',
      },
      {
        label: 'Suivi global entreprises',
        to: '/commandes/suivi-global-entreprises',
      },
      {
        label: 'Commandes Mairies & RS',
        to: '/commandes/mairies-rs',
      },
    ],
  },
  {
    id: 'commandes-achats',
    label: 'Commandes achats',
    icon: Package,
    items: [
      {
        label: 'Artisans',
        to: '/commandes-achats/artisans',
      },
      {
        label: 'Fournisseurs',
        to: '/commandes-achats/fournisseurs',
      },
      {
        label: 'Suivi des livraisons',
        to: '/commandes-achats/artisans/planning',
      },
      {
        label: 'GMS',
        to: '/commandes-achats/gms',
      },
    ],
  },
  {
    id: 'etablissements',
    label: 'Établissements',
    icon: Building2,
    items: [
      { label: 'Stock Brioches', to: '/etablissements/stock-brioches' },
      { label: 'Suivi Brioches', to: '/etablissements/suivi-brioches' },
      { label: 'Récap global', to: '/etablissements/recap-global' },
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
        to: '/finance/justificatifs-dons',
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
    items: [
      {
        label: 'Carte des ventes',
        to: '/geographie/carte',
      },
      {
        label: 'Analyse par secteur',
        to: '/geographie/secteurs',
      },
      {
        label: 'Comparaison des canaux',
        to: '/geographie/comparaison',
      },
      {
        label: 'Secteurs et établissements',
        to: '/geographie/couverture',
      },
    ],
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
      { label: 'Liste des établissements', to: '/administration/etablissements' },
      {
        label: 'Utilisateurs',
        to: '/administration/utilisateurs',
      },
      {
        label: 'Rôles et permissions',
        to: '/administration/roles',
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

const PIN_STORAGE_KEY =
  'ob-sidebar-pinned-v1'

const FLOATING_OPEN_STORAGE_KEY =
  'ob-sidebar-floating-open-v1'

function loadPinned() {
  try {
    return (
      localStorage.getItem(
        PIN_STORAGE_KEY,
      ) !== 'false'
    )
  } catch {
    return true
  }
}

function loadFloatingOpen() {
  try {
    return (
      localStorage.getItem(
        FLOATING_OPEN_STORAGE_KEY,
      ) === 'true'
    )
  } catch {
    return false
  }
}

function getActiveSection(
  pathname: string,
): string | null {
  for (const section of sections) {
    const active =
      section.items.some((item) => {
        if (!item.to) {
          return false
        }

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
      })

    if (active) {
      return section.id
    }
  }

  return null
}

export default function Sidebar() {
  const location = useLocation()
  const { currentUser } = useUsers()
  const { settings } =
    useGeneralSettings()

  const [
    pinned,
    setPinned,
  ] = useState(loadPinned)

  const [
    floatingOpen,
    setFloatingOpen,
  ] = useState(loadFloatingOpen)

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false)

  const [
    expandedSections,
    setExpandedSections,
  ] = useState<Record<string, boolean>>({
    gestion: true,
  })

  const floatingCloseTimer =
    useRef<number | null>(null)

  const navRef =
    useRef<HTMLElement | null>(null)

  function cancelFloatingClose() {
    if (floatingCloseTimer.current !== null) {
      window.clearTimeout(
        floatingCloseTimer.current,
      )

      floatingCloseTimer.current = null
    }
  }

  function openFloatingSidebar() {
    if (pinned) {
      return
    }

    cancelFloatingClose()
    setFloatingOpen(true)
  }

  function scheduleFloatingClose() {
    if (pinned) {
      return
    }

    cancelFloatingClose()

    floatingCloseTimer.current =
      window.setTimeout(() => {
        setFloatingOpen(false)
        floatingCloseTimer.current = null
      }, 240)
  }

  const applicationName =
    settings.applicationName.trim() ||
    'Opération Brioches'

  const organizationName =
    settings.organizationName.trim() ||
    'AEIM'

  const activeSection =
    getActiveSection(
      location.pathname,
    )

  const desktopOpen =
    pinned || floatingOpen

  useEffect(() => {
    try {
      localStorage.setItem(
        PIN_STORAGE_KEY,
        String(pinned),
      )

      localStorage.setItem(
        FLOATING_OPEN_STORAGE_KEY,
        String(floatingOpen),
      )
    } catch {
      // Le menu reste fonctionnel.
    }

    document.documentElement.style.setProperty(
      '--ob-sidebar-reserved',
      pinned
        ? 'var(--ob-sidebar-width)'
        : '0px',
    )

    document.documentElement.dataset.sidebarPinned =
      pinned ? 'true' : 'false'

    return () => {
      document.documentElement.style.removeProperty(
        '--ob-sidebar-reserved',
      )

      delete document.documentElement.dataset.sidebarPinned
    }
  }, [
    pinned,
    floatingOpen,
  ])

  useEffect(() => {
    if (activeSection) {
      setExpandedSections(
        (current) => ({
          ...current,
          [activeSection]: true,
        }),
      )
    }

    setMobileOpen(false)

    /*
      En mode flottant, la navigation se referme
      automatiquement après avoir choisi une page.
    */
    if (!pinned) {
      setFloatingOpen(false)
    }
  }, [
    activeSection,
    location.pathname,
    pinned,
  ])

  useEffect(() => {
    if (
      !mobileOpen &&
      !floatingOpen
    ) {
      return
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setMobileOpen(false)

        if (!pinned) {
          setFloatingOpen(false)
        }
      }
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        handleEscape,
      )
  }, [
    mobileOpen,
    floatingOpen,
    pinned,
  ])

  useEffect(() => {
    return () => {
      cancelFloatingClose()
    }
  }, [])

  useEffect(() => {
    const nav = navRef.current

    if (!nav) {
      return
    }

    const frame =
      window.requestAnimationFrame(() => {
        if (
          location.pathname === '/'
        ) {
          nav.scrollTo({
            top: 0,
            behavior: 'smooth',
          })

          return
        }

        const active =
          nav.querySelector<HTMLElement>(
            '.ob-sidebar-link.is-active, .ob-sidebar-home.is-active',
          )

        active?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      })

    return () =>
      window.cancelAnimationFrame(
        frame,
      )
  }, [
    location.pathname,
    floatingOpen,
    pinned,
  ])

  function pinSidebarFromBurger() {
    cancelFloatingClose()
    setFloatingOpen(false)
    setPinned(true)
  }

  function closeSidebar() {
    cancelFloatingClose()
    setMobileOpen(false)
    setFloatingOpen(false)
    setPinned(false)
  }

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

  const sidebarClasses = [
    'ob-sidebar',
    !pinned
      ? 'ob-sidebar--floating'
      : '',
    !desktopOpen
      ? 'is-closed'
      : '',
    mobileOpen
      ? 'ob-sidebar--mobile-open'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={[
          'ob-sidebar-shell',
          pinned
            ? 'ob-sidebar-shell--pinned'
            : 'ob-sidebar-shell--floating',
        ].join(' ')}
      >
        <aside
          id="ob-main-sidebar"
          className={sidebarClasses}
          aria-label="Menu principal"
          onMouseEnter={
            openFloatingSidebar
          }
          onMouseLeave={
            scheduleFloatingClose
          }
        >
          <div className="ob-sidebar-header">
            <NavLink
              to="/"
              className="ob-sidebar-brand"
              onClick={() => {
                setMobileOpen(false)

                if (!pinned) {
                  setFloatingOpen(false)
                }
              }}
            >
              <div
                className="ob-sidebar-logo"
                aria-hidden="true"
              >
                <img
                  src="/brioche-favicon.svg"
                  alt=""
                />
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

            <button
              type="button"
              className="ob-sidebar-close"
              onClick={closeSidebar}
              title="Fermer la navigation"
              aria-label="Fermer la navigation"
            >
              <X size={18} />
            </button>
          </div>

          <nav
            ref={navRef}
            className="ob-sidebar-nav"
            aria-label="Rubriques Opération Brioches"
          >
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
              onClick={() => {
                setMobileOpen(false)

                if (!pinned) {
                  setFloatingOpen(false)
                }
              }}
            >
              <House size={20} />
              <span>Accueil</span>
            </NavLink>

            <div className="ob-sidebar-separator" />

            {sections.map(
              (section) => {
                const Icon =
                  section.icon

                const expanded =
                  Boolean(
                    expandedSections[
                      section.id
                    ],
                  )

                const current =
                  activeSection ===
                  section.id

                return (
                  <div
                    key={section.id}
                    className="ob-sidebar-section"
                  >
                    <button
                      type="button"
                      className={`ob-sidebar-group ${
                        current
                          ? 'is-current'
                          : ''
                      }`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleSection(
                          section.id,
                        )
                      }}
                      aria-expanded={
                        expanded
                      }
                      aria-controls={`ob-sidebar-section-${section.id}`}
                    >
                      <Icon size={20} />

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

                    {expanded && (
                      <div
                        id={`ob-sidebar-section-${section.id}`}
                        className="ob-sidebar-submenu"
                      >
                        {section.items.filter(item => item.to !== '/etablissements/recap-global' || ['administrateur','comptabilite','communication'].includes(currentUser?.role ?? '')).map(
                          (item) =>
                            item.to ? (
                              <NavLink
                                key={
                                  item.label
                                }
                                to={item.to}
                                end
                                className={({
                                  isActive,
                                }) =>
                                  `ob-sidebar-link ${
                                    isActive
                                      ? 'is-active'
                                      : ''
                                  }`
                                }
                                onClick={() => {
                                  setMobileOpen(
                                    false,
                                  )

                                  if (!pinned) {
                                    setFloatingOpen(
                                      false,
                                    )
                                  }
                                }}
                              >
                                <span className="ob-sidebar-dot" />

                                <span className="ob-sidebar-link-label">
                                  {item.label}
                                </span>

                                {item.badge && (
                                  <span className="ob-sidebar-badge ob-sidebar-badge--special">
                                    {
                                      item.badge
                                    }
                                  </span>
                                )}
                              </NavLink>
                            ) : (
                              <div
                                key={
                                  item.label
                                }
                                className="ob-sidebar-link ob-sidebar-link--disabled"
                              >
                                <span className="ob-sidebar-dot" />

                                <span className="ob-sidebar-link-label">
                                  {item.label}
                                </span>

                                <span className="ob-sidebar-badge">
                                  À venir
                                </span>
                              </div>
                            ),
                        )}
                      </div>
                    )}
                  </div>
                )
              },
            )}
          </nav>

          <div
            className="ob-sidebar-community"
            aria-hidden="true"
          >
            <img
              src="/ob/ob-sidebar-community.png"
              alt=""
            />
          </div>
        </aside>
      </div>

      {!pinned && !floatingOpen && (
        <div
          className="ob-sidebar-edge-trigger"
          onMouseEnter={
            openFloatingSidebar
          }
          aria-hidden="true"
        />
      )}

      {!pinned && !floatingOpen && (
        <button
          type="button"
          className={`ob-sidebar-burger ob-sidebar-burger--desktop ${
            floatingOpen
              ? 'with-panel'
              : ''
          }`}
          onClick={
            pinSidebarFromBurger
          }
          aria-label="Ouvrir et épingler le menu latéral"
          aria-expanded={false}
          aria-controls="ob-main-sidebar"
          title="Ouvrir et épingler le menu"
        >
          <Menu size={21} />
        </button>
      )}

      <button
        type="button"
        className="ob-sidebar-burger ob-sidebar-burger--mobile"
        onClick={() =>
          setMobileOpen(
            (current) => !current,
          )
        }
        aria-label={
          mobileOpen
            ? 'Fermer le menu'
            : 'Ouvrir le menu'
        }
        aria-expanded={mobileOpen}
        aria-controls="ob-main-sidebar"
      >
        {mobileOpen ? (
          <X size={21} />
        ) : (
          <Menu size={21} />
        )}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="ob-sidebar-overlay"
          aria-label="Fermer le menu"
          onClick={() => {
            setMobileOpen(false)

            if (!pinned) {
              setFloatingOpen(false)
            }
          }}
        />
      )}
    </>
  )
}

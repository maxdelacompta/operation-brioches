import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  Activity,
  AlertTriangle,
  Euro,
  FileText,
  Plus,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  X,
  Zap,
} from 'lucide-react'

import './Accueil.css'

type WidgetId =
  | 'commandes'
  | 'encaissements'
  | 'livraisons'
  | 'alertes'
  | 'activite'
  | 'raccourcis'
  | 'avancement'
  | 'documents'

type WidgetSize =
  | 'small'
  | 'large'

type WidgetDefinition = {
  id: WidgetId
  label: string
  description: string
  size: WidgetSize
}

const STORAGE_KEY =
  'operation-brioches-accueil-widgets'

const DEFAULT_WIDGETS: WidgetId[] = [
  'commandes',
  'encaissements',
  'livraisons',
  'alertes',
  'activite',
  'raccourcis',
  'avancement',
  'documents',
]

const WIDGETS: WidgetDefinition[] = [
  {
    id: 'commandes',
    label: 'Commandes',
    description: 'Commandes à traiter',
    size: 'small',
  },
  {
    id: 'encaissements',
    label: 'Encaissements',
    description: 'Encaissements à contrôler',
    size: 'small',
  },
  {
    id: 'livraisons',
    label: 'Livraisons',
    description: 'Planning du jour',
    size: 'small',
  },
  {
    id: 'alertes',
    label: 'Alertes',
    description: 'Éléments à surveiller',
    size: 'small',
  },
  {
    id: 'activite',
    label: 'Activité récente',
    description: 'Dernières actions',
    size: 'large',
  },
  {
    id: 'raccourcis',
    label: 'Mes raccourcis',
    description: 'Actions rapides',
    size: 'large',
  },
  {
    id: 'avancement',
    label: 'Avancement global',
    description: 'Suivi de l’opération',
    size: 'large',
  },
  {
    id: 'documents',
    label: 'Documents récents',
    description: 'Derniers fichiers ajoutés',
    size: 'large',
  },
]

function Accueil() {
  const [
    customizing,
    setCustomizing,
  ] = useState(false)

  const [
    visibleWidgets,
    setVisibleWidgets,
  ] = useState<WidgetId[]>(
    () => {
      try {
        const saved =
          localStorage.getItem(
            STORAGE_KEY,
          )

        if (!saved) {
          return DEFAULT_WIDGETS
        }

        const parsed =
          JSON.parse(saved)

        if (!Array.isArray(parsed)) {
          return DEFAULT_WIDGETS
        }

        const validWidgets =
          parsed.filter(
            (
              widget,
            ): widget is WidgetId =>
              DEFAULT_WIDGETS.includes(
                widget,
              ),
          )

        return validWidgets
      } catch {
        return DEFAULT_WIDGETS
      }
    },
  )

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        visibleWidgets,
      ),
    )
  }, [visibleWidgets])

  const hiddenWidgets =
    useMemo(
      () =>
        WIDGETS.filter(
          (widget) =>
            !visibleWidgets.includes(
              widget.id,
            ),
        ),
      [visibleWidgets],
    )

  function removeWidget(
    widgetId: WidgetId,
  ) {
    setVisibleWidgets(
      (current) =>
        current.filter(
          (widget) =>
            widget !== widgetId,
        ),
    )
  }

  function addWidget(
    widgetId: WidgetId,
  ) {
    setVisibleWidgets(
      (current) => {
        if (
          current.includes(
            widgetId,
          )
        ) {
          return current
        }

        return [
          ...current,
          widgetId,
        ]
      },
    )
  }

  function resetWidgets() {
    setVisibleWidgets(
      DEFAULT_WIDGETS,
    )
  }

  return (
    <div className="accueil-page">
      <header className="accueil-header">
        <div>
          <span className="accueil-eyebrow">
            Accueil
          </span>

          <h1>
            Bonjour Maxime 👋
          </h1>

          <p>
            Voici ce qui
            nécessite votre
            attention aujourd'hui.
          </p>
        </div>

        <button
          type="button"
          className={
            customizing
              ? 'accueil-customize-button active'
              : 'accueil-customize-button'
          }
          onClick={() =>
            setCustomizing(
              (value) => !value,
            )
          }
        >
          <SlidersHorizontal
            size={18}
          />

          {customizing
            ? 'Terminer'
            : 'Personnaliser'}
        </button>
      </header>

      <div className="accueil-widgets">
        {visibleWidgets.map(
          (widgetId) => (
            <WidgetRenderer
              key={widgetId}
              widgetId={widgetId}
              customizing={
                customizing
              }
              onRemove={() =>
                removeWidget(
                  widgetId,
                )
              }
            />
          ),
        )}
      </div>

      {customizing && (
        <WidgetLibrary
          hiddenWidgets={
            hiddenWidgets
          }
          onAdd={addWidget}
          onReset={resetWidgets}
          onClose={() =>
            setCustomizing(false)
          }
        />
      )}
    </div>
  )
}

function WidgetRenderer({
  widgetId,
  customizing,
  onRemove,
}: {
  widgetId: WidgetId
  customizing: boolean
  onRemove: () => void
}) {
  const definition =
    WIDGETS.find(
      (widget) =>
        widget.id === widgetId,
    )

  if (!definition) {
    return null
  }

  switch (widgetId) {
    case 'commandes':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <ShoppingCart
                size={21}
              />
            }
            title="Commandes à traiter"
            subtitle="Commandes en attente"
          />

          <div className="accueil-widget-value">
            7
          </div>

          <div className="accueil-widget-label">
            2 nouvelles depuis
            hier
          </div>

          <button
            type="button"
            className="accueil-widget-link"
          >
            Voir les commandes
          </button>
        </Widget>
      )

    case 'encaissements':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <Euro size={21} />
            }
            title="Encaissements"
            subtitle="En attente de vérification"
          />

          <div className="accueil-widget-value">
            4
          </div>

          <div className="accueil-widget-label">
            À contrôler
          </div>

          <button
            type="button"
            className="accueil-widget-link"
          >
            Voir les
            encaissements
          </button>
        </Widget>
      )

    case 'livraisons':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <Truck size={21} />
            }
            title="Livraisons aujourd'hui"
            subtitle="Planning du jour"
          />

          <div className="accueil-widget-value">
            3
          </div>

          <div className="accueil-widget-label">
            Livraisons prévues
          </div>

          <button
            type="button"
            className="accueil-widget-link"
          >
            Voir le planning
          </button>
        </Widget>
      )

    case 'alertes':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <AlertTriangle
                size={21}
              />
            }
            title="Alertes"
            subtitle="Éléments à surveiller"
          />

          <div className="accueil-widget-value">
            2
          </div>

          <div className="accueil-widget-label">
            Nécessitent votre
            attention
          </div>
        </Widget>
      )

    case 'activite':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <Activity
                size={21}
              />
            }
            title="Activité récente"
            subtitle="Dernières actions enregistrées"
          />

          <div className="accueil-activity-list">
            <ActivityRow
              time="10:24"
              text="Commande OB-2026-0124 créée"
            />

            <ActivityRow
              time="09:15"
              text="Paiement enregistré"
            />

            <ActivityRow
              time="Hier"
              text="Nouvelle structure ajoutée"
            />

            <ActivityRow
              time="Hier"
              text="Document ajouté à une commande"
            />
          </div>
        </Widget>
      )

    case 'raccourcis':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <Zap size={21} />
            }
            title="Mes raccourcis"
            subtitle="Accès rapides"
          />

          <div className="accueil-shortcuts">
            <button
              type="button"
              className="accueil-shortcut"
            >
              <ShoppingCart
                size={17}
              />
              Nouvelle commande
            </button>

            <button
              type="button"
              className="accueil-shortcut"
            >
              <Euro size={17} />
              Nouvel
              encaissement
            </button>

            <button
              type="button"
              className="accueil-shortcut"
            >
              <Plus size={17} />
              Ajouter une structure
            </button>

            <button
              type="button"
              className="accueil-shortcut"
            >
              <FileText
                size={17}
              />
              Consulter les
              factures
            </button>
          </div>
        </Widget>
      )

    case 'avancement':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <TrendingUp
                size={21}
              />
            }
            title="Avancement global"
            subtitle="Opération Brioches 2026"
          />

          <div className="accueil-progress-top">
            <div>
              <div className="accueil-progress-value">
                68 %
              </div>

              <div className="accueil-widget-label">
                Objectif annuel
              </div>
            </div>

            <div className="accueil-progress-status">
              En bonne progression
            </div>
          </div>

          <div className="accueil-progress-track">
            <div
              className="accueil-progress-bar"
              style={{
                width: '68%',
              }}
            />
          </div>

          <div className="accueil-progress-footer">
            <span>0 %</span>
            <span>Objectif</span>
            <span>100 %</span>
          </div>
        </Widget>
      )

    case 'documents':
      return (
        <Widget
          size={definition.size}
          customizing={
            customizing
          }
          onRemove={onRemove}
        >
          <WidgetHeader
            icon={
              <FileText size={21} />
            }
            title="Documents récents"
            subtitle="Derniers fichiers ajoutés"
          />

          <div className="accueil-documents">
            <DocumentRow
              title="Facture fournisseur"
              subtitle="Ajoutée aujourd'hui"
            />

            <DocumentRow
              title="Justificatif de don"
              subtitle="Ajouté hier"
            />

            <DocumentRow
              title="Attestation de réception"
              subtitle="Ajoutée hier"
            />
          </div>
        </Widget>
      )
  }
}

function Widget({
  children,
  size,
  customizing,
  onRemove,
}: {
  children: ReactNode
  size: WidgetSize
  customizing: boolean
  onRemove: () => void
}) {
  return (
    <section
      className={[
        'accueil-widget',
        size,
        customizing
          ? 'customizing'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {customizing && (
        <button
          type="button"
          className="accueil-widget-remove"
          onClick={onRemove}
          title="Retirer ce widget"
        >
          <X size={14} />
        </button>
      )}

      {children}
    </section>
  )
}

function WidgetHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="accueil-widget-header">
      <div className="accueil-widget-icon">
        {icon}
      </div>

      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function ActivityRow({
  time,
  text,
}: {
  time: string
  text: string
}) {
  return (
    <div className="accueil-activity-item">
      <span>{time}</span>
      <strong>{text}</strong>
    </div>
  )
}

function DocumentRow({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="accueil-document">
      <FileText size={17} />

      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  )
}

function WidgetLibrary({
  hiddenWidgets,
  onAdd,
  onReset,
  onClose,
}: {
  hiddenWidgets: WidgetDefinition[]
  onAdd: (
    widget: WidgetId,
  ) => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <div className="accueil-library-overlay">
      <div className="accueil-library">
        <div className="accueil-library-header">
          <div>
            <h2>
              Personnaliser mon
              accueil
            </h2>

            <p>
              Les cartes rouges
              sont actuellement
              affichées. Retirez-les
              avec × ou ajoutez un
              widget ci-dessous.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              type="button"
              className="accueil-library-close"
              onClick={onReset}
              title="Réinitialiser"
            >
              <RotateCcw
                size={17}
              />
            </button>

            <button
              type="button"
              className="accueil-library-close"
              onClick={onClose}
              title="Terminer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {hiddenWidgets.length ===
        0 ? (
          <div className="accueil-library-empty">
            Tous les widgets sont
            affichés.
            <br />
            Cliquez sur le × rouge
            d'une carte pour la
            retirer.
          </div>
        ) : (
          <div className="accueil-library-grid">
            {hiddenWidgets.map(
              (widget) => (
                <button
                  type="button"
                  key={widget.id}
                  className="accueil-library-item"
                  onClick={() =>
                    onAdd(
                      widget.id,
                    )
                  }
                >
                  <Plus size={20} />

                  <strong>
                    {widget.label}
                  </strong>

                  <span>
                    {widget.description}
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Accueil
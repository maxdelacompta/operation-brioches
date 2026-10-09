import {
  Building2,
  CircleDollarSign,
  MapPin,
  RefreshCw,
  Store,
  TrendingUp,
  UsersRound,
} from 'lucide-react'

import {
  ActionButton,
  FilterBar,
  PageHeader,
  SearchField,
  SectionCard,
  SegmentedTabs,
  StatCard,
  StatusBadge,
} from '../components/ui'

import { useState } from 'react'

type DemoTab =
  | 'HEATMAP'
  | 'POINTS'
  | 'SECTEURS'
  | 'COMPARAISON'

export default function ThemeShowcase() {
  const [search, setSearch] =
    useState('')

  const [tab, setTab] =
    useState<DemoTab>(
      'HEATMAP',
    )

  return (
    <main className="ob-page ob-page-stack">
      <PageHeader
        eyebrow="Analyse territoriale"
        title="Géographie — Carte des ventes"
        description="Exemple du nouveau langage visuel de l’Opération Brioches."
        actions={
          <>
            <select className="ob-select">
              <option>OB 2026</option>
            </select>

            <ActionButton
              icon={
                <RefreshCw
                  size={16}
                />
              }
            >
              Réinitialiser
            </ActionButton>
          </>
        }
      />

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: 'HEATMAP',
            label: 'Heatmap',
          },
          {
            value: 'POINTS',
            label: 'Points de vente',
          },
          {
            value: 'SECTEURS',
            label: 'Secteurs',
          },
          {
            value: 'COMPARAISON',
            label: 'Comparaison',
          },
        ]}
      />

      <section className="ob-kpi-grid">
        <StatCard
          icon={
            <UsersRound
              size={21}
            />
          }
          tone="green"
          label="Points actifs"
          value="108"
          subtitle="67 localisés sur la carte"
          trend="+12 %"
        />

        <StatCard
          icon={
            <Store size={21} />
          }
          tone="blue"
          label="Brioches vendues"
          value="9 696"
          subtitle="2 points comportent une estimation"
          trend="+18 %"
        />

        <StatCard
          icon={
            <TrendingUp
              size={21}
            />
          }
          tone="orange"
          label="Taux d'écoulement"
          value="61 %"
          subtitle="vendu / confié"
          trend="+6 pts"
        />

        <StatCard
          icon={
            <CircleDollarSign
              size={21}
            />
          }
          tone="pink"
          label="Dons reçus"
          value="46 135 €"
          subtitle="sur la sélection actuelle"
          trend="+14 %"
        />
      </section>

      <FilterBar>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une commune, un point de vente..."
        />

        <select className="ob-select">
          <option>Tous les secteurs</option>
        </select>

        <ActionButton
          variant="primary"
          icon={<MapPin size={16} />}
        >
          Nouvelle analyse
        </ActionButton>
      </FilterBar>

      <div className="ob-content-with-panel">
        <SectionCard
          title="Exemple de contenu principal"
          padded
        >
          <div
            style={{
              minHeight: 380,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 14,
              background:
                'linear-gradient(135deg,#eef6e8,#fff4e8)',
              color: '#7a8ca1',
            }}
          >
            Zone carte / graphique / tableau
          </div>
        </SectionCard>

        <aside className="ob-panel">
          <div className="ob-panel__header">
            <h2>
              Analyse du territoire
            </h2>
          </div>

          <div className="ob-panel__body ob-page-stack">
            <StatusBadge tone="info">
              Meurthe-et-Moselle (54)
            </StatusBadge>

            <div className="ob-page-grid ob-page-grid--2">
              <StatCard
                icon={
                  <Store
                    size={18}
                  />
                }
                tone="orange"
                label="Ventes"
                value="9 696"
              />

              <StatCard
                icon={
                  <Building2
                    size={18}
                  />
                }
                tone="green"
                label="Structures"
                value="67"
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

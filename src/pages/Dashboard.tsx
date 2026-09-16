import {
  AlertTriangle,
  Bell,
  Building2,
  FileText,
  Gift,
  Handshake,
  Map,
  Package,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import './Dashboard.css'

const incomeData = [
  { month: 'Jan', value: 2000 },
  { month: 'Fév', value: 5500 },
  { month: 'Mar', value: 7500 },
  { month: 'Avr', value: 8000 },
  { month: 'Mai', value: 11200 },
  { month: 'Juin', value: 10800 },
  { month: 'Juil', value: 13000 },
  { month: 'Août', value: 18000 },
  { month: 'Sep', value: 19500 },
  { month: 'Oct', value: 20000 },
  { month: 'Nov', value: 23500 },
  { month: 'Déc', value: 27151 },
]

const paymentData = [
  { name: 'Espèces', value: 25, color: '#18b968' },
  { name: 'Chèques', value: 37, color: '#ff6b35' },
  { name: 'TPE', value: 9, color: '#f6b324' },
  { name: 'Virements', value: 5, color: '#25a8e0' },
  { name: 'Dons', value: 24, color: '#6f49e8' },
]

const distributionData = [
  { name: 'Établissements', value: 37, color: '#174f86' },
  { name: 'Entreprises', value: 25, color: '#ff6b35' },
  { name: 'Mairies', value: 9, color: '#f6b324' },
  { name: 'Stands', value: 5, color: '#18b968' },
  { name: 'Autres', value: 24, color: '#6f49e8' },
]

const expenseData = [
  { name: 'Brioches artisanales', value: 46, color: '#174f86' },
  { name: 'Brioches industrielles', value: 20, color: '#ff6b35' },
  { name: 'Outils de communication', value: 14, color: '#f6b324' },
  { name: 'Frais de déplacement', value: 9, color: '#4d88d8' },
  { name: 'Frais bancaires', value: 6, color: '#70b6d8' },
  { name: 'Salaires', value: 5, color: '#7caf2a' },
]

type KpiCardProps = {
  icon: React.ReactNode
  title: string
  value: string
  evolution?: string
  subtitle?: string
  tone?: string
}

function KpiCard({
  icon,
  title,
  value,
  evolution,
  subtitle,
  tone = 'orange',
}: KpiCardProps) {
  return (
    <article className="dashboard-kpi">
      <div className={`dashboard-kpi-icon ${tone}`}>
        {icon}
      </div>

      <div>
        <span className="dashboard-kpi-title">{title}</span>

        <strong>{value}</strong>

        <div className="dashboard-kpi-footer">
          {evolution && (
            <span className="dashboard-kpi-evolution">
              <TrendingUp size={14} />
              {evolution}
            </span>
          )}

          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>
    </article>
  )
}

function Dashboard() {
  return (
    <div className="dashboard-page">

      {/* HEADER */}

      <header className="dashboard-topbar">
        <div>
          <span className="dashboard-eyebrow">
            TABLEAU DE BORD
          </span>

          <h1>Opération Brioches 2026</h1>

          <p>
            Suivi global de l'opération en temps réel
          </p>
        </div>
      </header>

      {/* FILTRES */}

      <section className="dashboard-filters">
        <label>
          Département
          <select defaultValue="54">
            <option value="54">Meurthe-et-Moselle</option>
            <option value="55">Meuse</option>
            <option value="57">Moselle</option>
            <option value="88">Vosges</option>
          </select>
        </label>

        <label>
          Secteur
          <select defaultValue="all">
            <option value="all">Tous les secteurs</option>
          </select>
        </label>

        <label>
          Sous-secteur
          <select defaultValue="all">
            <option value="all">Tous</option>
          </select>
        </label>

        <label>
          Année
          <select defaultValue="2026">
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </label>
      </section>

      {/* KPI PRINCIPAUX */}

      <section className="dashboard-kpi-grid">

        <KpiCard
          icon={<Package />}
          title="Total de brioches achetées"
          value="46 919"
          evolution="+12 %"
          subtitle="vs 2025"
          tone="orange"
        />

        <KpiCard
          icon={<Wallet />}
          title="Montant total reçu"
          value="224 919,14 €"
          evolution="+8 %"
          subtitle="vs 2025"
          tone="green"
        />

        <KpiCard
          icon={<TrendingUp />}
          title="Résultat de l'OB"
          value="124 608,70 €"
          evolution="+14 %"
          tone="blue"
        />

        <KpiCard
          icon={<Target />}
          title="Avancement de l'OB"
          value="100 %"
          subtitle="Objectif atteint"
          tone="green"
        />

        <KpiCard
          icon={<Handshake />}
          title="Mécénat / Sponsoring"
          value="25 177,79 €"
          subtitle="14 mécènes / sponsors"
          tone="green"
        />

        <KpiCard
          icon={<Gift />}
          title="Dons avec contrepartie"
          value="221 861,00 €"
          evolution="+9 %"
          subtitle="vs 2025"
          tone="red"
        />

        <KpiCard
          icon={<Gift />}
          title="Dons sans contrepartie"
          value="3 058,14 €"
          evolution="+5 %"
          subtitle="vs 2025"
          tone="red"
        />

        <KpiCard
          icon={<Wallet />}
          title="Dépenses totales"
          value="125 488,18 €"
          subtitle="vs 2025"
          tone="orange"
        />

      </section>

      {/* LIGNE ANALYTIQUE */}

      <section className="dashboard-analysis-grid">

        {/* CARTE */}

        <article className="dashboard-box dashboard-map">
          <div className="dashboard-box-title">
            <Map size={20} />
            <h2>Répartition géographique</h2>
          </div>

          <div className="map-placeholder">
            <Map size={70} />

            <strong>Carte interactive</strong>

            <span>
              Département → secteur → commune
            </span>
          </div>

          <div className="map-summary">
            <strong>Meurthe-et-Moselle</strong>
            <span>46 919 brioches</span>
            <span>224 919,14 € reçus</span>
            <span>1 248 commandes</span>
            <span>342 structures</span>
          </div>
        </article>

        {/* EVOLUTION */}

        <article className="dashboard-box dashboard-income">
          <div className="dashboard-box-title">
            <TrendingUp size={20} />
            <h2>Évolution des encaissements</h2>
          </div>

          <div className="dashboard-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incomeData}>

                <defs>
                  <linearGradient
                    id="incomeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#FFA74F"
                      stopOpacity={0.35}
                    />

                    <stop
                      offset="100%"
                      stopColor="#FFA74F"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="#e7edf4"
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#ff8a1f"
                  strokeWidth={3}
                  fill="url(#incomeGradient)"
                />

              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* PAIEMENTS */}

        <article className="dashboard-box">
          <div className="dashboard-box-title">
            <Wallet size={20} />
            <h2>Répartition des paiements</h2>
          </div>

          <div className="dashboard-pie-content">

            <div className="dashboard-pie-chart">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="value"
                    innerRadius={52}
                    outerRadius={78}
                    stroke="none"
                  >
                    {paymentData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={item.color}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="dashboard-pie-center">
                <strong>224 919 €</strong>
                <span>reçus</span>
              </div>
            </div>

            <div className="dashboard-legend">
              {paymentData.map((item) => (
                <div key={item.name}>
                  <span
                    className="legend-dot"
                    style={{ background: item.color }}
                  />
                  <span>{item.name}</span>
                  <strong>{item.value} %</strong>
                </div>
              ))}
            </div>

          </div>
        </article>

      </section>

      {/* DISTRIBUTION / DEPENSES / INDICATEURS */}

      <section className="dashboard-secondary-grid">

        <article className="dashboard-box">
          <div className="dashboard-box-title">
            <Users size={20} />
            <h2>Répartition des distributions</h2>
          </div>

          <div className="dashboard-pie-content">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  outerRadius={75}
                  stroke="white"
                >
                  {distributionData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="dashboard-legend">
              {distributionData.map((item) => (
                <div key={item.name}>
                  <span
                    className="legend-dot"
                    style={{ background: item.color }}
                  />
                  <span>{item.name}</span>
                  <strong>{item.value} %</strong>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="dashboard-box">
          <div className="dashboard-box-title">
            <Wallet size={20} />
            <h2>Dépenses par poste</h2>
          </div>

          <div className="dashboard-pie-content">

            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={expenseData}
                  dataKey="value"
                  outerRadius={75}
                  stroke="white"
                >
                  {expenseData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="dashboard-legend">
              {expenseData.map((item) => (
                <div key={item.name}>
                  <span
                    className="legend-dot"
                    style={{ background: item.color }}
                  />

                  <span>{item.name}</span>

                  <strong>{item.value} %</strong>
                </div>
              ))}
            </div>

          </div>
        </article>

        <article className="dashboard-box">
          <div className="dashboard-box-title">
            <Target size={20} />
            <h2>Indicateurs complémentaires</h2>
          </div>

          <div className="dashboard-small-kpis">

            <div>
              <ShoppingCart size={24} />
              <span>Commandes</span>
              <strong>1 248</strong>
              <small>+8 %</small>
            </div>

            <div>
              <Building2 size={24} />
              <span>Structures actives</span>
              <strong>342</strong>
              <small>+6 %</small>
            </div>

            <div>
              <AlertTriangle size={24} />
              <span>Pertes / Invendus</span>
              <strong>0 %</strong>
              <small>0 brioche</small>
            </div>

            <div>
              <AlertTriangle size={24} />
              <span>JDI non réglées</span>
              <strong>2 %</strong>
              <small>À traiter</small>
            </div>

          </div>
        </article>

      </section>

      {/* BAS DE PAGE */}

      <section className="dashboard-bottom-grid">

        <article className="dashboard-box">
          <div className="dashboard-box-title">
            <TrendingUp size={20} />
            <h2>Activité récente</h2>
          </div>

          <div className="activity-list">

            <div>
              <span className="status-dot green" />
              <strong>Commande ART-2026-0124 créée</strong>
              <span>Boulangerie du Centre — Nancy</span>
              <small>Il y a 2 heures</small>
            </div>

            <div>
              <span className="status-dot orange" />
              <strong>Paiement enregistré</strong>
              <span>Entreprise ABC — 1 250 €</span>
              <small>Il y a 4 heures</small>
            </div>

            <div>
              <span className="status-dot blue" />
              <strong>Nouvel établissement ajouté</strong>
              <span>IME Les Tilleuls — Lunéville</span>
              <small>Hier à 14:32</small>
            </div>

            <div>
              <span className="status-dot green" />
              <strong>Facture reçue</strong>
              <span>ART-2026-0087</span>
              <small>Hier à 11:15</small>
            </div>

          </div>
        </article>

        <article className="dashboard-box">
          <div className="dashboard-box-title alert-title">
            <AlertTriangle size={20} />
            <h2>Alertes et tâches à traiter</h2>
          </div>

          <div className="alert-list">

            <div>
              <strong>3 factures non reçues</strong>
              <span>Certaines commandes sont en attente</span>
            </div>

            <div>
              <strong>2 commandes sans date de retrait</strong>
              <span>Dates à planifier</span>
            </div>

            <div>
              <strong>1 écart d'encaissement</strong>
              <span>Montant reçu inférieur au prévu</span>
            </div>

            <div>
              <strong>4 commandes à confirmer</strong>
              <span>Validation fournisseur en attente</span>
            </div>

          </div>
        </article>

        <article className="dashboard-box">
          <div className="dashboard-box-title">
            <FileText size={20} />
            <h2>Documents rapides</h2>
          </div>

          <div className="documents-list">
            <button>Exporter le tableau de bord</button>
            <button>Exporter les données Excel</button>
            <button>Liste des commandes</button>
            <button>Liste des encaissements</button>
            <button>Bilan de l'opération</button>
          </div>
        </article>

      </section>

    </div>
  )
}

export default Dashboard
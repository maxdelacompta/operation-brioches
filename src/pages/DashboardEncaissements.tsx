import { useMemo, useState } from 'react'
import { Bar, ComposedChart, Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Download, TrendingUp, Wallet } from 'lucide-react'
import type { FicheCaisse } from '../types/ob'
import {
  exportEncaissementsCsv,
  groupEncaissements,
  isIsoDay,
  summarizeEncaissements,
  type PeriodGranularity,
} from '../lib/dashboardEncaissements'

type ViewMode = 'repartition' | 'evolution'
const currency = (amount: number) => amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const shortMoney = (amount: number) => amount >= 1000 ? `${Math.round(amount / 1000)} k€` : `${Math.round(amount)} €`
const colored = [
  { key: 'especes', label: 'Espèces', color: '#19b76e' },
  { key: 'cheques', label: 'Chèques', color: '#ff6b35' },
  { key: 'tpe', label: 'TPE', color: '#f3b026' },
  { key: 'virements', label: 'Virements', color: '#25a8e0' },
] as const

export default function DashboardEncaissements({ fiches, campagneId }: { fiches: readonly FicheCaisse[]; campagneId: string }) {
  const [granularity, setGranularity] = useState<PeriodGranularity>('mois')
  const [view, setView] = useState<ViewMode>('repartition')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expandedTable, setExpandedTable] = useState(false)
  const [expandedAnalysis, setExpandedAnalysis] = useState(false)

  // En vue synthèse, afficher toujours toute la campagne par mois.
  // Les filtres avancés restent mémorisés pour le prochain dépliage.
  const displayedGranularity = expandedAnalysis ? granularity : 'mois'
  const displayedView = expandedAnalysis ? view : 'repartition'
  const displayedFrom = expandedAnalysis ? from : ''
  const displayedTo = expandedAnalysis ? to : ''
  const rows = useMemo(() => groupEncaissements(fiches, displayedGranularity, displayedFrom, displayedTo), [fiches, displayedGranularity, displayedFrom, displayedTo])
  const dailyRows = useMemo(() => groupEncaissements(fiches, 'jour', from, to), [fiches, from, to])
  const summary = useMemo(() => summarizeEncaissements(rows), [rows])
  const chartWidth = Math.max(540, rows.length * (displayedGranularity === 'jour' ? 48 : displayedGranularity === 'semaine' ? 65 : 72))
  const invalidDates = useMemo(() => fiches.filter(f => !isIsoDay(f.date)).length, [fiches])
  const dateError = Boolean(expandedAnalysis && from && to && from > to)

  function exportCsv() {
    const content = exportEncaissementsCsv(dailyRows)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `encaissements-par-date-${campagneId || 'campagne'}.csv`.replace(/[^a-z0-9_.-]/gi, '_')
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="dashboard-timeline">
      <div className="dashboard-box-title dashboard-timeline-heading">
        <TrendingUp size={20} />
        <div>
          <h2>Encaissements · évolution et répartition</h2>
          <p>Campagne {campagneId || 'non sélectionnée'} · données des fiches de caisse</p>
        </div>
        <button type="button" className="dashboard-timeline-expand" aria-expanded={expandedAnalysis} aria-controls="dashboard-timeline-more" onClick={() => setExpandedAnalysis(value => !value)}>
          {expandedAnalysis ? 'Réduire' : 'Voir le détail'}
        </button>
      </div>

      {expandedAnalysis && <div id="dashboard-timeline-more" className="dashboard-timeline-filters">
        <fieldset className="dashboard-timeline-tabs" aria-label="Regroupement des dates">
          <legend>Regrouper par</legend>
          {(['jour', 'semaine', 'mois'] as const).map(value => (
            <button key={value} type="button" aria-pressed={granularity === value} className={granularity === value ? 'is-selected' : ''} onClick={() => setGranularity(value)}>{value === 'jour' ? 'Jour' : value === 'semaine' ? 'Semaine' : 'Mois'}</button>
          ))}
        </fieldset>
        <label>Du<input aria-label="Date de début" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Au<input aria-label="Date de fin" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button className="dashboard-timeline-reset" type="button" onClick={() => { setFrom(''); setTo('') }} disabled={!from && !to}>Toutes les dates</button>
        <button type="button" className="dashboard-timeline-export" disabled={dailyRows.length === 0} onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </div>}

      <div className={`dashboard-timeline-summary ${expandedAnalysis ? 'is-expanded' : ''}`}>
        <div><small>Déclarés</small><strong>{currency(summary.declared)}</strong><span>{summary.ficheCount} fiche(s) sur la période</span></div>
        <div><small>Contrôlés</small><strong>{currency(summary.controlled)}</strong><span>{summary.controlledCount} fiche(s) contrôlée(s)</span></div>
        {expandedAnalysis && <><div><small>Reste à contrôler</small><strong>{currency(summary.pending)}</strong><span>Fiches à contrôler, avant remise en banque</span></div>
        <div><small>Dates avec encaissement</small><strong>{dailyRows.length}</strong><span>Jours ayant au moins une fiche datée</span></div></>}
      </div>

      <div className="dashboard-timeline-options">
        {expandedAnalysis && <div className="dashboard-timeline-tabs dashboard-timeline-view" aria-label="Type de graphique">
          <button type="button" aria-pressed={view === 'repartition'} className={view === 'repartition' ? 'is-selected' : ''} onClick={() => setView('repartition')}>Répartition par paiement</button>
          <button type="button" aria-pressed={view === 'evolution'} className={view === 'evolution' ? 'is-selected' : ''} onClick={() => setView('evolution')}>Déclarés / contrôlés</button>
        </div>}
        <div className="dashboard-timeline-legend">
          {displayedView === 'repartition' ? colored.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>) : <><span><i style={{ background: '#fa8b21' }}/>Déclarés</span><span><i style={{ background: '#15985b' }}/>Contrôlés</span></>}
          {displayedView === 'repartition' && <span><i className="dash-timeline-line"/>Total contrôlé</span>}
        </div>
      </div>

      {dateError && <p className="dashboard-timeline-warning">La date de début ne peut pas être postérieure à la date de fin.</p>}
      {!dateError && rows.length === 0 && <p className="dashboard-timeline-empty">Aucune fiche de caisse datée dans cette période pour cette campagne.</p>}
      {!dateError && rows.length > 0 && (
        <div className={`dashboard-timeline-scroll ${expandedAnalysis ? 'is-expanded' : 'is-compact'}`} role="region" tabIndex={0} aria-label="Graphique des encaissements par date">
          <div className={`dashboard-timeline-plot ${expandedAnalysis ? 'is-expanded' : 'is-compact'}`} style={expandedAnalysis ? { minWidth: chartWidth } : { minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              {displayedView === 'repartition' ? (
                <ComposedChart data={rows} margin={{ top: 12, right: expandedAnalysis ? 24 : 8, left: expandedAnalysis ? 22 : 0, bottom: 8 }}>
                  <CartesianGrid stroke="#e7edf4" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={key => rows.find(row => row.key === key)?.label ?? String(key)} tick={{ fontSize: 11, fill: '#5e7798' }} interval={expandedAnalysis ? 0 : 'preserveStartEnd'} minTickGap={7} />
                  <YAxis width={expandedAnalysis ? 65 : 54} tickFormatter={shortMoney} tick={{ fontSize: 11, fill: '#5e7798' }} />
                  <Tooltip labelFormatter={key => rows.find(row => row.key === key)?.fullLabel ?? String(key)} formatter={(value, name) => [currency(Number(value)), name === 'controlled' ? 'Total contrôlé' : colored.find(item => item.key === name)?.label ?? String(name)]} />
                  {colored.map(item => <Bar key={item.key} dataKey={item.key} stackId="payments" fill={item.color} maxBarSize={42} name={item.key} />)}
                  <Line type="monotone" dataKey="controlled" name="controlled" stroke="#116e3e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              ) : (
                <AreaChart data={rows} margin={{ top: 12, right: expandedAnalysis ? 24 : 8, left: expandedAnalysis ? 22 : 0, bottom: 8 }}>
                  <CartesianGrid stroke="#e7edf4" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={key => rows.find(row => row.key === key)?.label ?? String(key)} tick={{ fontSize: 11, fill: '#5e7798' }} interval={expandedAnalysis ? 0 : 'preserveStartEnd'} minTickGap={7} />
                  <YAxis width={expandedAnalysis ? 65 : 54} tickFormatter={shortMoney} tick={{ fontSize: 11, fill: '#5e7798' }} />
                  <Tooltip labelFormatter={key => rows.find(row => row.key === key)?.fullLabel ?? String(key)} formatter={(value, name) => [currency(Number(value)), name === 'declared' ? 'Déclaré' : 'Contrôlé']} />
                  <Area dataKey="declared" name="declared" type="monotone" stroke="#fa8b21" strokeWidth={3} fill="#ffbd83" fillOpacity={0.18} dot={{ r: 2 }} />
                  <Area dataKey="controlled" name="controlled" type="monotone" stroke="#15985b" strokeWidth={3} fill="#15985b" fillOpacity={0.10} dot={{ r: 2 }} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {expandedAnalysis ? <p className="dashboard-timeline-foot"><CalendarDays size={14}/> Chaque point reprend les dates des fiches de caisse, pas les dates de dépôt bancaire. « Contrôlé » signifie fiche vérifiée, pas rapprochement bancaire. Les dons sans contrepartie sont déjà inclus dans les moyens de paiement.</p> : <p className="dashboard-timeline-foot is-compact">Vue mensuelle par défaut · utiliser « Voir le détail » pour les jours, semaines et exports.</p>}

      {expandedAnalysis && <div className="dashboard-timeline-detail-head">
        <div><Wallet size={17} /><h3>Détail des encaissements par date</h3><span>{dailyRows.length} jour(s) renseigné(s)</span></div>
        <button type="button" onClick={() => setExpandedTable(value => !value)} aria-expanded={expandedTable}>{expandedTable ? 'Masquer le détail' : 'Afficher le détail'}</button>
      </div>}
      {expandedAnalysis && expandedTable && <div className="dashboard-timeline-table-scroll" role="region" tabIndex={0} aria-label="Tableau détaillé des encaissements journaliers">
        <table className="dashboard-timeline-table">
          <thead><tr><th>Date</th><th>Fiches</th><th>Espèces</th><th>Chèques</th><th>TPE</th><th>Virements</th><th>Déclaré</th><th>Contrôlé</th><th>À contrôler</th></tr></thead>
          <tbody>
            {dailyRows.map(row => <tr key={row.key}><td><strong>{row.fullLabel}</strong></td><td>{row.controlledCount} / {row.ficheCount} contrôlée(s)</td><td>{currency(row.especes)}</td><td>{currency(row.cheques)}</td><td>{currency(row.tpe)}</td><td>{currency(row.virements)}</td><td><strong>{currency(row.declared)}</strong></td><td className="dashboard-timeline-positive">{currency(row.controlled)}</td><td>{currency(row.pending)}</td></tr>)}
            {dailyRows.length === 0 && <tr><td colSpan={9}>Aucune date renseignée pour cette sélection.</td></tr>}
          </tbody>
        </table>
      </div>}
      {expandedAnalysis && invalidDates > 0 && <p className="dashboard-timeline-warning">{invalidDates} fiche(s) sans date au format AAAA-MM-JJ ne sont pas représentées dans cette analyse temporelle.</p>}
    </div>
  )
}

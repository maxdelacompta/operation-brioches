import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, Building2, Download, Gift, Search, TrendingUp, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useEtablissements } from '../contexts/EtablissementsContext'
import './RecapBrioches.css'

type MovementType = 'reception' | 'sortie' | 'retour' | 'ajustement' | 'transfert'
type Movement = { id: string; date: string; type: MovementType; etablissementId: string; destinationId?: string; quantite: number; commentaire: string }
type Don = { id: string; donateur: string; quantite: number; montant: number; mode: string; date: string; etablissementId?: string }
const STOCK_KEY = 'ob2026-stock-brioches-demo-v1'
const DON_KEY = 'ob2026-demo-dons-contrepartie-v1'
const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v)
const eur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
function loadArray(key: string): unknown[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(data) ? data : [] } catch { return [] }
}
function readMovements(): Movement[] {
  return loadArray(STOCK_KEY).filter((v): v is Movement => {
    if (!v || typeof v !== 'object') return false
    const x = v as Partial<Movement>
    return typeof x.id === 'string' && typeof x.date === 'string' && typeof x.etablissementId === 'string' && typeof x.quantite === 'number' && Number.isFinite(x.quantite) && ['reception','sortie','retour','ajustement','transfert'].includes(x.type ?? '')
  })
}
function readDons(): Don[] {
  return loadArray(DON_KEY).filter((v): v is Don => {
    if (!v || typeof v !== 'object') return false
    const x = v as Partial<Don>
    return typeof x.id === 'string' && typeof x.date === 'string' && typeof x.montant === 'number' && Number.isFinite(x.montant) && typeof x.quantite === 'number' && Number.isFinite(x.quantite)
  })
}
function change(m: Movement, id: string) {
  if (m.type === 'transfert') return m.etablissementId === id ? -m.quantite : m.destinationId === id ? m.quantite : 0
  if (m.etablissementId !== id) return 0
  return m.type === 'sortie' ? -m.quantite : m.quantite
}
function csvEscape(value: string | number) { return `"${String(value).replace(/"/g,'""')}"` }
export default function RecapBrioches() {
  const { etablissements } = useEtablissements()
  const [mouvements, setMouvements] = useState<Movement[]>(readMovements)
  const [dons, setDons] = useState<Don[]>(readDons)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'tous'|'actifs'|'avec-stock'|'sans-stock'>('tous')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [message, setMessage] = useState('')
  const byPeriod = (date: string) => { const day = date.slice(0,10); return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo) }
  // Le stock est toujours calculé sur l'historique complet, jamais sur la seule période filtrée.
  const rows = useMemo(() => etablissements.map(e => {
    const ms = mouvements.filter(m => m.etablissementId === e.id || m.destinationId === e.id)
    const receptions = ms.filter(m => m.type === 'reception' && m.etablissementId === e.id).reduce((n,m) => n + m.quantite,0)
    const sorties = ms.filter(m => m.type === 'sortie' && m.etablissementId === e.id).reduce((n,m) => n + m.quantite,0)
    const stock = ms.reduce((n,m) => n + change(m,e.id),0)
    const allocatedDons = dons.filter(d => d.etablissementId === e.id && byPeriod(d.date))
    return { id:e.id, name:e.nom, active:e.statut === 'ACTIF', receptions, sorties, stock, donnees:allocatedDons.length, brioches:allocatedDons.reduce((n,d)=>n+d.quantite,0), montant:allocatedDons.reduce((n,d)=>n+d.montant,0) }
  }), [etablissements,mouvements,dons,dateFrom,dateTo])
  const visibles = rows.filter(r => r.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')) && (filter === 'tous' || (filter === 'actifs' && r.active) || (filter === 'avec-stock' && r.stock > 0) || (filter === 'sans-stock' && r.stock <= 0)))
  const totalStock = rows.reduce((n,r)=>n+r.stock,0)
  const filteredDons = dons.filter(d => byPeriod(d.date))
  const totalAmount = filteredDons.reduce((n,d)=>n+d.montant,0)
  const totalBriocheDons = filteredDons.reduce((n,d)=>n+d.quantite,0)
  const unassigned = filteredDons.filter(d => !d.etablissementId || !etablissements.some(e=>e.id===d.etablissementId))
  const unassignedAmount = unassigned.reduce((n,d)=>n+d.montant,0)
  const unassignedQty = unassigned.reduce((n,d)=>n+d.quantite,0)
  const currentMovements = mouvements.filter(m=>byPeriod(m.date))
  const receivedPeriod = currentMovements.filter(m=>m.type==='reception').reduce((n,m)=>n+m.quantite,0)
  const sortiesPeriod = currentMovements.filter(m=>m.type==='sortie').reduce((n,m)=>n+m.quantite,0)
  function refresh() { setMouvements(readMovements()); setDons(readDons()); setMessage('Données du navigateur actualisées.') }
  function exportCSV() {
    const header = ['Établissement','Statut','Réceptions cumulées','Sorties cumulées','Stock actuel','Dons attribués (période)','Brioches remises (période)','Montant des dons (période)']
    const lines = [header,...visibles.map(r=>[r.name,r.active?'Actif':'Inactif',r.receptions,r.sorties,r.stock,r.donnees,r.brioches,r.montant.toFixed(2).replace('.',',')])]
    lines.push(['Dons non attribués','','','','',unassigned.length,unassignedQty,unassignedAmount.toFixed(2).replace('.',',')])
    const csv = '\uFEFF' + lines.map(line=>line.map(csvEscape).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}))
    const a = document.createElement('a'); a.href=url; a.download=`OB2026_recap_brioches_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  return <main className="rb-page">
    <PageHeader eyebrow="ÉTABLISSEMENTS / RÉCAP GLOBAL" title="Récap global" description="Vue consolidée des stocks et des dons avec contrepartie" illustration />
    <div className="rb-notice"><AlertTriangle size={18}/><span><strong>Mode démonstration.</strong> Données disponibles uniquement dans ce navigateur. Les dons du module Suivi Brioches ne sont pas encore associés aux établissements ni déduits automatiquement des stocks.</span></div>
    <section className="rb-actions" aria-label="Période et actions">
      <div className="rb-date"><label>Du <input type="date" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)}/></label><label>Au <input type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)}/></label></div>
      <div className="rb-action-buttons"><button type="button" className="rb-secondary" onClick={refresh}><TrendingUp size={16}/> Actualiser</button><button type="button" className="rb-primary" onClick={exportCSV}><Download size={17}/> Exporter CSV</button></div>
    </section>
    {message && <p className="rb-status" role="status">{message}</p>}
    <section className="rb-kpis" aria-label="Chiffres clés">
      <article className="rb-card"><span className="rb-icon rb-blue"><Building2 size={23}/></span><div><span>Établissements</span><strong>{fmt(etablissements.length)}</strong><small>{rows.filter(r=>r.active).length} actifs</small></div></article>
      <article className="rb-card"><span className="rb-icon rb-orange"><Gift size={23}/></span><div><span>Dons collectés</span><strong>{eur(totalAmount)}</strong><small>{filteredDons.length} dons sur la période</small></div></article>
      <article className="rb-card"><span className="rb-icon rb-green"><BarChart3 size={23}/></span><div><span>Stock actuel</span><strong>{fmt(totalStock)}</strong><small>Toutes périodes confondues</small></div></article>
      <article className="rb-card"><span className="rb-icon rb-blue"><Gift size={23}/></span><div><span>Brioches remises</span><strong>{fmt(totalBriocheDons)}</strong><small>Dons avec contrepartie</small></div></article>
    </section>
    <section className="rb-duo">
      <article className="rb-panel"><h2><ArrowDownToLine size={19}/> Mouvements sur la période</h2><div className="rb-facts"><div><span>Brioches réceptionnées</span><strong>{fmt(receivedPeriod)}</strong></div><div><span>Brioches sorties du stock</span><strong>{fmt(sortiesPeriod)}</strong></div><div><span>Mouvements enregistrés</span><strong>{fmt(currentMovements.length)}</strong></div></div></article>
      <article className="rb-panel"><h2><ArrowUpFromLine size={19}/> Dons sans établissement attribué</h2><div className="rb-facts"><div><span>Dons non attribués</span><strong>{fmt(unassigned.length)}</strong></div><div><span>Brioches correspondantes</span><strong>{fmt(unassignedQty)}</strong></div><div><span>Montant correspondant</span><strong>{eur(unassignedAmount)}</strong></div></div><p className="rb-hint">Ces dons figurent dans le total global, mais ne sont pas répartis arbitrairement dans le tableau ci-dessous.</p></article>
    </section>
    <section className="rb-panel rb-table-panel"><div className="rb-table-head"><div><h2><Building2 size={19}/> Synthèse par établissement</h2><p>Stock cumulé et dons attribués sur la période sélectionnée</p></div><div className="rb-filters"><label className="rb-search"><Search size={17}/><input aria-label="Rechercher un établissement" placeholder="Rechercher un établissement…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrer les établissements" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="tous">Tous les établissements</option><option value="actifs">Établissements actifs</option><option value="avec-stock">Avec stock</option><option value="sans-stock">Stock nul ou négatif</option></select></div></div>
    <div className="rb-scroll"><table><thead><tr><th>Établissement</th><th>Statut</th><th>Réceptions</th><th>Sorties</th><th>Stock actuel</th><th>Brioches remises*</th><th>Dons collectés*</th></tr></thead><tbody>{visibles.map(r=><tr key={r.id}><td className="rb-name">{r.name}</td><td><span className={`rb-pill ${r.active?'rb-pill--active':'rb-pill--inactive'}`}>{r.active?'Actif':'Inactif'}</span></td><td>{fmt(r.receptions)}</td><td>{fmt(r.sorties)}</td><td><strong>{fmt(r.stock)}</strong></td><td>{fmt(r.brioches)}</td><td>{eur(r.montant)}</td></tr>)}</tbody></table>{!visibles.length&&<p className="rb-empty">Aucun établissement ne correspond aux filtres sélectionnés.</p>}</div><p className="rb-foot">* Uniquement les dons possédant un identifiant d’établissement valide. Le module Suivi Brioches actuel n’en renseigne pas encore.</p></section>
  </main>
}

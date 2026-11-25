import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, BadgeEuro, BarChart3, Building2,
  CheckCircle2, ClipboardList, Download, Gift, HandCoins, History,
  PackageCheck, RefreshCcw, Search, Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useObData } from '../contexts/ObDataContext'
import { STOCK_CHANGED, donsKeyForCampaign, loadStockMovements, stockCampaignYear, stockKeyForCampaign } from '../lib/briochesStock'
import { commandeEtablissementKey, ETAB_COMMANDES_CHANGED, lireCommandesEtablissement } from '../services/etablissementsCommandesStore'
import { consoliderEtablissements, type RecapDon, type RecapLigne, type RecapMouvement } from '../services/etablissementsRecap'
import './RecapBrioches.css'

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v)
const eurCents = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v / 100)
const csvValue = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

function chargerDons(campagne: string): RecapDon[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(donsKeyForCampaign(campagne)) ?? '[]')
    if (!Array.isArray(data)) return []
    return data.filter((v): v is RecapDon => {
      if (!v || typeof v !== 'object') return false
      const d = v as Partial<RecapDon>
      return typeof d.id === 'string' && typeof d.date === 'string' &&
        typeof d.donateur === 'string' && typeof d.mode === 'string' &&
        typeof d.montant === 'number' && Number.isFinite(d.montant) &&
        typeof d.quantite === 'number' && Number.isFinite(d.quantite) &&
        (d.etablissementId === undefined || typeof d.etablissementId === 'string') &&
        (d.type === undefined || d.type === 'avec' || d.type === 'sans')
    })
  } catch { return [] }
}

function chargerMouvements(campagne: string): RecapMouvement[] {
  return loadStockMovements(campagne) as RecapMouvement[]
}

function indicateur(label: string, value: string, hint: string, icon: typeof Building2, color: 'blue' | 'orange' | 'green' | 'amber') {
  const Icon = icon
  return <article className="rb-card" key={label}>
    <span className={`rb-icon rb-${color}`}><Icon size={22} /></span>
    <div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
  </article>
}

export default function RecapBrioches() {
  const { etablissements } = useEtablissements()
  const { selectedCampagne, activeCampagne } = useObData()
  const campagneMeta = selectedCampagne ?? activeCampagne
  const campagne = campagneMeta?.id ?? 'OB 2026'
  const [revision, setRevision] = useState(0)
  // La campagne active déclenche un nouveau chargement. Les événements de stockage
  // révisent les données sans déclencher un setState synchrone depuis useEffect.
  const { mouvements, dons, commandes } = useMemo(() => {
    void revision // Token d'invalidation du cache après un événement de stockage.
    return {
      mouvements: chargerMouvements(campagne),
      dons: chargerDons(campagne),
      commandes: lireCommandesEtablissement(campagne),
    }
  }, [campagne, revision])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'tous' | 'actifs' | 'a-encaisser' | 'a-remettre' | 'sans-stock'>('tous')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const rafraichir = useCallback(() => setRevision(r => r + 1), [])

  useEffect(() => {
    const keys = new Set([stockKeyForCampaign(campagne), donsKeyForCampaign(campagne), commandeEtablissementKey(campagne)])
    const onStorage = (e: StorageEvent) => { if (e.key === null || keys.has(e.key)) rafraichir() }
    window.addEventListener('storage', onStorage)
    window.addEventListener(STOCK_CHANGED, rafraichir)
    window.addEventListener(ETAB_COMMANDES_CHANGED, rafraichir)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(STOCK_CHANGED, rafraichir)
      window.removeEventListener(ETAB_COMMANDES_CHANGED, rafraichir)
    }
  }, [campagne, rafraichir])

  const recap = useMemo(
    () => consoliderEtablissements(etablissements, mouvements, dons, commandes, dateFrom, dateTo),
    [etablissements, mouvements, dons, commandes, dateFrom, dateTo],
  )
  const { total } = recap
  const visibles = useMemo(() => {
    const mot = search.trim().toLocaleLowerCase('fr-FR')
    const base = [...recap.lignes, ...(recap.nonAttribues ? [recap.nonAttribues] : [])]
    return base.filter(row => {
      if (mot && !row.nom.toLocaleLowerCase('fr-FR').includes(mot)) return false
      if (filter === 'actifs') return row.actif
      if (filter === 'a-encaisser') return row.resteCentimes > 0
      if (filter === 'a-remettre') return row.briochesARemettre > 0
      if (filter === 'sans-stock') return row.attribue && (row.stock ?? 0) <= 0
      return true
    })
  }, [recap, search, filter])
  const details = visibles.find(r => r.id === detailId)
  const csvMontant = (centimes: number) => (centimes / 100).toFixed(2).replace('.', ',')

  function exporterCSV() {
    const header = [
      'Établissement', 'Statut', 'Stock actuel', 'Dons directs (nombre, période)',
      'Brioches dons (période)', 'Brioches commandes (période)', 'Brioches remises (période)',
      'Brioches encore à remettre', 'Dons directs encaissés (€ période)',
      'Règlements commandes (€ période)', 'Total encaissé (€ période)',
      'Reste à encaisser (€ campagne)', 'Commandes', 'Commandes réglées', 'Commandes terminées',
    ]
    const toRow = (row: RecapLigne) => [
      row.nom, row.attribue ? (row.actif ? 'Actif' : 'Inactif') : 'À rattacher',
      row.stock ?? '', row.donsNombre, row.donsBrioches, row.remisesCommandes, row.remisesTotal,
      row.briochesARemettre, csvMontant(row.donsCentimes), csvMontant(row.reglementsCommandesCentimes),
      csvMontant(row.totalEncaisseCentimes), csvMontant(row.resteCentimes), row.commandesNombre,
      row.commandesReglees, row.commandesTerminees,
    ]
    const rows = [
      ['Campagne', campagne],
      ['Activité du', dateFrom || 'début de campagne', 'au', dateTo || 'date actuelle'],
      ['Note', 'Stock, reste à remettre, reste à encaisser et statuts : soldes actuels sur toute la campagne'],
      [], header, ...visibles.map(toRow), [], toRow(total),
    ]
    const csv = '\uFEFF' + rows.map(line => line.map(v => csvValue(v)).join(';')).join('\r\n')
    const link = document.createElement('a')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    link.href = url
    link.download = `OB_recap_etablissements_${stockCampaignYear(campagne)}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus('Export CSV des établissements généré.')
  }

  return <main className="rb-page rb-redesigned">
    <PageHeader eyebrow="ÉTABLISSEMENTS / RÉCAP GLOBAL" title="Récapitulatif global" description="Stock, distribution et encaissements : une vision claire de tous les établissements." illustration />
    <div className="rb-context-bar">
      <div><strong>{campagneMeta?.nom || `Campagne ${stockCampaignYear(campagne)}`}</strong><span>Récapitulatif consolidé des établissements</span></div>
      <span className="rb-context-pill"><AlertTriangle size={15} /> Données locales au navigateur</span>
    </div>
    <section className="rb-actions" aria-label="Période et actions">
      <div className="rb-date"><span className="rb-date-title">Activité sur la période</span>
        <label>Du <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} /></label>
        <label>Au <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} /></label>
      </div>
      <div className="rb-action-buttons">
        <button type="button" className="rb-secondary" onClick={() => { rafraichir(); setStatus('Données du navigateur actualisées.') }}><RefreshCcw size={16} /> Actualiser</button>
        <button type="button" className="rb-primary" onClick={exporterCSV}><Download size={17} /> Exporter CSV</button>
      </div>
    </section>
    {status && <p className="rb-status" role="status">{status}</p>}
    <div className="rb-scope"><CheckCircle2 size={16} /><span><strong>Important :</strong> la période filtre les dons, remises et règlements. Le <strong>stock</strong>, le <strong>reste à remettre</strong> et le <strong>reste à encaisser</strong> sont les soldes actuels de toute la campagne.</span></div>

    <section className="rb-metric-group" aria-label="Suivi des brioches">
      <div className="rb-section-heading"><h2><PackageCheck size={19}/> Suivi des brioches</h2><span>Stock et distribution</span></div>
      <div className="rb-kpis">
        {indicateur('Stock physique disponible', fmt(total.stock ?? 0), 'Stock actuel de tous les établissements', Building2, 'blue')}
        {indicateur('Brioches réellement remises', fmt(total.remisesTotal), `${fmt(total.donsBrioches)} dons · ${fmt(total.remisesCommandes)} commandes`, Gift, 'orange')}
        {indicateur('Commandées, non remises', fmt(total.briochesARemettre), 'À distribuer sur les bons de commande', ClipboardList, 'amber')}
        {indicateur('Commandes terminées', fmt(total.commandesTerminees), 'Entièrement remises et réglées', CheckCircle2, 'green')}
      </div>
    </section>

    <section className="rb-metric-group" aria-label="Suivi financier">
      <div className="rb-section-heading"><h2><Wallet size={19}/> Suivi financier</h2><span>Encaissements réels, sans double comptage</span></div>
      <div className="rb-kpis">
        {indicateur('Dons directs encaissés', eurCents(total.donsCentimes), `${fmt(total.donsNombre)} dons enregistrés`, Gift, 'blue')}
        {indicateur('Règlements des commandes', eurCents(total.reglementsCommandesCentimes), 'Paiements effectivement reçus', HandCoins, 'orange')}
        {indicateur('Total réellement encaissé', eurCents(total.totalEncaisseCentimes), 'Dons + paiements de commandes', BadgeEuro, 'green')}
        {indicateur('Reste à encaisser', eurCents(total.resteCentimes), `${fmt(total.commandesARegler)} commandes à solder`, Wallet, 'amber')}
      </div>
    </section>

    <section className="rb-activity" aria-label="Activité des établissements">
      <div><ClipboardList size={19}/><span>Bons de commande (campagne)</span><strong>{fmt(total.commandesNombre)}</strong></div>
      <div><CheckCircle2 size={19}/><span>Commandes réglées (campagne)</span><strong>{fmt(total.commandesReglees)}</strong></div>
      <div><Gift size={19}/><span>Dons directs (période)</span><strong>{fmt(total.donsNombre)}</strong></div>
    </section>

    {recap.nonAttribues && <div className="rb-warning"><AlertTriangle size={20} /><div><strong>Opérations à rattacher à un établissement</strong><p>Des dons anciens ou des bons liés à un établissement inconnu figurent dans la ligne « Non attribués ». Leurs encaissements sont inclus dans le total global, sans affectation arbitraire.</p></div></div>}

    <section className="rb-panel rb-table-panel">
      <div className="rb-table-head"><div><h2><BarChart3 size={20}/> Comparatif par établissement</h2><p>Cliquez sur « Détails » pour retrouver la répartition des dons, commandes et règlements.</p></div>
        <div className="rb-filters"><label className="rb-search"><Search size={17}/><input aria-label="Rechercher un établissement" placeholder="Rechercher un établissement…" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <select aria-label="Filtrer les établissements" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="tous">Tous les établissements</option>
            <option value="actifs">Actifs</option>
            <option value="a-encaisser">Avec règlements attendus</option>
            <option value="a-remettre">Avec brioches à remettre</option>
            <option value="sans-stock">Stock nul ou négatif</option>
          </select>
        </div>
      </div>
      <div className="rb-scroll"><table>
        <thead><tr><th scope="col">Établissement</th><th scope="col">Stock actuel</th><th scope="col">Brioches remises*</th><th scope="col">Total encaissé*</th><th scope="col">Reste à encaisser</th><th scope="col">À remettre</th><th scope="col">Détail</th></tr></thead>
        <tbody>{visibles.map(row => <tr key={row.id} className={row.attribue ? '' : 'rb-unassigned-row'}>
          <td className="rb-name"><span>{row.nom}</span><small>{row.attribue ? (row.actif ? 'Actif' : 'Inactif') : 'À rattacher'}</small></td>
          <td>{row.stock === null ? '—' : fmt(row.stock)}</td>
          <td>{fmt(row.remisesTotal)}</td>
          <td className="rb-money">{eurCents(row.totalEncaisseCentimes)}</td>
          <td className={row.resteCentimes ? 'rb-due' : ''}>{eurCents(row.resteCentimes)}</td>
          <td>{fmt(row.briochesARemettre)}</td>
          <td><button type="button" className="rb-detail-btn" aria-expanded={detailId === row.id} onClick={() => setDetailId(detailId === row.id ? null : row.id)}>{detailId === row.id ? 'Masquer' : 'Détails'} <ArrowRight size={14}/></button></td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row">TOTAL GLOBAL</th><td>{fmt(total.stock ?? 0)}</td><td>{fmt(total.remisesTotal)}</td><td>{eurCents(total.totalEncaisseCentimes)}</td><td>{eurCents(total.resteCentimes)}</td><td>{fmt(total.briochesARemettre)}</td><td>—</td></tr></tfoot>
      </table>{!visibles.length && <p className="rb-empty">Aucun établissement ne correspond aux filtres.</p>}</div>
      {details && <div className="rb-details" aria-live="polite"><div className="rb-details-title"><div><h3>{details.nom}</h3><p>Détail des montants et quantités</p></div><button type="button" className="rb-secondary" onClick={() => setDetailId(null)}>Fermer</button></div>
        <div className="rb-detail-grid">
          <div><h4><Gift size={17}/> Brioches</h4><dl><div><dt>Stock disponible aujourd’hui</dt><dd>{details.stock === null ? 'Non rattaché' : fmt(details.stock)}</dd></div><div><dt>Remises en dons directs*</dt><dd>{fmt(details.donsBrioches)}</dd></div><div><dt>Remises de commandes*</dt><dd>{fmt(details.remisesCommandes)}</dd></div><div><dt>Brioches restant à remettre</dt><dd>{fmt(details.briochesARemettre)}</dd></div><div><dt>Réceptions de stock*</dt><dd>{fmt(details.receptions)}</dd></div></dl></div>
          <div><h4><HandCoins size={17}/> Finances</h4><dl><div><dt>Dons directs reçus*</dt><dd>{eurCents(details.donsCentimes)}</dd></div><div><dt>Règlements de commandes*</dt><dd>{eurCents(details.reglementsCommandesCentimes)}</dd></div><div><dt>Encaissé au total*</dt><dd>{eurCents(details.totalEncaisseCentimes)}</dd></div><div><dt>Reste à encaisser</dt><dd>{eurCents(details.resteCentimes)}</dd></div></dl></div>
          <div><h4><History size={17}/> Commandes</h4><dl><div><dt>Bons enregistrés</dt><dd>{fmt(details.commandesNombre)}</dd></div><div><dt>Commandes à régler</dt><dd>{fmt(details.commandesARegler)}</dd></div><div><dt>Commandes payées</dt><dd>{fmt(details.commandesReglees)}</dd></div><div><dt>Commandes terminées</dt><dd>{fmt(details.commandesTerminees)}</dd></div></dl></div>
        </div>
        {details.attribue && <Link className="rb-open-detail" to={`/etablissements/suivi-brioches?etablissement=${encodeURIComponent(details.id)}`}>Ouvrir Suivi Brioches <ArrowRight size={16}/></Link>}
      </div>}
      <p className="rb-foot">* Activité sur la période sélectionnée. Les chiffres de stock et les soldes de commandes portent sur l’ensemble de la campagne. « Commandes payées » n’implique pas forcément « brioches remises ». Le total global inclut les opérations non attribuées, même si un filtre masque leur ligne.</p>
    </section>
    <div className="rb-legend"><div><ArrowDownToLine size={17}/><strong>Remise</strong><span>Une sortie réelle de brioches, pas une commande enregistrée.</span></div><div><HandCoins size={17}/><strong>Règlement</strong><span>Un paiement reçu, jamais la valeur d’un bon simplement créé.</span></div><div><PackageCheck size={17}/><strong>Commande terminée</strong><span>Entièrement remise et entièrement réglée.</span></div></div>
  </main>
}

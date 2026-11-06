import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, FileText, Gift, Handshake, Map, Package, ShoppingCart, Target, TrendingUp, Users, Wallet } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import * as maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useObData } from '../contexts/ObDataContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useArtisans } from '../contexts/ArtisansContext'
import { useCommandesMairiesRs } from '../contexts/CommandesMairiesRsContext'
import { useJustificatifs } from '../contexts/JustificatifsContext'
import { bilanCaisseMairieRs } from '../lib/mairiesRsCaisse'
import { readFinanceRows } from '../lib/financeRegister'
import { donsSansContrepartieCaisse, financeSummary, invoiceSummary, purchaseSummary, readDashboardInvoices, readDashboardPayments, sumChannels, sumFiches } from '../lib/dashboardMetrics'
import { geocodeFrenchLocation, getCachedCoordinate } from '../services/geocodage'
import DashboardEncaissements from './DashboardEncaissements'
import './DashboardEncaissements.css'
import './Dashboard.css'

const money = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const integer = (n: number) => n.toLocaleString('fr-FR')
const COLORS = ['#18b968', '#ff6b35', '#f6b324', '#25a8e0', '#6f49e8']
const MAP_CENTER: [number, number] = [6.18, 48.69]
const MAP_BOUNDS: [[number, number], [number, number]] = [[5.3, 47.72], [7.35, 49.68]]

type DashboardMapPoint = {
  id: string
  label: string
  category: 'ETABLISSEMENT' | 'FICHE'
  longitude: number
  latitude: number
  subtitle?: string
}

type RawMapEntry = {
  id: string
  label: string
  category: 'ETABLISSEMENT' | 'FICHE'
  address?: string
  postalCode?: string
  city?: string
  subtitle?: string
}

type KpiProps = {
  icon: React.ReactNode
  title: string
  value: string
  subtitle?: string
  tone?: 'orange' | 'green' | 'blue' | 'red' | 'violet'
  to?: string
  compact?: boolean
}

/** Carte de KPI utilisée uniquement à l'intérieur du dashboard (aucun changement de la navigation). */
function Kpi({ icon, title, value, subtitle, tone = 'orange', to, compact = false }: KpiProps) {
  return <article className={`dashboard-kpi dashboard-kpi--${tone}${compact ? ' dashboard-kpi--compact' : ''}`}>
    <div className={`dashboard-kpi-icon ${tone}`}>{icon}</div>
    <div className="dashboard-kpi-body">
      <span className="dashboard-kpi-title">{title}</span>
      <strong>{value}</strong>
      {subtitle && <div className="dashboard-kpi-footer"><span>{subtitle}</span></div>}
      {to && <Link className="dashboard-kpi-detail" to={to}>Consulter <ArrowUpRight size={14} /></Link>}
    </div>
  </article>
}

function MiniSalesMap({ points }: { points: DashboardMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  const geojson = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: points.map((point): Feature<Point> => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
      properties: {
        id: point.id,
        label: point.label,
        subtitle: point.subtitle || '',
        category: point.category,
      },
    })),
  }), [points])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm',
        }],
      },
      center: MAP_CENTER,
      zoom: 7.1,
      minZoom: 6.2,
      maxZoom: 15,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      cooperativeGestures: true,
      maxBounds: MAP_BOUNDS,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('load', () => {
      map.addSource('dashboard-points', {
        type: 'geojson',
        data: geojson,
      })

      map.addLayer({
        id: 'dashboard-points-layer',
        type: 'circle',
        source: 'dashboard-points',
        paint: {
          'circle-radius': ['match', ['get', 'category'], 'ETABLISSEMENT', 7, 6],
          'circle-color': ['match', ['get', 'category'], 'ETABLISSEMENT', '#15985b', '#ff8614'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      })

      map.on('click', 'dashboard-points-layer', (event) => {
        const feature = event.features?.[0]
        const coords = (feature?.geometry as Point | undefined)?.coordinates
        if (!coords) return
        const props = (feature?.properties ?? {}) as Record<string, string>
        new maplibregl.Popup({ closeButton: false, offset: 10 })
          .setLngLat([coords[0], coords[1]])
          .setHTML(`<strong>${props.label ?? ''}</strong>${props.subtitle ? `<div style="margin-top:4px;font-size:12px;color:#5f7b9d;">${props.subtitle}</div>` : ''}`)
          .addTo(map)
      })

      map.on('mouseenter', 'dashboard-points-layer', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'dashboard-points-layer', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [geojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const update = () => {
      const source = map.getSource('dashboard-points') as GeoJSONSource | undefined
      source?.setData(geojson)

      if (points.length === 0) {
        map.easeTo({ center: MAP_CENTER, zoom: 7.1, duration: 600 })
        return
      }

      if (points.length === 1) {
        map.easeTo({ center: [points[0].longitude, points[0].latitude], zoom: 10.4, duration: 600 })
        return
      }

      const bounds = new maplibregl.LngLatBounds()
      points.forEach((point) => bounds.extend([point.longitude, point.latitude]))
      map.fitBounds(bounds, { padding: 34, duration: 650, maxZoom: 11.2 })
    }

    if (map.isStyleLoaded()) {
      update()
    } else {
      map.once('load', update)
    }
  }, [geojson, points])

  return (
    <div className="dashboard-mini-map-shell">
      <div ref={containerRef} className="dashboard-mini-map-canvas" />
      {points.length === 0 && (
        <div className="dashboard-mini-map-empty">
          <Map size={42} />
          <strong>Aucun point localisable</strong>
          <span>Ajoute une ville ou une adresse sur les fiches et établissements pour alimenter la mini-carte.</span>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { commandes, fichesCaisse, depotsBanque, selectedCampagne, activeCampagne } = useObData()
  const { etablissements } = useEtablissements()
  const { commandesArtisans } = useArtisans()
  const { commandes: commandesMairiesRs } = useCommandesMairiesRs()
  const { justificatifs } = useJustificatifs()
  const campagne = selectedCampagne ?? activeCampagne
  const id = campagne?.id ?? ''
  const commandesCampagne = useMemo(() => commandes.filter(c => c.campagne === id && c.statut !== 'ANNULEE'), [commandes, id])
  const fiches = useMemo(() => fichesCaisse.filter(f => f.campagne === id), [fichesCaisse, id])
  const fichesControlees = useMemo(() => fiches.filter(f => f.statutCoffre === 'CONTROLEE'), [fiches])
  const achats = useMemo(() => purchaseSummary(commandesArtisans, id), [commandesArtisans, id])
  const totalPaiements = useMemo(() => sumFiches(fiches), [fiches])
  const paiementsControles = useMemo(() => sumFiches(fichesControlees), [fichesControlees])
  const received = sumChannels(totalPaiements)
  const receivedControlled = sumChannels(paiementsControles)
  const pendingFiches = fiches.length - fichesControlees.length
  const remisesEnregistrees = depotsBanque.filter(depot => depot.campagne === id && depot.statut === 'ENREGISTRE').length
  const justificatifsCampagne = justificatifs.filter(justificatif => justificatif.campagne === id)
  const justificatifsAExaminer = justificatifsCampagne.filter(justificatif => ['BROUILLON', 'A_VERIFIER', 'ERREUR'].includes(justificatif.statut)).length

  // Ces registres sont indépendants des fiches de caisse : valeurs déclaratives
  // à afficher à part, sans les ajouter au total des encaissements.
  const mecenat = useMemo(() => id ? readFinanceRows('mecenat') : [], [id])
  const ecarts = useMemo(() => id ? readFinanceRows('ecarts') : [], [id])
  const finance = useMemo(() => financeSummary(mecenat, ecarts, id), [mecenat, ecarts, id])
  const factures = useMemo(() => id ? readDashboardInvoices() : [], [id])
  const reglements = useMemo(() => id ? readDashboardPayments() : [], [id])
  const facturation = useMemo(() => invoiceSummary(factures, reglements, id), [factures, reglements, id])
  const sansCampagne = factures.filter(f => !f.campagne).length + mecenat.filter(row => !row.campagne).length + ecarts.filter(row => !row.campagne).length
  const donsSans = useMemo(() => donsSansContrepartieCaisse(fiches), [fiches])
  const mairieRows = useMemo(() => commandesMairiesRs.filter(c => c.campagne === id && c.statut !== 'ANNULEE'), [commandesMairiesRs, id])
  const mairieSummary = useMemo(() => {
    const bilans = mairieRows.map(commande => bilanCaisseMairieRs(commande, fiches))
    return {
      total: mairieRows.length,
      prevision: mairieRows.reduce((sum, commande) => sum + Math.round((commande.donPrevu || 0) * 100), 0) / 100,
      reçus: bilans.reduce((sum, bilan) => sum + Math.round((bilan.recu || 0) * 100), 0) / 100,
      relies: bilans.filter(bilan => bilan.source === 'fiches').length,
      historiques: bilans.filter(bilan => bilan.source === 'historique').length,
    }
  }, [mairieRows, fiches])

  // Présenter séparément les flux monétaires et la valorisation de l'apport
  // en nature / compétences. Le second total est une valorisation globale,
  // et NON un bénéfice comptable ou une trésorerie encaissée.
  // Les montants déclarés peuvent encore demander un rapprochement bancaire.
  const soldePartiel = Math.round((receivedControlled - facturation.paid) * 100) / 100
  const resultatFinancierProvisoire =
    (Math.round(soldePartiel * 100) + Math.round(finance.financialDeclared * 100)) / 100
  const resultatGlobalValorise =
    (Math.round(resultatFinancierProvisoire * 100) + Math.round(finance.inKindDeclared * 100)) / 100
  const objective = campagne?.objectifBrioches && campagne.objectifBrioches > 0 ? campagne.objectifBrioches : null
  const progress = objective ? Math.round(100 * achats.quantite / objective) : null
  // Couleurs liées au moyen de paiement, même si une catégorie a un montant nul.
  const paymentData = [
    { name: 'Espèces', value: totalPaiements.especes, color: COLORS[0] },
    { name: 'Chèques', value: totalPaiements.cheques, color: COLORS[1] },
    { name: 'TPE', value: totalPaiements.tpe, color: COLORS[2] },
    { name: 'Virements', value: totalPaiements.virements, color: COLORS[3] },
  ].filter(x => x.value > 0)
  const distribution = ['ETABLISSEMENT', 'ENTREPRISE', 'MAIRIE', 'STAND', 'AUTRE'].map((type, i) => ({ name: ({ ETABLISSEMENT: 'Établissements', ENTREPRISE: 'Entreprises', MAIRIE: 'Mairies', STAND: 'Stands', AUTRE: 'Autres' } as Record<string, string>)[type], value: fiches.filter(f => f.type === type).length, color: COLORS[i] })).filter(x => x.value > 0)
  const pending = commandesCampagne.filter(c => c.statut === 'BROUILLON').length
  const deliveries = commandesCampagne.filter(c => c.statut === 'A_LIVRER').length
  const invoiceTypes = [
    { type: 'ACHAT_BRIOCHES', name: 'Achats de brioches' },
    { type: 'TRANSPORT', name: 'Transport' },
    { type: 'COMMUNICATION', name: 'Communication' },
    { type: 'MATERIEL', name: 'Matériel' },
    { type: 'AUTRE', name: 'Autres' },
  ].map(type => ({ ...type, amount: Math.round(facturation.lines.filter(f => f.categorie === type.type).reduce((n, f) => n + f.montantTtc, 0) * 100) / 100 })).filter(row => row.amount > 0)

  const rawMapEntries = useMemo<RawMapEntry[]>(() => {
    const entries: RawMapEntry[] = []

    etablissements
      .filter((etablissement) => etablissement.participeOperationBrioches && etablissement.statut === 'ACTIF')
      .forEach((etablissement) => {
        entries.push({
          id: `etab-${etablissement.id}`,
          label: etablissement.nom,
          category: 'ETABLISSEMENT',
          address: etablissement.adresse,
          postalCode: etablissement.codePostal,
          city: etablissement.ville,
          subtitle: etablissement.ville ? `${etablissement.type} · ${etablissement.ville}` : etablissement.type,
        })
      })

    fiches.forEach((fiche) => {
      if (!fiche.ville && !fiche.cp) return
      entries.push({
        id: `fiche-${fiche.id}`,
        label: fiche.libelle || fiche.numero,
        category: 'FICHE',
        postalCode: fiche.cp,
        city: fiche.ville,
        subtitle: `${fiche.type} · ${fiche.ville || fiche.cp || 'Localisation à préciser'}`,
      })
    })

    return entries
  }, [etablissements, fiches])

  const [mapPoints, setMapPoints] = useState<DashboardMapPoint[]>([])
  const [mapLoading, setMapLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolvePoints() {
      setMapLoading(true)
      const resolved = await Promise.all(rawMapEntries.map(async (entry) => {
        const cached = getCachedCoordinate({
          address: entry.address,
          postalCode: entry.postalCode,
          city: entry.city,
          label: entry.label,
        })

        const coordinate = cached ?? await geocodeFrenchLocation({
          address: entry.address,
          postalCode: entry.postalCode,
          city: entry.city,
          label: entry.label,
        })

        if (!coordinate) return null

        return {
          id: entry.id,
          label: entry.label,
          category: entry.category,
          longitude: coordinate.longitude,
          latitude: coordinate.latitude,
          subtitle: entry.subtitle || coordinate.label,
        } satisfies DashboardMapPoint
      }))

      if (!cancelled) {
        setMapPoints(resolved.filter(Boolean) as DashboardMapPoint[])
        setMapLoading(false)
      }
    }

    void resolvePoints()

    return () => {
      cancelled = true
    }
  }, [rawMapEntries])

  return <div className="dashboard-page dashboard-page--refonte">
    {/* En-tête interne à la page : Sidebar et Topbar globales inchangées. */}
    <header className="dashboard-topbar dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="dashboard-eyebrow">OPÉRATION BRIOCHE</span>
        <h1>Vue d’ensemble</h1>
        <p>Synthèse de la campagne {id || 'non sélectionnée'} · Commandes, encaissements, mécénat et résultats.</p>
      </div>
      <div className="dashboard-hero-meta">
        <span className="dashboard-status">{campagne?.statut === 'ACTIVE' ? 'Campagne active' : campagne?.statut === 'TERMINEE' ? 'Campagne terminée · historique' : campagne ? 'Campagne en préparation' : 'Aucune campagne'}</span>
        <span className="dashboard-refresh-label">Actualisée à l’ouverture de la page · {id || '—'}</span>
      </div>
    </header>

    <section className="dashboard-kpi-grid dashboard-hero-kpis" aria-label="Indicateurs essentiels de la campagne">
      <Kpi icon={<Wallet />} title="Encaissements déclarés" value={money(received)} tone="green" subtitle={`${fiches.length} fiche(s), dont ${pendingFiches} à contrôler`} to="/encaissements/fiches-caisse" />
      <Kpi icon={<Package />} title="Brioches commandées" value={integer(achats.quantite)} tone="blue" subtitle={`${achats.lignes.length} commande(s) · Artisans, GMS, Industriels`} to="/commandes-achats/suivi-global" />
      <Kpi icon={<Target />} title="Objectif de brioches" value={progress === null ? 'Non défini' : `${progress} %`} tone="orange" subtitle={objective ? `${integer(achats.quantite)} / ${integer(objective)} brioches commandées` : 'Renseigner l’objectif dans Administration → Campagnes'} to="/administration/campagnes" />
      <Kpi icon={<CheckCircle2 />} title="Fiches contrôlées · total" value={money(receivedControlled)} tone="violet" subtitle={`${fichesControlees.length} fiches contrôlées · avant rapprochement bancaire`} to="/encaissements/recapitulatif-global" />
    </section>

    <section className="dashboard-story-grid" aria-label="Résultats et analyse de la campagne">
      <article className="dashboard-box dashboard-results-panel">
        <div className="dashboard-box-title"><TrendingUp size={21} /><h2>Résultat de la campagne</h2></div>
        <div className="dashboard-result-feature">
          <span>Résultat global valorisé · provisoire</span>
          <strong>{money(resultatGlobalValorise)}</strong>
          <small>Valorisation non encaissée incluse</small>
        </div>
        <div className="dashboard-result-items">
          <div className="dashboard-result-item">
            <div className="dashboard-result-icon dashboard-result-icon--blue"><Banknote size={20} /></div>
            <div><span>Solde partiel des flux suivis</span><strong>{money(soldePartiel)}</strong><small>Fiches contrôlées − règlements fournisseurs</small></div>
          </div>
          <div className="dashboard-result-item">
            <div className="dashboard-result-icon dashboard-result-icon--green"><Handshake size={20} /></div>
            <div><span>Mécénat financier déclaré</span><strong>{money(finance.financialDeclared)}</strong><small>{finance.confirmedCount}/{finance.mecenatCount} contributions confirmées ou clôturées</small></div>
          </div>
          <div className="dashboard-result-item">
            <div className="dashboard-result-icon dashboard-result-icon--blue"><Gift size={20} /></div>
            <div><span>Mécénat non financier</span><strong>{money(finance.inKindDeclared)}</strong><small>Nature et compétences · non encaissé</small></div>
          </div>
          <div className="dashboard-result-item">
            <div className="dashboard-result-icon dashboard-result-icon--orange"><Users size={20} /></div>
            <div><span>Dons Mairies / RS suivis</span><strong>{money(mairieSummary.reçus)}</strong><small>{mairieSummary.relies} lien(s) aux fiches · {mairieSummary.historiques} historique(s)</small></div>
          </div>
        </div>
        <details className="dashboard-panel-details dashboard-result-explainer"><summary>Comprendre le résultat</summary>
          <p>Solde partiel {money(soldePartiel)} + mécénat financier déclaré {money(finance.financialDeclared)} + valorisation du mécénat non financier {money(finance.inKindDeclared)}. Résultat financier hors valorisation : {money(resultatFinancierProvisoire)}. Les dons Mairies / RS ne sont pas ajoutés une deuxième fois aux encaissements. Montants à consolider avant validation comptable.</p>
        </details>
      </article>

      <article className="dashboard-box dashboard-income dashboard-chart-panel">
        {/* Le composant existant calcule l'évolution à partir des vraies fiches : aucune courbe inventée. */}
        <DashboardEncaissements fiches={fiches} campagneId={id} />
      </article>

      <article className="dashboard-box dashboard-payments dashboard-payment-panel">
        <div className="dashboard-box-title"><Wallet size={21} /><h2>Répartition des encaissements déclarés</h2></div>
        {paymentData.length ? (
          <div className="dashboard-pie-content dashboard-pie-content--payments">
            <div className="dashboard-pie-chart dashboard-pie-chart--payments">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="value" innerRadius="60%" outerRadius="89%" paddingAngle={2}>
                    {paymentData.map(p => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="dashboard-pie-center"><strong>{integer(Math.round(received))} €</strong><span>Total déclaré</span></div>
            </div>
            <div className="dashboard-legend dashboard-legend--bars">
              {paymentData.map(p => (
                <div className="dashboard-legend-item" key={p.name}>
                  <div className="dashboard-legend-line">
                    <span className="legend-dot" style={{ background: p.color }} />
                    <span>{p.name}</span>
                    <strong>{money(p.value)}</strong>
                    <span className="dashboard-payment-percent">{received > 0 ? (100 * p.value / received).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '0'} %</span>
                  </div>
                  <div className="dashboard-legend-meter" aria-hidden="true"><span style={{ background: p.color, width: `${received > 0 ? (p.value / received) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        ) : <p>Aucun encaissement enregistré.</p>}
        <details className="dashboard-panel-details"><summary>Comprendre ce calcul</summary><p className="dashboard-small-note">Les dons ventilés dans les fiches ne sont pas ajoutés aux moyens de paiement. Ces montants sont déclarés et ne correspondent pas forcément aux remises en banque.</p></details>
      </article>
    </section>

    <section className="dashboard-box dashboard-geo-panel" aria-label="Répartition géographique">
      <div className="dashboard-box-title"><Map size={21} /><h2>Répartition géographique</h2></div>
      <div className="dashboard-geo-layout">
        <div className="dashboard-map-card"><MiniSalesMap points={mapPoints} /></div>
        <aside className="dashboard-geo-aside">
          <div className="dashboard-geo-stat dashboard-geo-stat--green"><strong>{mapPoints.filter(point => point.category === 'ETABLISSEMENT').length}</strong><span>Établissement(s)</span></div>
          <div className="dashboard-geo-stat dashboard-geo-stat--orange"><strong>{mapPoints.filter(point => point.category === 'FICHE').length}</strong><span>Fiche(s) localisée(s)</span></div>
          {mapLoading && <span className="dashboard-map-chip">Localisation des points…</span>}
          <Link className="dashboard-map-link" to="/geographie/carte">Ouvrir la carte <ArrowUpRight size={16} /></Link>
        </aside>
      </div>
      <details className="dashboard-panel-details"><summary>Chiffres de la campagne</summary><div className="map-summary"><strong>Campagne {id || 'non choisie'}</strong><span>{integer(achats.quantite)} brioches commandées</span><span>{fiches.length} fiches de caisse</span><span>{commandesCampagne.length} commandes entreprises</span><span>{mairieSummary.total} commandes Mairies / RS</span><span>Établissements issus de la BDD globale, non spécifiques à la campagne</span></div></details>
    </section>

    {/* Méthodologie disponible après les indicateurs principaux. */}
    {/* Cette explication reste consultable, sans occuper tout le haut de l'écran. */}
    <details className="dashboard-data-note dashboard-data-note--collapsed">
      <summary><AlertTriangle size={16} /> Périmètre des calculs et fiabilité des données {sansCampagne > 0 && <span className="dashboard-warning-count">{sansCampagne} élément(s) sans campagne</span>}</summary>
      <p><strong>Lecture fiable des données :</strong> les fiches de caisse sont des <strong>encaissements déclarés</strong> tant qu’elles ne sont pas contrôlées.
        Les commandes achats sont des engagements estimés, les factures des dépenses enregistrées et le mécénat reste déclaratif.
        Le résultat valorisé additionne le solde partiel, le mécénat financier déclaré et la valorisation du mécénat en nature et en compétences. Il ne constitue pas un résultat comptable définitif.
        Les dons déjà comptabilisés en caisse ne sont pas additionnés une seconde fois. Le résultat comptable définitif nécessite un rapprochement.
        {sansCampagne > 0 && <> <strong>{sansCampagne} enregistrement(s) sans campagne</strong> dans les factures ou registres ne sont pas intégrés à cette synthèse : rattachement à vérifier.</>}
      </p>
    </details>


    <div className="dashboard-section-heading dashboard-subsection-heading"><h2>Indicateurs opérationnels et financiers</h2><span>Informations complémentaires · {id || 'Campagne non sélectionnée'}</span></div>
    <section className="dashboard-extra-kpis" aria-label="Indicateurs opérationnels détaillés">
      <Kpi compact icon={<ShoppingCart />} title="Commandes Mairies / RS" value={integer(mairieSummary.total)} tone="orange" subtitle={`${money(mairieSummary.prevision)} de dons prévus · hors caisse`} to="/commandes/mairies-rs" />
      <Kpi compact icon={<FileText />} title="Achats estimés TTC" value={money(achats.estime)} tone="blue" subtitle="Estimation des commandes, pas une dépense payée" to="/commandes-achats/suivi-global" />
      <Kpi compact icon={<FileText />} title="Factures fournisseurs TTC" value={money(facturation.amount)} tone="blue" subtitle={`${facturation.lines.length} facture(s) enregistrée(s)`} to="/finance/factures-paiements" />
      <Kpi compact icon={<Banknote />} title="Règlements fournisseurs confirmés" value={money(facturation.paid)} tone="red" subtitle={`${money(facturation.outstanding)} restant à payer`} to="/finance/factures-paiements" />
      <Kpi compact icon={<Gift />} title="Dons sans contrepartie" value={money(donsSans.amount)} tone="violet" subtitle={`${integer(donsSans.count)} don(s) · ${donsSans.fichesRenseignees} fiche(s) renseignée(s)${donsSans.fichesInconnues ? ` · ${donsSans.fichesInconnues} nombre(s) inconnu(s)` : ''} · ${money(donsSans.controlledAmount)} contrôlés, déjà inclus dans la caisse`} to="/encaissements/fiches-caisse" />
      <Kpi compact icon={<AlertTriangle />} title="Écarts restant à traiter" value={money(finance.pendingLossAmount)} tone="red" subtitle={`${finance.pendingLossesCount} écart(s) ouvert(s) · montant absolu déclaré`} to="/finance/pertes-ecarts" />
    </section>

    <div className="dashboard-section-heading dashboard-subsection-heading dashboard-secondary-title"><h2>Suivi détaillé de la campagne</h2></div>

    <section className="dashboard-secondary-grid">
      <article className="dashboard-box dashboard-origins">
        <div className="dashboard-box-title"><Users size={20}/><h2>Fiches de caisse par origine</h2></div>
        {distribution.length ? (
          <div className="dashboard-pie-content dashboard-pie-content--origins">
            <div className="dashboard-pie-chart dashboard-pie-chart--origins">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" outerRadius="87%">
                    {distribution.map(p => <Cell key={p.name} fill={p.color}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dashboard-legend dashboard-legend--bars">
              {distribution.map(p => (
                <div className="dashboard-legend-item" key={p.name}>
                  <div className="dashboard-legend-line">
                    <span className="legend-dot" style={{ background: p.color }}/>
                    <span>{p.name}</span>
                    <strong>{p.value}</strong>
                  </div>
                  <div className="dashboard-legend-meter" aria-hidden="true">
                    <span style={{ background: p.color, width: `${fiches.length > 0 ? (p.value / fiches.length) * 100 : 0}%` }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : <p>Aucune fiche disponible.</p>}
        <Link className="dashboard-text-link" to="/encaissements/fiches-caisse">Consulter les fiches de caisse</Link>
      </article>
      <article className="dashboard-box">
        <div className="dashboard-box-title"><Wallet size={20}/><h2>Factures par poste</h2></div>
        {invoiceTypes.length ? <div className="dashboard-expense-bars">{invoiceTypes.slice(0, 3).map(row => <div key={row.type} className="dashboard-expense-line"><div><span>{row.name}</span><strong>{money(row.amount)}</strong></div><div className="dashboard-track"><span style={{width:`${facturation.amount > 0 ? Math.max(0,Math.min(100,100*row.amount/facturation.amount)) : 0}%`}}/></div></div>)}{invoiceTypes.length > 3 && <details className="dashboard-panel-details"><summary>{invoiceTypes.length - 3} autre(s) poste(s)</summary>{invoiceTypes.slice(3).map(row => <div key={row.type} className="dashboard-expense-line"><div><span>{row.name}</span><strong>{money(row.amount)}</strong></div><div className="dashboard-track"><span style={{width:`${facturation.amount > 0 ? Math.max(0,Math.min(100,100*row.amount/facturation.amount)) : 0}%`}}/></div></div>)}</details>}</div> : <p>Aucune facture catégorisée pour cette campagne.</p>}
        <div className="dashboard-insight-foot"><span>Facturé : <strong>{money(facturation.amount)}</strong></span><span>Payé confirmé : <strong>{money(facturation.paid)}</strong></span></div>
        <Link className="dashboard-text-link" to="/finance/factures-paiements">Voir Factures & Paiements</Link>
      </article>
      <article className="dashboard-box">
        <div className="dashboard-box-title"><Target size={20}/><h2>État des modules</h2></div>
        <div className="dashboard-insight-list">
          <div><span>Commandes entreprises</span><strong>{commandesCampagne.length}</strong></div>
          <div><span>Commandes Mairies / RS</span><strong>{mairieSummary.total}</strong></div>
          <div><span>Achats fournisseurs</span><strong>{achats.lignes.length}</strong></div>
          <div><span>Fiches de caisse contrôlées</span><strong>{fichesControlees.length} / {fiches.length}</strong></div>
          <details className="dashboard-panel-details"><summary>4 autres modules</summary>
            <div><span>Contributions mécénat</span><strong>{finance.mecenatCount}</strong></div>
            <div><span>Pertes / Écarts</span><strong>{finance.lossCount} ({finance.resolvedLossCount} résolus)</strong></div>
            <div><span>Justificatifs de dons</span><strong>{justificatifsCampagne.length}</strong></div>
            <div><span>Remises bancaires enregistrées</span><strong>{remisesEnregistrees}</strong></div>
          </details>
        </div>
      </article>
    </section>

    <section className="dashboard-bottom-grid">
      <article className="dashboard-box"><div className="dashboard-box-title"><TrendingUp size={20}/><h2>Dernières commandes entreprises</h2></div><div className="activity-list">{[...commandesCampagne].sort((a,b)=>b.dateCommande.localeCompare(a.dateCommande)).slice(0,3).map(c=><div key={c.id}><span className="status-dot green"/><strong>{c.numero}</strong><span>{integer(c.quantite)} brioches · {c.statut}</span><small>{c.dateCommande}</small></div>)}{commandesCampagne.length===0 && <p>Aucune commande pour cette campagne.</p>}</div><Link className="dashboard-text-link" to="/commandes">Toutes les commandes</Link></article>
      <article className="dashboard-box"><div className="dashboard-box-title alert-title"><AlertTriangle size={20}/><h2>Points de vigilance</h2></div><div className="dashboard-alerts">
        <Link to="/encaissements/fiches-caisse"><strong>{pendingFiches} fiche(s) à contrôler</strong><span>Contrôle manuel requis ; le coffre calcule déjà à partir des fiches enregistrées</span></Link>
        <Link to="/commandes"><strong>{pending} commande(s) en brouillon · {deliveries} à livrer</strong><span>Commandes entreprises</span></Link>
        <Link to="/finance/factures-paiements"><strong>{facturation.unpaidCount} facture(s) avec solde dû</strong><span>{money(facturation.outstanding)} à régler</span></Link>
        <details className="dashboard-panel-details"><summary>3 autres points de vigilance</summary>
          <Link to="/finance/mecenat"><strong>{finance.pendingMecenat} mécénat(s) à confirmer</strong><span>Ne comptent pas dans les encaissements</span></Link>
          <Link to="/finance/pertes-ecarts"><strong>{finance.pendingLossesCount} écart(s) non résolu(s)</strong><span>{money(finance.pendingLossAmount)} à analyser</span></Link>
          <Link to="/finance/justificatifs-dons"><strong>{justificatifsAExaminer} justificatif(s) à vérifier</strong><span>Statuts brouillon, à vérifier ou erreur</span></Link>
        </details>
      </div></article>
      <article className="dashboard-box"><div className="dashboard-box-title"><FileText size={20}/><h2>Accès rapides</h2></div><div className="documents-list"><Link to="/commandes">Commandes entreprises</Link><Link to="/commandes/mairies-rs">Commandes Mairies & RS</Link><Link to="/encaissements/fiches-caisse">Fiches de caisse</Link><Link to="/encaissements/coffre">Coffre</Link><details className="dashboard-panel-details"><summary>6 autres raccourcis</summary><Link to="/encaissements/suivi-banque">Suivi banque</Link><Link to="/finance/justificatifs-dons">Justificatifs de dons</Link><Link to="/finance/mecenat">Mécénat</Link><Link to="/finance/pertes-ecarts">Pertes / Écarts</Link><Link to="/finance/factures-paiements">Factures & Paiements</Link><Link to="/geographie/carte">Carte des ventes</Link></details></div></article>
    </section>
  </div>
}

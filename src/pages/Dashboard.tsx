import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FileText, Gift, Handshake, Map, Package, ShoppingCart, Target, TrendingUp, Users, Wallet } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useObData } from '../contexts/ObDataContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useArtisans } from '../contexts/ArtisansContext'
import { montantCommande } from '../types/artisans'
import { BILLETS, PIECES } from '../services/coffre'
import { geocodeFrenchLocation, getCachedCoordinate } from '../services/geocodage'
import type { FicheCaisse } from '../types/ob'
import './Dashboard.css'

const money = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const integer = (n: number) => n.toLocaleString('fr-FR')
const COLORS = ['#18b968', '#ff6b35', '#f6b324', '#25a8e0', '#6f49e8']
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
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

// Uniquement les montants des moyens de règlement figurant sur les fiches.
// Les champs « dons » ne sont PAS additionnés : ils peuvent décrire les mêmes encaissements.
function paiements(f: FicheCaisse) {
  const especes = BILLETS.reduce((sum, b) => sum + (f[b.key] ?? 0) * b.valeurCentimes / 100, 0)
    + PIECES.reduce((sum, p) => sum + (f[p.key] ?? 0) * p.valeurCentimes / 100, 0)
  return { especes, cheques: f.montantCheques || 0, tpe: f.montantTpe || 0, virements: f.montantVirement || 0 }
}

function Kpi({ icon, title, value, subtitle, tone = 'orange' }: { icon: React.ReactNode; title: string; value: string; subtitle?: string; tone?: string }) {
  return <article className="dashboard-kpi"><div className={`dashboard-kpi-icon ${tone}`}>{icon}</div><div><span className="dashboard-kpi-title">{title}</span><strong>{value}</strong><div className="dashboard-kpi-footer">{subtitle && <span>{subtitle}</span>}</div></div></article>
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
  const { commandes, fichesCaisse, selectedCampagne, activeCampagne } = useObData() as ReturnType<typeof useObData> & {
    selectedCampagne?: { id: string; nom?: string; objectifBrioches?: number | null }
    activeCampagne?: { id: string; nom?: string; objectifBrioches?: number | null }
  }
  const { etablissements } = useEtablissements()
  const { commandesArtisans } = useArtisans()
  const campagne = selectedCampagne ?? activeCampagne
  const id = campagne?.id ?? ''
  const commandesCampagne = useMemo(() => commandes.filter(c => c.campagne === id && c.statut !== 'ANNULEE'), [commandes, id])
  const fiches = useMemo(() => fichesCaisse.filter(f => f.campagne === id), [fichesCaisse, id])
  // Les achats des trois catégories partagent la base commandesArtisans.
  // Certaines anciennes lignes stockent seulement l'année, d'autres « OB 2025 ».
  const campagneAnnee = Number(id.match(/(?:19|20)\d{2}/)?.[0] ?? 0)
  const achatsCampagne = useMemo(() => commandesArtisans.filter(c => {
    const annee = Number(String(c.campagne || '').match(/(?:19|20)\d{2}/)?.[0] ?? 0)
    return campagneAnnee > 0 && annee === campagneAnnee && c.statut !== 'ANNULEE'
  }), [commandesArtisans, campagneAnnee])
  const ordered = achatsCampagne.reduce((n, c) => n + Math.max(0, Number(c.quantiteCommandee) || 0), 0)
  const achatsEstimes = achatsCampagne.reduce((n, c) => n + montantCommande(c), 0)
  // La page Mécénat actuelle ne stocke pas de campagne. Ne jamais additionner
  // automatiquement des contributions dont l'année n'est pas identifiée.
  const mecenatAttribuable: number | null = null
  const depensesValidees: number | null = null

  const totals = fiches.reduce((acc, fiche) => {
    const p = paiements(fiche)
    acc.especes += p.especes; acc.cheques += p.cheques; acc.tpe += p.tpe; acc.virements += p.virements
    return acc
  }, { especes: 0, cheques: 0, tpe: 0, virements: 0 })
  const received = Object.values(totals).reduce((a, b) => a + b, 0)
  // Résultat réel = encaissements + mécénat attribué - dépenses réelles.
  // Sans rattachement du mécénat et des factures par campagne, ne pas l'inventer.
  const resultatReel: number | null = mecenatAttribuable !== null && depensesValidees !== null
    ? received + mecenatAttribuable - depensesValidees : null
  const progress = campagne?.objectifBrioches && campagne.objectifBrioches > 0 ? Math.round(100 * ordered / campagne.objectifBrioches) : null
  const paymentData = [
    { name: 'Espèces', value: totals.especes }, { name: 'Chèques', value: totals.cheques },
    { name: 'TPE', value: totals.tpe }, { name: 'Virements', value: totals.virements },
  ].filter(x => x.value > 0)
  const monthly = MONTHS.map((month, i) => ({ month, value: fiches.filter(f => {
    const d = new Date(f.date)
    return !Number.isNaN(d.getTime()) && d.getMonth() === i
  }).reduce((sum, f) => { const p = paiements(f); return sum + p.especes + p.cheques + p.tpe + p.virements }, 0) }))
  const distribution = ['ETABLISSEMENT', 'ENTREPRISE', 'MAIRIE', 'STAND', 'AUTRE'].map((type, i) => ({ name: ({ ETABLISSEMENT: 'Établissements', ENTREPRISE: 'Entreprises', MAIRIE: 'Mairies', STAND: 'Stands', AUTRE: 'Autres' } as Record<string, string>)[type], value: fiches.filter(f => f.type === type).length, color: COLORS[i] })).filter(x => x.value > 0)
  const pending = commandesCampagne.filter(c => c.statut === 'BROUILLON').length
  const deliveries = commandesCampagne.filter(c => c.statut === 'A_LIVRER').length

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

  return <div className="dashboard-page">
    <header className="dashboard-topbar"><div><span className="dashboard-eyebrow">TABLEAU DE BORD</span><h1>{campagne?.nom ?? 'Opération Brioche'}</h1><p>Suivi des données enregistrées · {id || 'Aucune campagne sélectionnée'}</p></div></header>
    <section className="dashboard-filters"><p style={{ margin: 0, fontSize: 13 }}>Campagne sélectionnée dans la barre supérieure. Données issues des commandes et des fiches de caisse de cette campagne. Les autres modules seront raccordés ensuite.</p></section>
    <section className="dashboard-kpi-grid">
      <Kpi icon={<Package />} title="Brioches commandées" value={integer(ordered)} subtitle="Achats fournisseurs Artisans, GMS et Industriels" />
      <Kpi icon={<Wallet />} title="Encaissements déclarés" value={money(received)} tone="green" subtitle={`${fiches.length} fiche(s) de caisse · non rapprochées`} />
      <Kpi icon={<TrendingUp />} title="Résultat de l'opération" value={resultatReel === null ? "—" : money(resultatReel)} tone="blue" subtitle="Encaissements + mécénat − dépenses réelles · rapprochements à terminer" />
      <Kpi icon={<Target />} title="Avancement des achats" value={progress === null ? '—' : `${progress} %`} tone="green" subtitle={progress === null ? 'Objectif brioches non renseigné' : `Sur objectif de ${integer(campagne!.objectifBrioches!)}`} />
      <Kpi icon={<Handshake />} title="Mécénat / Sponsoring" value="—" tone="green" subtitle="À rattacher à la campagne pour éviter les mélanges" />
      <Kpi icon={<Gift />} title="Valeur des commandes" value={money(achatsEstimes)} tone="red" subtitle="Montant estimé des achats fournisseurs" />
      <Kpi icon={<Gift />} title="Dons sans contrepartie" value="—" tone="red" subtitle="Ventilation fiable non encore disponible" />
      <Kpi icon={<Wallet />} title="Dépenses totales" value={money(achatsEstimes)} subtitle="Estimation achats TTC · factures et autres dépenses non incluses" />
    </section>
    <section className="dashboard-analysis-grid">
      <article className="dashboard-box dashboard-map"><div className="dashboard-box-title"><Map size={20}/><h2>Répartition géographique</h2></div><div className="dashboard-map-card"><MiniSalesMap points={mapPoints} /><div className="dashboard-map-toolbar"><div className="dashboard-map-chip-group"><span className="dashboard-map-chip is-green">{mapPoints.filter(point => point.category === 'ETABLISSEMENT').length} établissement(s)</span><span className="dashboard-map-chip is-orange">{mapPoints.filter(point => point.category === 'FICHE').length} point(s) de vente</span>{mapLoading && <span className="dashboard-map-chip">Localisation…</span>}</div><Link className="dashboard-map-link" to="/geographie/carte">Ouvrir la carte</Link></div></div><div className="map-summary"><strong>Campagne {id || 'non choisie'}</strong><span>{integer(ordered)} brioches commandées</span><span>{fiches.length} fiches de caisse</span><span>{commandesCampagne.length} commandes</span></div></article>
      <article className="dashboard-box dashboard-income"><div className="dashboard-box-title"><TrendingUp size={20}/><h2>Encaissements déclarés par mois</h2></div><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly}><CartesianGrid stroke="#e7edf4" strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v) => money(Number(v))}/><Area type="monotone" dataKey="value" stroke="#ff8a1f" fill="#ffbd83" fillOpacity={0.3}/></AreaChart></ResponsiveContainer></div></article>
      <article className="dashboard-box"><div className="dashboard-box-title"><Wallet size={20}/><h2>Répartition des encaissements</h2></div>{paymentData.length ? <div className="dashboard-pie-content"><div className="dashboard-pie-chart"><ResponsiveContainer width={180} height={180}><PieChart><Pie data={paymentData} dataKey="value" innerRadius={52} outerRadius={78}>{paymentData.map((p, i) => <Cell key={p.name} fill={COLORS[i]}/>)}</Pie></PieChart></ResponsiveContainer></div><div className="dashboard-legend">{paymentData.map((p,i) => <div key={p.name}><span className="legend-dot" style={{background:COLORS[i]}}/><span>{p.name}</span><strong>{money(p.value)}</strong></div>)}</div></div> : <p>Aucun encaissement enregistré.</p>}</article>
    </section>
    <section className="dashboard-secondary-grid">
      <article className="dashboard-box"><div className="dashboard-box-title"><Users size={20}/><h2>Fiches par canal</h2></div>{distribution.length ? <div className="dashboard-pie-content"><div className="dashboard-pie-chart"><ResponsiveContainer width={180} height={180}><PieChart><Pie data={distribution} dataKey="value" outerRadius={75}>{distribution.map(p=><Cell key={p.name} fill={p.color}/>)}</Pie></PieChart></ResponsiveContainer></div><div className="dashboard-legend">{distribution.map(p=><div key={p.name}><span className="legend-dot" style={{background:p.color}}/><span>{p.name}</span><strong>{p.value}</strong></div>)}</div></div> : <p>Aucune fiche disponible.</p>}</article>
      <article className="dashboard-box"><div className="dashboard-box-title"><Wallet size={20}/><h2>Dépenses par poste</h2></div><p>À raccorder au module Achats / Factures. Aucune répartition fictive affichée.</p></article>
      <article className="dashboard-box"><div className="dashboard-box-title"><Target size={20}/><h2>Indicateurs complémentaires</h2></div><div className="dashboard-small-kpis"><div><ShoppingCart size={24}/><span>Commandes</span><strong>{achatsCampagne.length}</strong><small>Achats fournisseurs non annulés</small></div><div><FileText size={24}/><span>Fiches de caisse</span><strong>{fiches.length}</strong><small>Enregistrées</small></div><div><AlertTriangle size={24}/><span>Pertes / Invendus</span><strong>—</strong><small>Module à raccorder</small></div><div><Gift size={24}/><span>Brioches commandées</span><strong>{integer(ordered)}</strong><small>Quantité théorique</small></div></div></article>
    </section>
    <section className="dashboard-bottom-grid">
      <article className="dashboard-box"><div className="dashboard-box-title"><TrendingUp size={20}/><h2>Commandes récentes</h2></div><div className="activity-list">{[...commandesCampagne].sort((a,b)=>b.dateCommande.localeCompare(a.dateCommande)).slice(0,4).map(c=><div key={c.id}><span className="status-dot green"/><strong>{c.numero}</strong><span>{integer(c.quantite)} brioches · {c.statut}</span><small>{c.dateCommande}</small></div>)}{commandesCampagne.length===0 && <p>Aucune commande pour cette campagne.</p>}</div></article>
      <article className="dashboard-box"><div className="dashboard-box-title alert-title"><AlertTriangle size={20}/><h2>Alertes et tâches à traiter</h2></div><div className="alert-list"><div><strong>{pending} commande(s) en brouillon</strong><span>À confirmer</span></div><div><strong>{deliveries} livraison(s) à prévoir</strong><span>Commandes au statut « À livrer »</span></div></div></article>
      <article className="dashboard-box"><div className="dashboard-box-title"><FileText size={20}/><h2>Accès rapides</h2></div><div className="documents-list"><Link to="/commandes">Liste des commandes</Link><Link to="/encaissements/fiches-caisse">Fiches de caisse</Link><Link to="/geographie/carte">Carte des ventes</Link></div></article>
    </section>
  </div>
}

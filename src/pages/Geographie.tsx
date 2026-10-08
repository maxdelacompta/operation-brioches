import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  BarChart3,
  Building2,
  Check,
  CircleDollarSign,
  Eye,
  Flame,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react'

import * as maplibregl from 'maplibre-gl'
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useLocation } from 'react-router-dom'

import { useObData } from '../contexts/ObDataContext'
import { useMairies } from '../contexts/MairiesContext'
import { useCommandesMairiesRs } from '../contexts/CommandesMairiesRsContext'
import { useEtablissements } from '../contexts/EtablissementsContext'

import {
  geocodeFrenchLocation,
  geoKey,
  getCachedCoordinate,
  normalizeGeoText,
} from '../services/geocodage'

import type {
  GeoChannel,
  GeoMapMode,
  GeoMetric,
  GeoSalePoint,
  GeoSectorSummary,
} from '../types/geographie'

import './Geographie.css'

type PanelTab = 'ANALYSE' | 'DETAILS' | 'LISTE'
type BaseMap = 'CARTE' | 'SATELLITE'

const CHANNEL_LABELS: Record<GeoChannel, string> = {
  STAND: 'Stands',
  MAIRIE_RS: 'RS / Mairies',
  ENTREPRISE: 'Entreprises',
  ETABLISSEMENT: 'Établissements',
}

const CHANNEL_COLORS: Record<GeoChannel, string> = {
  STAND: '#a30f31',
  MAIRIE_RS: '#ef921d',
  ENTREPRISE: '#1678bd',
  ETABLISSEMENT: '#15985b',
}

const METRIC_LABELS: Record<GeoMetric, string> = {
  SOLD: 'Brioches vendues',
  DONATIONS: 'Dons reçus',
  FLOW: "Taux d'écoulement",
  POINTS: 'Points de vente',
}

const MAP_BOUNDS: [[number, number], [number, number]] = [
  [5.48, 48.28],
  [6.98, 49.62],
]

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(
    Math.round(value),
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function rawValue(
  value: unknown,
  key: string,
): string {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return ''
  }

  return String(
    (value as Record<string, unknown>)[key] ?? '',
  ).trim()
}

function numberValue(
  value: unknown,
  key: string,
) {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return 0
  }

  const parsed = Number(
    (value as Record<string, unknown>)[key] ?? 0,
  )

  return Number.isFinite(parsed) ? parsed : 0
}

function getFicheTotal(fiche: unknown) {
  const billets =
    numberValue(fiche, 'billets100') * 100 +
    numberValue(fiche, 'billets50') * 50 +
    numberValue(fiche, 'billets20') * 20 +
    numberValue(fiche, 'billets10') * 10 +
    numberValue(fiche, 'billets5') * 5

  const pieces =
    numberValue(fiche, 'pieces2') * 2 +
    numberValue(fiche, 'pieces1') +
    numberValue(fiche, 'pieces050') * 0.5 +
    numberValue(fiche, 'pieces020') * 0.2 +
    numberValue(fiche, 'pieces010') * 0.1 +
    numberValue(fiche, 'pieces005') * 0.05 +
    numberValue(fiche, 'pieces002') * 0.02 +
    numberValue(fiche, 'pieces001') * 0.01

  const dons =
    numberValue(fiche, 'nbDons5') * 5 +
    numberValue(fiche, 'nbDons3') * 3 +
    numberValue(fiche, 'montantDonsAutres')

  return (
    billets +
    pieces +
    numberValue(fiche, 'montantCheques') +
    numberValue(fiche, 'montantTpe') +
    numberValue(fiche, 'montantVirement') +
    dons
  )
}

function safeDate(
  value: string | undefined | null,
): string {
  if (!value) {
    return ''
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : ''
}

function getInitialMode(pathname: string): GeoMapMode {
  if (pathname.includes('/secteurs')) return 'SECTORS'
  if (pathname.includes('/comparaison')) return 'COMPARISON'
  if (pathname.includes('/couverture')) return 'POINTS'
  return 'HEATMAP'
}

function metricValue(
  point: GeoSalePoint,
  metric: GeoMetric,
) {
  if (metric === 'DONATIONS') {
    return point.donations
  }

  if (metric === 'FLOW') {
    if (
      point.sold === null ||
      point.entrusted === null ||
      point.entrusted <= 0
    ) {
      return 0
    }

    return Math.min(
      100,
      (point.sold / point.entrusted) * 100,
    )
  }

  if (metric === 'POINTS') {
    return 1
  }

  return point.sold ?? 0
}

function styleDefinition() {
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution:
          '© OpenStreetMap contributors',
      },

      satellite: {
        type: 'raster' as const,
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution:
          'Tiles © Esri',
      },
    },

    layers: [
      {
        id: 'osm',
        type: 'raster' as const,
        source: 'osm',
      },
      {
        id: 'satellite',
        type: 'raster' as const,
        source: 'satellite',
        layout: {
          visibility: 'none' as const,
        },
      },
    ],
  }
}

function buildFeatureCollection(
  points: GeoSalePoint[],
  metric: GeoMetric,
) {
  return {
    type: 'FeatureCollection',
    features: points
      .filter(
        (point) =>
          point.longitude !== null &&
          point.latitude !== null,
      )
      .map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            point.longitude as number,
            point.latitude as number,
          ],
        },
        properties: {
          id: point.id,
          name: point.name,
          city: point.city,
          sector: point.sector,
          channel: point.channel,
          channelLabel: CHANNEL_LABELS[point.channel],
          channelColor: CHANNEL_COLORS[point.channel],
          sold: point.sold ?? 0,
          donations: point.donations,
          entrusted: point.entrusted ?? 0,
          metricValue: metricValue(point, metric),
          estimated: point.estimatedSold ? 1 : 0,
        },
      })),
  }
}

function buildSectorCollection(
  sectors: GeoSectorSummary[],
  metric: GeoMetric,
) {
  return {
    type: 'FeatureCollection',
    features: sectors
      .filter(
        (sector) =>
          sector.longitude !== null &&
          sector.latitude !== null,
      )
      .map((sector) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            sector.longitude as number,
            sector.latitude as number,
          ],
        },
        properties: {
          id: sector.sector,
          sector: sector.sector,
          sold: sector.sold,
          donations: sector.donations,
          flow: sector.flow ?? 0,
          points: sector.points,
          metricValue:
            metric === 'DONATIONS'
              ? sector.donations
              : metric === 'FLOW'
                ? sector.flow ?? 0
                : metric === 'POINTS'
                  ? sector.points
                  : sector.sold,
        },
      })),
  }
}

function addDataLayers(map: MapLibreMap) {
  if (!map.getSource('geo-sales')) {
    map.addSource('geo-sales', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    })
  }

  if (!map.getSource('geo-sectors')) {
    map.addSource('geo-sectors', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    })
  }

  if (!map.getLayer('sales-heat')) {
    map.addLayer({
      id: 'sales-heat',
      type: 'heatmap',
      source: 'geo-sales',
      maxzoom: 14,
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'metricValue'],
          0,
          0,
          2500,
          1,
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          0.65,
          11,
          1.2,
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          22,
          11,
          42,
        ],
        'heatmap-opacity': 0.72,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(32,112,180,0)',
          0.18,
          '#3dbb8a',
          0.38,
          '#b9df5a',
          0.58,
          '#ffd64b',
          0.78,
          '#ff8a32',
          1,
          '#c91e3c',
        ],
      },
    })
  }

  if (!map.getLayer('sales-points-halo')) {
    map.addLayer({
      id: 'sales-points-halo',
      type: 'circle',
      source: 'geo-sales',
      paint: {
        'circle-radius': 8,
        'circle-color': '#ffffff',
        'circle-opacity': 0.95,
      },
    })
  }

  if (!map.getLayer('sales-points')) {
    map.addLayer({
      id: 'sales-points',
      type: 'circle',
      source: 'geo-sales',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'metricValue'],
          0,
          4,
          2000,
          9,
        ],
        'circle-color': [
          'match',
          ['get', 'channel'],
          'STAND',
          CHANNEL_COLORS.STAND,
          'MAIRIE_RS',
          CHANNEL_COLORS.MAIRIE_RS,
          'ENTREPRISE',
          CHANNEL_COLORS.ENTREPRISE,
          'ETABLISSEMENT',
          CHANNEL_COLORS.ETABLISSEMENT,
          '#516579',
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  if (!map.getLayer('sector-bubbles')) {
    map.addLayer({
      id: 'sector-bubbles',
      type: 'circle',
      source: 'geo-sectors',
      layout: {
        visibility: 'none',
      },
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'metricValue'],
          0,
          12,
          5000,
          35,
        ],
        'circle-color': '#f47a19',
        'circle-opacity': 0.74,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  if (!map.getLayer('sector-labels')) {
    map.addLayer({
      id: 'sector-labels',
      type: 'symbol',
      source: 'geo-sectors',
      layout: {
        visibility: 'none',
        'text-field': ['get', 'sector'],
        'text-size': 12,
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#123e73',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    })
  }
}

export default function Geographie() {
  const location = useLocation()

  const {
    commandes,
    donateurs,
    fichesCaisse,
    campagnes,
  } = useObData()

  const { mairies } = useMairies()
  const { commandes: commandesMairiesRs } =
    useCommandesMairiesRs()

  const { etablissements } = useEtablissements()

  const mapContainerRef =
    useRef<HTMLDivElement | null>(null)

  const mapRef =
    useRef<MapLibreMap | null>(null)

  const [mapMode, setMapMode] =
    useState<GeoMapMode>(() =>
      getInitialMode(location.pathname),
    )

  const [metric, setMetric] =
    useState<GeoMetric>('SOLD')

  const [baseMap, setBaseMap] =
    useState<BaseMap>('CARTE')

  const [panelTab, setPanelTab] =
    useState<PanelTab>('ANALYSE')

  const [search, setSearch] =
    useState('')

  const [sectorFilter, setSectorFilter] =
    useState('TOUS')

  const [
    enabledChannels,
    setEnabledChannels,
  ] = useState<Record<GeoChannel, boolean>>({
    STAND: true,
    MAIRIE_RS: true,
    ENTREPRISE: true,
    ETABLISSEMENT: true,
  })

  const [selectedId, setSelectedId] =
    useState<string | null>(null)

  const [
    coordinateVersion,
    setCoordinateVersion,
  ] = useState(0)

  const [
    geocodingCount,
    setGeocodingCount,
  ] = useState(0)

  const campaigns = useMemo(() => {
    const values = new Set<string>()

    commandes.forEach((item) => {
      if (item.campagne) {
        values.add(item.campagne)
      }
    })

    fichesCaisse.forEach((item) => {
      if (item.campagne) {
        values.add(item.campagne)
      }
    })

    commandesMairiesRs.forEach((item) => {
      if (item.campagne) {
        values.add(item.campagne)
      }
    })

    campagnes.forEach((item) => {
      if (item.id) values.add(item.id)
    })

    return [...values].sort((a, b) =>
      b.localeCompare(a, 'fr', {
        numeric: true,
      }),
    )
  }, [
    commandes,
    fichesCaisse,
    commandesMairiesRs,
    campagnes,
  ])

  const [campaignFilter, setCampaignFilter] =
    useState(
      campaigns.includes('OB 2026')
        ? 'OB 2026'
        : campaigns[0] || 'TOUTES',
    )

  useEffect(() => {
    setMapMode(
      getInitialMode(location.pathname),
    )
  }, [location.pathname])

  const priceByCampaign =
    useMemo(() => {
      const map = new Map<string, number>()

      for (const campagne of campagnes) {
        const price = Number(
          campagne.prixUnitaire ?? 0,
        )

        if (price > 0) {
          map.set(campagne.id, price)
        }
      }

      return map
    }, [campagnes])

  const mairieById =
    useMemo(
      () =>
        new Map(
          mairies.map((mairie) => [
            mairie.id,
            mairie,
          ]),
        ),
      [mairies],
    )

  const rawPoints = useMemo<GeoSalePoint[]>(
    () => {
      const points: GeoSalePoint[] = []

      for (const order of commandesMairiesRs) {
        if (
          campaignFilter !== 'TOUTES' &&
          order.campagne !== campaignFilter
        ) {
          continue
        }

        if (order.statut === 'ANNULEE') {
          continue
        }

        const mairie =
          order.mairieId
            ? mairieById.get(order.mairieId)
            : undefined

        const city =
          mairie?.ville ||
          mairie?.commune ||
          ''

        const address = mairie
          ? [
              mairie.numeroVoie,
              mairie.adresse,
            ]
              .filter(Boolean)
              .join(' ')
          : ''

        const cached =
          getCachedCoordinate({
            address,
            postalCode: mairie?.cp,
            city,
            label: order.quiPasseCommande,
          })

        points.push({
          id: `mr-${order.id}`,
          sourceId: order.id,
          sourceType: 'COMMANDE_MAIRIE_RS',
          campaign: order.campagne,
          channel: 'MAIRIE_RS',
          name: order.quiPasseCommande,
          address,
          postalCode: mairie?.cp || '',
          city,
          sector:
            order.secteur ||
            mairie?.secteur ||
            'Non renseigné',
          date:
            safeDate(order.dateRecuperation) ||
            order.createdAt.slice(0, 10),
          entrusted: order.quantite,
          sold:
            order.nombreBriochesVendues,
          donations: order.donRecu ?? 0,
          estimatedSold: false,
          estimateNote:
            order.nombreBriochesVendues === null
              ? 'Vente réelle non encore renseignée'
              : '',
          longitude:
            cached?.longitude ?? null,
          latitude:
            cached?.latitude ?? null,
        })
      }

      for (const fiche of fichesCaisse) {
        if (
          campaignFilter !== 'TOUTES' &&
          fiche.campagne !== campaignFilter
        ) {
          continue
        }

        const channel: GeoChannel | null =
          fiche.type === 'STAND'
            ? 'STAND'
            : fiche.type === 'ETABLISSEMENT'
              ? 'ETABLISSEMENT'
              : null

        if (!channel) continue

        const price =
          priceByCampaign.get(
            fiche.campagne,
          ) || 5

        const total =
          getFicheTotal(fiche)

        const estimatedSold =
          price > 0
            ? Math.round(total / price)
            : null

        const cached =
          getCachedCoordinate({
            postalCode: fiche.cp,
            city: fiche.ville,
            label: fiche.libelle,
          })

        points.push({
          id: `fiche-${fiche.id}`,
          sourceId: String(fiche.id),
          sourceType: 'FICHE_CAISSE',
          campaign: fiche.campagne,
          channel,
          name:
            fiche.libelle ||
            (channel === 'STAND'
              ? 'Stand'
              : 'Établissement'),
          address: '',
          postalCode: fiche.cp || '',
          city: fiche.ville || '',
          sector:
            fiche.secteur ||
            fiche.ville ||
            'Non renseigné',
          date: fiche.date,
          entrusted: null,
          sold: estimatedSold,
          donations: total,
          estimatedSold: true,
          estimateNote:
            'Volume estimé depuis les encaissements de la fiche de caisse et le prix unitaire de campagne.',
          longitude:
            cached?.longitude ?? null,
          latitude:
            cached?.latitude ?? null,
        })
      }

      const donorMap = new Map(
        donateurs.map((donateur) => [
          donateur.id,
          donateur,
        ]),
      )

      for (const order of commandes) {
        if (
          campaignFilter !== 'TOUTES' &&
          order.campagne !== campaignFilter
        ) {
          continue
        }

        if (order.statut === 'ANNULEE') {
          continue
        }

        const donor =
          donorMap.get(order.donateurId)

        if (!donor) continue

        const delivered =
          order.statut === 'LIVREE' ||
          Boolean(order.dateLivraison)

        const cached =
          getCachedCoordinate({
            address: donor.adresse,
            postalCode: donor.cp,
            city: donor.ville,
            label: donor.nom,
          })

        points.push({
          id: `ent-${order.id}`,
          sourceId: String(order.id),
          sourceType: 'COMMANDE_ENTREPRISE',
          campaign: order.campagne,
          channel: 'ENTREPRISE',
          name: donor.nom,
          address: donor.adresse || '',
          postalCode: donor.cp || '',
          city: donor.ville || '',
          sector:
            rawValue(donor, 'secteur') ||
            rawValue(
              donor,
              'responsableSecteur',
            ) ||
            donor.ville ||
            'Non renseigné',
          date:
            safeDate(order.dateLivraison) ||
            safeDate(order.dateCommande),
          entrusted: order.quantite,
          sold: delivered
            ? order.quantite
            : null,
          donations: delivered
            ? Number(order.quantite || 0) *
              Number(order.prixUnitaire || 0)
            : 0,
          estimatedSold: true,
          estimateNote:
            delivered
              ? 'Le volume livré est utilisé comme volume de référence. Il ne s’agit pas d’une vente terrain mesurée.'
              : 'Commande non livrée : aucun volume réalisé comptabilisé.',
          longitude:
            cached?.longitude ?? null,
          latitude:
            cached?.latitude ?? null,
        })
      }

      // Les établissements sans fiche de caisse apparaissent
      // en couverture territoriale avec un volume nul.
      if (
        location.pathname.includes(
          '/couverture',
        )
      ) {
        for (const item of etablissements) {
          if (
            item.statut !== 'ACTIF' ||
            !item.participeOperationBrioches
          ) {
            continue
          }

          const id = `etab-ref-${item.id}`

          if (
            points.some(
              (point) =>
                point.channel ===
                  'ETABLISSEMENT' &&
                normalize(point.name) ===
                  normalize(item.nom),
            )
          ) {
            continue
          }

          const cached =
            getCachedCoordinate({
              address: item.adresse,
              postalCode:
                item.codePostal,
              city: item.ville,
              label: item.nom,
            })

          points.push({
            id,
            sourceId: item.id,
            sourceType:
              'ETABLISSEMENT_REF',
            campaign:
              campaignFilter === 'TOUTES'
                ? campaigns[0] || ''
                : campaignFilter,
            channel: 'ETABLISSEMENT',
            name: item.nom,
            address: item.adresse,
            postalCode:
              item.codePostal,
            city: item.ville,
            sector:
              item.secteur ||
              item.ville ||
              'Non renseigné',
            date: '',
            entrusted: null,
            sold: null,
            donations: 0,
            estimatedSold: false,
            estimateNote:
              'Point de couverture sans donnée de vente associée.',
            longitude:
              cached?.longitude ?? null,
            latitude:
              cached?.latitude ?? null,
          })
        }
      }

      return points
    },
    [
      commandesMairiesRs,
      mairieById,
      campaignFilter,
      fichesCaisse,
      priceByCampaign,
      donateurs,
      commandes,
      etablissements,
      location.pathname,
      campaigns,
      coordinateVersion,
    ],
  )

  useEffect(() => {
    let cancelled = false

    const missing = rawPoints.filter(
      (point) =>
        point.longitude === null ||
        point.latitude === null,
    )

    if (!missing.length) {
      setGeocodingCount(0)
      return
    }

    async function run() {
      const unique = new Map<
        string,
        GeoSalePoint
      >()

      for (const point of missing) {
        const key = geoKey({
          address: point.address,
          postalCode: point.postalCode,
          city: point.city,
          label: point.name,
        })

        if (key && !unique.has(key)) {
          unique.set(key, point)
        }
      }

      setGeocodingCount(unique.size)

      let resolved = 0

      for (const point of unique.values()) {
        if (cancelled) return

        const coordinate =
          await geocodeFrenchLocation({
            address: point.address,
            postalCode:
              point.postalCode,
            city: point.city,
            label: point.name,
          })

        if (coordinate) {
          resolved += 1
        }

        if (!cancelled) {
          setGeocodingCount(
            Math.max(
              0,
              unique.size - resolved,
            ),
          )
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, 90),
        )
      }

      if (!cancelled && resolved > 0) {
        setCoordinateVersion(
          (value) => value + 1,
        )
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [rawPoints])

  const sectors =
    useMemo(
      () =>
        [
          ...new Set(
            rawPoints
              .map((point) =>
                point.sector.trim(),
              )
              .filter(Boolean),
          ),
        ].sort((a, b) =>
          a.localeCompare(b, 'fr'),
        ),
      [rawPoints],
    )

  const filteredPoints =
    useMemo(() => {
      const query =
        normalizeGeoText(search)

      return rawPoints
        .filter(
          (point) =>
            enabledChannels[
              point.channel
            ],
        )
        .filter(
          (point) =>
            sectorFilter ===
              'TOUS' ||
            point.sector ===
              sectorFilter,
        )
        .filter((point) => {
          if (!query) return true

          return normalizeGeoText(
            [
              point.name,
              point.city,
              point.sector,
              CHANNEL_LABELS[
                point.channel
              ],
            ].join(' '),
          ).includes(query)
        })
    }, [
      rawPoints,
      enabledChannels,
      sectorFilter,
      search,
    ])

  const locatedPoints =
    useMemo(
      () =>
        filteredPoints.filter(
          (point) =>
            point.longitude !==
              null &&
            point.latitude !==
              null,
        ),
      [filteredPoints],
    )

  const selected =
    selectedId
      ? rawPoints.find(
          (point) =>
            point.id ===
            selectedId,
        ) || null
      : null

  const summaries =
    useMemo<GeoSectorSummary[]>(
      () => {
        const groups =
          new Map<
            string,
            {
              points: GeoSalePoint[]
              sold: number
              donations: number
              entrusted: number
            }
          >()

        for (const point of filteredPoints) {
          const key =
            point.sector ||
            'Non renseigné'

          const current =
            groups.get(key) || {
              points: [],
              sold: 0,
              donations: 0,
              entrusted: 0,
            }

          current.points.push(point)
          current.sold +=
            point.sold ?? 0
          current.donations +=
            point.donations
          current.entrusted +=
            point.entrusted ?? 0

          groups.set(key, current)
        }

        return [...groups.entries()]
          .map(
            ([
              sector,
              group,
            ]): GeoSectorSummary => {
              const withCoordinates =
                group.points.filter(
                  (point) =>
                    point.longitude !==
                      null &&
                    point.latitude !==
                      null,
                )

              const longitude =
                withCoordinates.length
                  ? withCoordinates.reduce(
                      (sum, point) =>
                        sum +
                        (point.longitude ??
                          0),
                      0,
                    ) /
                    withCoordinates.length
                  : null

              const latitude =
                withCoordinates.length
                  ? withCoordinates.reduce(
                      (sum, point) =>
                        sum +
                        (point.latitude ??
                          0),
                      0,
                    ) /
                    withCoordinates.length
                  : null

              return {
                sector,
                points:
                  group.points.length,
                sold: group.sold,
                donations:
                  group.donations,
                entrusted:
                  group.entrusted,
                flow:
                  group.entrusted > 0
                    ? Math.min(
                        100,
                        (group.sold /
                          group.entrusted) *
                          100,
                      )
                    : null,
                longitude,
                latitude,
              }
            },
          )
          .sort(
            (a, b) =>
              b.sold - a.sold ||
              b.donations -
                a.donations,
          )
      },
      [filteredPoints],
    )

  const totals = useMemo(() => {
    const sold =
      filteredPoints.reduce(
        (sum, point) =>
          sum + (point.sold ?? 0),
        0,
      )

    const donations =
      filteredPoints.reduce(
        (sum, point) =>
          sum + point.donations,
        0,
      )

    const entrusted =
      filteredPoints.reduce(
        (sum, point) =>
          sum +
          (point.entrusted ?? 0),
        0,
      )

    const flow =
      entrusted > 0
        ? Math.min(
            100,
            (sold / entrusted) *
              100,
          )
        : null

    return {
      points: filteredPoints.length,
      sold,
      donations,
      entrusted,
      flow,
    }
  }, [filteredPoints])

  const byChannel = useMemo(
    () =>
      (
        Object.keys(
          CHANNEL_LABELS,
        ) as GeoChannel[]
      )
        .map((channel) => {
          const items =
            filteredPoints.filter(
              (point) =>
                point.channel ===
                channel,
            )

          return {
            channel,
            points: items.length,
            sold: items.reduce(
              (sum, point) =>
                sum +
                (point.sold ?? 0),
              0,
            ),
            donations:
              items.reduce(
                (sum, point) =>
                  sum +
                  point.donations,
                0,
              ),
          }
        })
        .sort(
          (a, b) =>
            b.sold - a.sold,
        ),
    [filteredPoints],
  )

  const dominantChannel =
    byChannel[0]

  useEffect(() => {
    if (
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return
    }

    const map = new maplibregl.Map({
      container:
        mapContainerRef.current,
      style: styleDefinition(),
      center: [6.13, 48.96],
      zoom: 8.15,
      minZoom: 6.5,
      maxZoom: 16,
      maxBounds: MAP_BOUNDS,
      attributionControl: {
        compact: true,
      },
    })

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      'top-left',
    )

    map.addControl(
      new maplibregl.FullscreenControl(),
      'top-left',
    )

    map.on('load', () => {
      addDataLayers(map)
      setCoordinateVersion(
        (value) => value + 1,
      )
    })

    const clickHandler = (
      event: MapMouseEvent,
    ) => {
      const features =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              'sales-points',
              'sector-bubbles',
            ].filter((id) =>
              Boolean(map.getLayer(id)),
            ),
          },
        )

      const feature =
        features[0]

      if (!feature?.properties) {
        return
      }

      if (
        feature.layer.id ===
        'sector-bubbles'
      ) {
        setSectorFilter(
          String(
            feature.properties.sector ||
              'TOUS',
          ),
        )
        setPanelTab('ANALYSE')
        return
      }

      const id =
        String(
          feature.properties.id ||
            '',
        )

      if (id) {
        setSelectedId(id)
        setPanelTab('DETAILS')
      }
    }

    map.on('click', clickHandler)

    map.on(
      'mouseenter',
      'sales-points',
      () => {
        map.getCanvas().style.cursor =
          'pointer'
      },
    )

    map.on(
      'mouseleave',
      'sales-points',
      () => {
        map.getCanvas().style.cursor =
          ''
      },
    )

    mapRef.current = map

    return () => {
      map.off(
        'click',
        clickHandler,
      )
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    const source =
      map.getSource(
        'geo-sales',
      ) as
        | GeoJSONSource
        | undefined

    source?.setData(
      buildFeatureCollection(
        locatedPoints,
        metric,
      ) as never,
    )

    const sectorSource =
      map.getSource(
        'geo-sectors',
      ) as
        | GeoJSONSource
        | undefined

    sectorSource?.setData(
      buildSectorCollection(
        summaries,
        metric,
      ) as never,
    )

    const values =
      locatedPoints.map((point) =>
        metricValue(
          point,
          metric,
        ),
      )

    const max =
      Math.max(
        1,
        ...values,
      )

    if (
      map.getLayer(
        'sales-heat',
      )
    ) {
      map.setPaintProperty(
        'sales-heat',
        'heatmap-weight',
        [
          'interpolate',
          ['linear'],
          ['get', 'metricValue'],
          0,
          0,
          max,
          1,
        ],
      )

      map.setLayoutProperty(
        'sales-heat',
        'visibility',
        mapMode === 'HEATMAP'
          ? 'visible'
          : 'none',
      )
    }

    const pointVisibility =
      mapMode === 'SECTORS'
        ? 'none'
        : 'visible'

    for (const id of [
      'sales-points',
      'sales-points-halo',
    ]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          'visibility',
          pointVisibility,
        )
      }
    }

    for (const id of [
      'sector-bubbles',
      'sector-labels',
    ]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          'visibility',
          mapMode === 'SECTORS'
            ? 'visible'
            : 'none',
        )
      }
    }
  }, [
    locatedPoints,
    summaries,
    metric,
    mapMode,
    coordinateVersion,
  ])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !map.isStyleLoaded()) {
      return
    }

    if (map.getLayer('osm')) {
      map.setLayoutProperty(
        'osm',
        'visibility',
        baseMap === 'CARTE'
          ? 'visible'
          : 'none',
      )
    }

    if (
      map.getLayer(
        'satellite',
      )
    ) {
      map.setLayoutProperty(
        'satellite',
        'visibility',
        baseMap === 'SATELLITE'
          ? 'visible'
          : 'none',
      )
    }
  }, [baseMap])

  function toggleChannel(
    channel: GeoChannel,
  ) {
    setEnabledChannels(
      (current) => ({
        ...current,
        [channel]:
          !current[channel],
      }),
    )
  }

  function focusPoint(
    point: GeoSalePoint,
  ) {
    setSelectedId(point.id)
    setPanelTab('DETAILS')

    if (
      point.longitude !== null &&
      point.latitude !== null
    ) {
      mapRef.current?.flyTo({
        center: [
          point.longitude,
          point.latitude,
        ],
        zoom: 12,
        essential: true,
      })
    }
  }

  function resetMap() {
    setSearch('')
    setSectorFilter('TOUS')
    setEnabledChannels({
      STAND: true,
      MAIRIE_RS: true,
      ENTREPRISE: true,
      ETABLISSEMENT: true,
    })

    mapRef.current?.fitBounds(
      MAP_BOUNDS,
      {
        padding: 35,
        duration: 800,
      },
    )
  }

  function searchFirst() {
    const query =
      normalizeGeoText(search)

    if (!query) return

    const match =
      locatedPoints.find(
        (point) =>
          normalizeGeoText(
            [
              point.name,
              point.city,
              point.sector,
            ].join(' '),
          ).includes(query),
      )

    if (match) {
      focusPoint(match)
    }
  }

  const estimatedCount =
    filteredPoints.filter(
      (point) =>
        point.estimatedSold &&
        point.sold !== null,
    ).length

  const unresolvedCount =
    filteredPoints.length -
    locatedPoints.length

  const topPoints =
    [...filteredPoints]
      .sort(
        (a, b) =>
          metricValue(b, metric) -
          metricValue(a, metric),
      )
      .slice(0, 8)

  return (
    <main className="geo-page">
      <header className="geo-header">
        <div>
          <span className="geo-eyebrow">
            Analyse territoriale
          </span>

          <h1>
            Géographie — Carte des ventes
          </h1>

          <p>
            Visualisez où les brioches se vendent le mieux
            et identifiez les conditions de succès sur le territoire,
            jusqu’au secteur Briey / Longwy.
          </p>
        </div>

        <div className="geo-header-controls">
          <select
            value={campaignFilter}
            onChange={(event) =>
              setCampaignFilter(
                event.target.value,
              )
            }
          >
            <option value="TOUTES">
              Toutes les campagnes
            </option>

            {campaigns.map(
              (campaign) => (
                <option
                  key={campaign}
                  value={campaign}
                >
                  {campaign}
                </option>
              ),
            )}
          </select>

          <select
            value={metric}
            onChange={(event) =>
              setMetric(
                event.target
                  .value as GeoMetric,
              )
            }
          >
            {(
              Object.keys(
                METRIC_LABELS,
              ) as GeoMetric[]
            ).map((key) => (
              <option
                key={key}
                value={key}
              >
                {METRIC_LABELS[key]}
              </option>
            ))}
          </select>

          <select
            value={sectorFilter}
            onChange={(event) =>
              setSectorFilter(
                event.target.value,
              )
            }
          >
            <option value="TOUS">
              Tous les secteurs
            </option>

            {sectors.map(
              (sector) => (
                <option
                  key={sector}
                  value={sector}
                >
                  {sector}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className="geo-reset"
            onClick={resetMap}
          >
            <RefreshCw size={16} />
            Réinitialiser
          </button>
        </div>
      </header>

      <nav className="geo-mode-tabs">
        <ModeButton
          active={
            mapMode === 'HEATMAP'
          }
          onClick={() =>
            setMapMode('HEATMAP')
          }
          icon={<Flame size={17} />}
        >
          Heatmap
        </ModeButton>

        <ModeButton
          active={
            mapMode === 'POINTS'
          }
          onClick={() =>
            setMapMode('POINTS')
          }
          icon={<MapPin size={17} />}
        >
          Points de vente
        </ModeButton>

        <ModeButton
          active={
            mapMode === 'SECTORS'
          }
          onClick={() =>
            setMapMode('SECTORS')
          }
          icon={<MapIcon size={17} />}
        >
          Secteurs
        </ModeButton>

        <ModeButton
          active={
            mapMode ===
            'COMPARISON'
          }
          onClick={() =>
            setMapMode('COMPARISON')
          }
          icon={
            <BarChart3 size={17} />
          }
        >
          Comparaison
        </ModeButton>
      </nav>

      <section className="geo-kpis">
        <Kpi
          icon={
            <UsersRound size={22} />
          }
          tone="green"
          label="Points actifs"
          value={formatNumber(
            totals.points,
          )}
          subtitle={`${locatedPoints.length} localisés sur la carte`}
        />

        <Kpi
          icon={<Store size={22} />}
          tone="blue"
          label="Brioches vendues"
          value={formatNumber(
            totals.sold,
          )}
          subtitle={
            estimatedCount
              ? `${estimatedCount} point(s) comportent une estimation`
              : 'ventes saisies dans les modules métiers'
          }
        />

        <Kpi
          icon={
            <TrendingUp size={22} />
          }
          tone="orange"
          label="Taux d'écoulement"
          value={
            totals.flow === null
              ? '—'
              : `${Math.round(totals.flow)} %`
          }
          subtitle="vendu / confié lorsque les deux valeurs sont connues"
        />

        <Kpi
          icon={
            <CircleDollarSign
              size={22}
            />
          }
          tone="red"
          label="Dons reçus"
          value={formatMoney(
            totals.donations,
          )}
          subtitle="sur la sélection actuelle"
        />
      </section>

      <section
        className={`geo-workspace ${
          mapMode ===
          'COMPARISON'
            ? 'comparison'
            : ''
        }`}
      >
        <div className="geo-map-card">
          <div className="geo-map-toolbar">
            <label className="geo-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    searchFirst()
                  }
                }}
                placeholder="Rechercher une commune, un point de vente..."
              />
            </label>

            <div className="geo-map-switch">
              <button
                type="button"
                className={
                  baseMap ===
                  'CARTE'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setBaseMap('CARTE')
                }
              >
                Carte
              </button>
              <button
                type="button"
                className={
                  baseMap ===
                  'SATELLITE'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setBaseMap(
                    'SATELLITE',
                  )
                }
              >
                Satellite
              </button>
            </div>
          </div>

          <div className="geo-channel-bar">
            {(
              Object.keys(
                CHANNEL_LABELS,
              ) as GeoChannel[]
            ).map((channel) => (
              <button
                type="button"
                key={channel}
                className={
                  enabledChannels[
                    channel
                  ]
                    ? 'enabled'
                    : ''
                }
                onClick={() =>
                  toggleChannel(
                    channel,
                  )
                }
              >
                <span
                  className="geo-channel-dot"
                  style={{
                    background:
                      CHANNEL_COLORS[
                        channel
                      ],
                  }}
                />

                {enabledChannels[
                  channel
                ] && (
                  <Check size={13} />
                )}

                {
                  CHANNEL_LABELS[
                    channel
                  ]
                }
              </button>
            ))}
          </div>

          <div
            className="geo-map"
            ref={mapContainerRef}
          />

          <div className="geo-map-overlay geo-map-legend">
            <strong>
              {METRIC_LABELS[metric]}
            </strong>
            <div className="geo-gradient" />
            <div>
              <span>Faible</span>
              <span>Très élevé</span>
            </div>
          </div>

          <div className="geo-map-overlay geo-map-status">
            <LocateFixed size={15} />
            <span>
              {locatedPoints.length}{' '}
              point(s) localisé(s)
            </span>

            {unresolvedCount > 0 && (
              <em>
                {unresolvedCount}{' '}
                à localiser
              </em>
            )}

            {geocodingCount > 0 && (
              <em>
                Géocodage…
              </em>
            )}
          </div>

          <div className="geo-map-footer-legend">
            {(
              Object.keys(
                CHANNEL_LABELS,
              ) as GeoChannel[]
            ).map((channel) => (
              <span key={channel}>
                <i
                  style={{
                    background:
                      CHANNEL_COLORS[
                        channel
                      ],
                  }}
                />
                {
                  CHANNEL_LABELS[
                    channel
                  ]
                }
              </span>
            ))}
          </div>
        </div>

        <aside className="geo-analysis">
          <nav className="geo-panel-tabs">
            <button
              type="button"
              className={
                panelTab ===
                'ANALYSE'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setPanelTab(
                  'ANALYSE',
                )
              }
            >
              Analyse
            </button>

            <button
              type="button"
              className={
                panelTab ===
                'DETAILS'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setPanelTab(
                  'DETAILS',
                )
              }
            >
              Détails
            </button>

            <button
              type="button"
              className={
                panelTab ===
                'LISTE'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setPanelTab(
                  'LISTE',
                )
              }
            >
              Liste
            </button>
          </nav>

          {panelTab ===
            'ANALYSE' && (
            <div className="geo-analysis-body">
              <section className="geo-zone-title">
                <MapPin size={18} />
                <div>
                  <small>
                    Zone affichée
                  </small>
                  <strong>
                    {sectorFilter ===
                    'TOUS'
                      ? 'Meurthe-et-Moselle (54)'
                      : sectorFilter}
                  </strong>
                </div>
              </section>

              <div className="geo-mini-kpis">
                <MiniKpi
                  label="Brioches vendues"
                  value={formatNumber(
                    totals.sold,
                  )}
                />
                <MiniKpi
                  label="Taux moyen"
                  value={
                    totals.flow ===
                    null
                      ? '—'
                      : `${Math.round(totals.flow)} %`
                  }
                />
                <MiniKpi
                  label="Dons totaux"
                  value={formatMoney(
                    totals.donations,
                  )}
                />
                <MiniKpi
                  label="Canal dominant"
                  value={
                    dominantChannel
                      ? CHANNEL_LABELS[
                          dominantChannel
                            .channel
                        ]
                      : '—'
                  }
                />
              </div>

              <section className="geo-analysis-section">
                <header>
                  <h3>
                    Top 5 des secteurs
                  </h3>
                  <span>
                    par{' '}
                    {
                      METRIC_LABELS[
                        metric
                      ]
                    }
                  </span>
                </header>

                <div className="geo-ranking">
                  {summaries
                    .slice(0, 5)
                    .map(
                      (
                        sector,
                        index,
                      ) => {
                        const value =
                          metric ===
                          'DONATIONS'
                            ? sector.donations
                            : metric ===
                                'FLOW'
                              ? sector.flow ??
                                0
                              : metric ===
                                  'POINTS'
                                ? sector.points
                                : sector.sold

                        const topValue =
                          summaries
                            .length
                            ? metric ===
                              'DONATIONS'
                              ? summaries[0]
                                  .donations
                              : metric ===
                                  'FLOW'
                                ? summaries[0]
                                    .flow ??
                                  1
                                : metric ===
                                    'POINTS'
                                  ? summaries[0]
                                      .points
                                  : summaries[0]
                                      .sold
                            : 1

                        const width =
                          topValue > 0
                            ? Math.max(
                                6,
                                (value /
                                  topValue) *
                                  100,
                              )
                            : 0

                        return (
                          <button
                            type="button"
                            key={
                              sector.sector
                            }
                            onClick={() => {
                              setSectorFilter(
                                sector.sector,
                              )

                              if (
                                sector.longitude !==
                                  null &&
                                sector.latitude !==
                                  null
                              ) {
                                mapRef.current?.flyTo(
                                  {
                                    center:
                                      [
                                        sector.longitude,
                                        sector.latitude,
                                      ],
                                    zoom: 10,
                                  },
                                )
                              }
                            }}
                          >
                            <b>
                              {index + 1}
                            </b>

                            <strong>
                              {
                                sector.sector
                              }
                            </strong>

                            <span className="geo-rank-track">
                              <i
                                style={{
                                  width: `${width}%`,
                                }}
                              />
                            </span>

                            <em>
                              {metric ===
                              'DONATIONS'
                                ? formatMoney(
                                    value,
                                  )
                                : metric ===
                                    'FLOW'
                                  ? `${Math.round(value)} %`
                                  : formatNumber(
                                      value,
                                    )}
                            </em>
                          </button>
                        )
                      },
                    )}
                </div>
              </section>

              <section className="geo-analysis-section">
                <header>
                  <h3>
                    Répartition par canal
                  </h3>
                  <span>
                    {formatNumber(
                      totals.sold,
                    )}{' '}
                    brioches
                  </span>
                </header>

                <div className="geo-channel-analysis">
                  {byChannel.map(
                    (row) => {
                      const share =
                        totals.sold > 0
                          ? (row.sold /
                              totals.sold) *
                            100
                          : 0

                      return (
                        <div
                          key={
                            row.channel
                          }
                        >
                          <span
                            className="geo-channel-icon"
                            style={{
                              color:
                                CHANNEL_COLORS[
                                  row.channel
                                ],
                            }}
                          >
                            {row.channel ===
                            'STAND' ? (
                              <Store
                                size={16}
                              />
                            ) : row.channel ===
                              'MAIRIE_RS' ? (
                              <MapPin
                                size={16}
                              />
                            ) : row.channel ===
                              'ENTREPRISE' ? (
                              <UsersRound
                                size={16}
                              />
                            ) : (
                              <Building2
                                size={16}
                              />
                            )}
                          </span>

                          <strong>
                            {
                              CHANNEL_LABELS[
                                row.channel
                              ]
                            }
                          </strong>

                          <em>
                            {formatNumber(
                              row.sold,
                            )}
                          </em>

                          <span className="geo-channel-progress">
                            <i
                              style={{
                                width: `${Math.min(
                                  100,
                                  share,
                                )}%`,
                                background:
                                  CHANNEL_COLORS[
                                    row.channel
                                  ],
                              }}
                            />
                          </span>

                          <b>
                            {Math.round(
                              share,
                            )}
                            %
                          </b>
                        </div>
                      )
                    },
                  )}
                </div>
              </section>

              {mapMode ===
                'COMPARISON' && (
                <section className="geo-analysis-section">
                  <header>
                    <h3>
                      Comparaison des canaux
                    </h3>
                  </header>

                  <div className="geo-compare-table">
                    <div className="head">
                      <span>
                        Canal
                      </span>
                      <span>
                        Points
                      </span>
                      <span>
                        Ventes
                      </span>
                      <span>
                        Dons
                      </span>
                    </div>

                    {byChannel.map(
                      (row) => (
                        <div
                          key={
                            row.channel
                          }
                        >
                          <strong>
                            {
                              CHANNEL_LABELS[
                                row.channel
                              ]
                            }
                          </strong>
                          <span>
                            {
                              row.points
                            }
                          </span>
                          <span>
                            {formatNumber(
                              row.sold,
                            )}
                          </span>
                          <span>
                            {formatMoney(
                              row.donations,
                            )}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {panelTab ===
            'DETAILS' && (
            <div className="geo-analysis-body">
              {selected ? (
                <>
                  <div className="geo-selected-head">
                    <span
                      style={{
                        background:
                          CHANNEL_COLORS[
                            selected.channel
                          ],
                      }}
                    >
                      <MapPin
                        size={19}
                      />
                    </span>

                    <div>
                      <small>
                        {
                          CHANNEL_LABELS[
                            selected.channel
                          ]
                        }
                      </small>
                      <h2>
                        {
                          selected.name
                        }
                      </h2>
                      <p>
                        {[
                          selected.city,
                          selected.sector,
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(' · ') ||
                          'Localisation à préciser'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          null,
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="geo-detail-cards">
                    <Detail
                      label="Brioches confiées"
                      value={
                        selected.entrusted ===
                        null
                          ? '—'
                          : formatNumber(
                              selected.entrusted,
                            )
                      }
                    />

                    <Detail
                      label="Brioches vendues"
                      value={
                        selected.sold ===
                        null
                          ? '—'
                          : `${
                              selected.estimatedSold
                                ? '≈ '
                                : ''
                            }${formatNumber(
                              selected.sold,
                            )}`
                      }
                    />

                    <Detail
                      label="Taux d'écoulement"
                      value={
                        selected.sold !==
                          null &&
                        selected.entrusted !==
                          null &&
                        selected.entrusted >
                          0
                          ? `${Math.round(
                              (selected.sold /
                                selected.entrusted) *
                                100,
                            )} %`
                          : '—'
                      }
                    />

                    <Detail
                      label="Dons / encaissements"
                      value={formatMoney(
                        selected.donations,
                      )}
                    />

                    <Detail
                      label="Campagne"
                      value={
                        selected.campaign ||
                        '—'
                      }
                    />

                    <Detail
                      label="Date"
                      value={
                        selected.date ||
                        '—'
                      }
                    />
                  </div>

                  {selected.estimateNote && (
                    <div className="geo-quality-note">
                      <Eye size={16} />
                      <p>
                        {
                          selected.estimateNote
                        }
                      </p>
                    </div>
                  )}

                  <div className="geo-location-detail">
                    <h3>
                      Localisation
                    </h3>

                    <p>
                      {[
                        selected.address,
                        selected.postalCode,
                        selected.city,
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                        'Adresse non renseignée'}
                    </p>

                    <p>
                      Secteur :{' '}
                      <strong>
                        {
                          selected.sector
                        }
                      </strong>
                    </p>
                  </div>
                </>
              ) : (
                <div className="geo-panel-empty">
                  <MapPin size={28} />
                  <h3>
                    Sélectionnez un point
                  </h3>
                  <p>
                    Cliquez sur un point de la carte ou sur une ligne de la liste pour afficher son détail.
                  </p>
                </div>
              )}
            </div>
          )}

          {panelTab ===
            'LISTE' && (
            <div className="geo-list-panel">
              {topPoints.map(
                (point) => (
                  <button
                    type="button"
                    key={point.id}
                    onClick={() =>
                      focusPoint(
                        point,
                      )
                    }
                  >
                    <span
                      className="geo-list-dot"
                      style={{
                        background:
                          CHANNEL_COLORS[
                            point.channel
                          ],
                      }}
                    />

                    <div>
                      <strong>
                        {point.name}
                      </strong>
                      <small>
                        {point.city ||
                          point.sector}
                      </small>
                    </div>

                    <em>
                      {metric ===
                      'DONATIONS'
                        ? formatMoney(
                            metricValue(
                              point,
                              metric,
                            ),
                          )
                        : metric ===
                            'FLOW'
                          ? `${Math.round(
                              metricValue(
                                point,
                                metric,
                              ),
                            )} %`
                          : formatNumber(
                              metricValue(
                                point,
                                metric,
                              ),
                            )}
                    </em>
                  </button>
                ),
              )}

              {!topPoints.length && (
                <div className="geo-panel-empty">
                  Aucun point pour ces critères.
                </div>
              )}
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={
        active ? 'active' : ''
      }
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}

function Kpi({
  icon,
  tone,
  label,
  value,
  subtitle,
}: {
  icon: ReactNode
  tone:
    | 'green'
    | 'blue'
    | 'orange'
    | 'red'
  label: string
  value: string
  subtitle: string
}) {
  return (
    <article className="geo-kpi">
      <span
        className={`geo-kpi-icon ${tone}`}
      >
        {icon}
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{subtitle}</em>
      </div>
    </article>
  )
}

function MiniKpi({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <article className="geo-mini-kpi">
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <article className="geo-detail">
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  )
}

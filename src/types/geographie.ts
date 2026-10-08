export type GeoChannel =
  | 'STAND'
  | 'MAIRIE_RS'
  | 'ENTREPRISE'
  | 'ETABLISSEMENT'

export type GeoMapMode =
  | 'HEATMAP'
  | 'POINTS'
  | 'SECTORS'
  | 'COMPARISON'

export type GeoMetric =
  | 'SOLD'
  | 'DONATIONS'
  | 'FLOW'
  | 'POINTS'

export type GeoCoordinate = {
  longitude: number
  latitude: number
  label?: string
}

export type GeoSalePoint = {
  id: string
  sourceId: string
  sourceType: string
  campaign: string

  channel: GeoChannel

  name: string
  address: string
  postalCode: string
  city: string
  sector: string

  date: string

  entrusted: number | null
  sold: number | null
  donations: number

  estimatedSold: boolean
  estimateNote: string

  longitude: number | null
  latitude: number | null
}

export type GeoSectorSummary = {
  sector: string
  points: number
  sold: number
  donations: number
  entrusted: number
  flow: number | null
  longitude: number | null
  latitude: number | null
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CarFront, CheckCircle2, ClipboardList, Fuel, MapPin, Plus, Save, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useObData } from '../contexts/ObDataContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useUsers } from '../contexts/UsersContext'
import { usePermissions } from '../contexts/permissionsState'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import {
  communicationId, readAssets, readReservations, reservationCapacityError, writeAssets, writeReservations,
  type Asset, type AssetKind, type Reservation,
} from '../services/communicationAssets'
import {
  energiesForVehicle, pointSupportsVehicle, readRefuellingPoints, refuellingEnergyOptions,
  writeRefuellingPoints, type RefuellingPoint,
} from '../services/vehicleRefuelling'
import './CommunicationManagement.css'

const createAsset = (kind: AssetKind): Asset => ({ id: communicationId(), kind, name: '', category: '', quantity: 1, location: '', condition: 'Bon', registration: '', capacity: '', fuelType: kind === 'vehicule' ? '' : undefined, fleetOwner: kind === 'vehicule' ? 'AEIM' : undefined })
type VehicleTab = 'parc' | 'ajout' | 'affectations' | 'ravitaillement'
const vehicleFuelTypes = [
  { value: 'sp95_e10', label: 'Essence SP95-E10' },
  { value: 'sp95', label: 'Essence SP95' },
  { value: 'sp98', label: 'Essence SP98' },
  { value: 'e85', label: 'Superéthanol E85' },
  { value: 'diesel', label: 'Diesel (gazole)' },
  { value: 'hybride_essence', label: 'Hybride essence' },
  { value: 'hybride_diesel', label: 'Hybride diesel' },
  { value: 'hybride_rechargeable', label: 'Hybride rechargeable (essence + électricité)' },
  { value: 'electrique', label: 'Électrique (recharge)' },
  { value: 'gpl', label: 'GPL' },
  { value: 'gnv', label: 'GNV' },
  { value: 'hydrogene', label: 'Hydrogène' },
  { value: 'autre', label: 'Autre' },
] as const
const fuelLabel = (value?: string) => vehicleFuelTypes.find(option => option.value === value)?.label ?? 'Non renseigné'
const newRefuellingPoint = (): RefuellingPoint => ({
  id: communicationId(), name: '', address: '', energies: [], access: '', notes: '', active: true,
})
type StandOption = { id: string; nom: string; date: string; campagne?: string }
const loadStandOptions = (): StandOption[] => {
  try { const data: unknown = JSON.parse(localStorage.getItem('ob-stands-brioches-v1') || '[]'); return Array.isArray(data) ? data.filter((s):s is StandOption => Boolean(s && typeof s.id==='string' && typeof s.nom==='string' && typeof s.date==='string')) : [] }
  catch { return [] }
}
const emptyReservation = (assetId: string, campaignId: string): Reservation => ({ id: communicationId(), assetId, campaignId, beneficiary: '', driver: '', quantity: 1, dateFrom: '', dateTo: '', status: 'reserve', comment: '' })

/** La BDD Bénévoles est la source unique des véhicules personnels : aucune copie dans le catalogue. */
type VolunteerVehicle = {
  id: string
  nom: string
  prenom: string
  commune?: string
  statut?: 'Actif' | 'Inactif'
  utiliseVehiculePersonnel?: boolean | null
  immatriculationVehicule?: string
}
const VOLUNTEERS_KEY = 'ob-bdd-benevoles-v1'
const normalizePlate = (value?: string) => (value ?? '').trim().toLocaleUpperCase('fr-FR').replace(/[^A-Z0-9]/g, '')
const volunteerVehicleId = (volunteerId: string) => `benevole-vehicule:${volunteerId}`
function readVolunteerVehicles(): VolunteerVehicle[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(VOLUNTEERS_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((entry): entry is VolunteerVehicle => Boolean(entry && typeof entry.id === 'string' && typeof entry.nom === 'string' && entry.utiliseVehiculePersonnel === true))
  } catch { return [] }
}

export default function CommunicationAssets({ kind }: { kind: AssetKind }) {
  const { selectedCampagne } = useObData()
  const { etablissements } = useEtablissements()
  const esats = etablissements.filter(e => e.statut === 'ACTIF' && (e.type === 'ESAT' || ['20','29'].includes(String(e.code ?? '').trim().replace(/^0+(?=\d)/,''))))
  const { currentUser } = useUsers()
  const { hasPermission } = usePermissions()
  const campaignWritable = useCampaignWriteAccess()
  const permission = kind === 'materiel' ? 'materiel_communication' : 'vehicules_communication'
  const allowed = (action: 'creer' | 'modifier' | 'supprimer') => Boolean(selectedCampagne && currentUser && campaignWritable &&
    hasPermission(currentUser.role, permission, action))
  const canCreate = allowed('creer')
  const canModify = allowed('modifier')
  const canDelete = allowed('supprimer')
  const campagneId = selectedCampagne?.id ?? ''
  const [assets, setAssets] = useState(readAssets)
  const [volunteerVehicles, setVolunteerVehicles] = useState(readVolunteerVehicles)
  // Au retour de la BDD Bénévoles (ou après une modification dans un autre onglet), recharger les informations.
  useEffect(() => {
    const refresh = () => setVolunteerVehicles(readVolunteerVehicles())
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  const [stands] = useState(loadStandOptions)
  const [reservations, setReservations] = useState(readReservations)
  const [selected, setSelected] = useState<Asset | null>(null)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [vehicleTab, setVehicleTab] = useState<VehicleTab>('parc')
  const [refuellingPoints, setRefuellingPoints] = useState(readRefuellingPoints)
  const [editingRefuellingPoint, setEditingRefuellingPoint] = useState<RefuellingPoint | null>(null)
  const [refuellingVehicleId, setRefuellingVehicleId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const isVehicle = kind === 'vehicule'
  const ownAssets = useMemo(() => assets.filter(asset => asset.kind === kind), [assets, kind])
  const { fleetAssets, ownerByAssetId, volunteerOnlyIds } = useMemo(() => {
    if (!isVehicle) return { fleetAssets: ownAssets, ownerByAssetId: new Map<string, VolunteerVehicle[]>(), volunteerOnlyIds: new Set<string>() }
    const fleet = [...ownAssets]
    const owners = new Map<string, VolunteerVehicle[]>()
    const volunteerIds = new Set<string>()
    const byPlate = new Map<string, Asset>()
    for (const asset of fleet) {
      const plate = normalizePlate(asset.registration)
      if (plate && !byPlate.has(plate)) byPlate.set(plate, asset)
    }
    for (const volunteer of volunteerVehicles) {
      const plate = normalizePlate(volunteer.immatriculationVehicule)
      // Une immatriculation déjà présente dans le catalogue n'est pas ajoutée une deuxième fois.
      let asset = plate ? byPlate.get(plate) : undefined
      if (!asset) {
        asset = {
          id: volunteerVehicleId(volunteer.id), kind: 'vehicule', name: 'Véhicule personnel',
          category: '', quantity: 1, location: volunteer.commune || '', condition: 'Bon',
          registration: (volunteer.immatriculationVehicule || '').trim().toLocaleUpperCase('fr-FR'), capacity: '',
        }
        fleet.push(asset)
        volunteerIds.add(asset.id)
        if (plate) byPlate.set(plate, asset)
      }
      owners.set(asset.id, [...(owners.get(asset.id) || []), volunteer])
    }
    return { fleetAssets: fleet, ownerByAssetId: owners, volunteerOnlyIds: volunteerIds }
  }, [isVehicle, ownAssets, volunteerVehicles])
  const displayedAssets = isVehicle ? fleetAssets : ownAssets
  const isVolunteerOnly = (asset: Asset) => volunteerOnlyIds.has(asset.id)
  const vehicleIsReservable = (asset: Asset) => !isVolunteerOnly(asset) ||
    (Boolean(normalizePlate(asset.registration)) && (ownerByAssetId.get(asset.id) || []).some(v => v.statut !== 'Inactif'))
  const campaignStands = stands.filter(s => s.campagne === campagneId || (!s.campagne && s.date.slice(0,4) === String(selectedCampagne?.annee ?? '')))
  const campaignReservations = reservations.filter(row => row.campaignId === campagneId && displayedAssets.some(asset => asset.id === row.assetId))
  const activeReservations = campaignReservations.filter(row => row.status !== 'retourne')
  const canEditAsset = selected && (assets.some(item => item.id === selected.id) ? canModify : canCreate)
  const canEditReservation = reservation && (reservations.some(item => item.id === reservation.id) ? canModify : canCreate)
  const refuellingVehicle = displayedAssets.find(asset => asset.id === refuellingVehicleId)
  const visibleRefuellingPoints = refuellingPoints.filter(point =>
    !refuellingVehicle || (point.active && pointSupportsVehicle(point, refuellingVehicle.fuelType)))
  const canEditRefuellingPoint = editingRefuellingPoint &&
    (refuellingPoints.some(point => point.id === editingRefuellingPoint.id) ? canModify : canCreate)

  function saveRefuellingPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingRefuellingPoint || !canEditRefuellingPoint) return
    const point: RefuellingPoint = {
      ...editingRefuellingPoint,
      name: editingRefuellingPoint.name.trim(), address: editingRefuellingPoint.address.trim(),
      access: editingRefuellingPoint.access.trim(), notes: editingRefuellingPoint.notes.trim(),
      energies: [...new Set(editingRefuellingPoint.energies)],
    }
    if (!point.name || !point.address || point.energies.length === 0) {
      setError('Renseignez le nom, l’adresse et au moins une énergie disponible.')
      return
    }
    if (refuellingPoints.some(item => item.id !== point.id &&
        item.name.trim().toLocaleLowerCase('fr-FR') === point.name.toLocaleLowerCase('fr-FR') &&
        item.address.trim().toLocaleLowerCase('fr-FR') === point.address.toLocaleLowerCase('fr-FR'))) {
      setError('Ce point de ravitaillement est déjà enregistré à cette adresse.')
      return
    }
    const next = refuellingPoints.some(item => item.id === point.id)
      ? refuellingPoints.map(item => item.id === point.id ? point : item)
      : [...refuellingPoints, point]
    try {
      writeRefuellingPoints(next)
      setRefuellingPoints(next)
      setEditingRefuellingPoint(null)
      setError('')
      setNotice('Point de ravitaillement enregistré.')
    } catch { setError('Enregistrement du point impossible.') }
  }

  function deleteRefuellingPoint(point: RefuellingPoint) {
    if (!canDelete || !window.confirm(`Supprimer ${point.name} ?`)) return
    const next = refuellingPoints.filter(item => item.id !== point.id)
    try { writeRefuellingPoints(next); setRefuellingPoints(next); setNotice('Point supprimé.'); setError('') }
    catch { setError('Suppression impossible.') }
  }

  function showVehicleRefuelling(asset: Asset) {
    setRefuellingVehicleId(asset.id)
    setVehicleTab('ravitaillement')
    setEditingRefuellingPoint(null)
    setError('')
  }

  function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEditAsset || !selected || !selected.name.trim()) return
    const normalized: Asset = { ...selected, name: selected.name.trim(), registration: selected.registration.trim().toUpperCase(), quantity: isVehicle ? 1 : Math.max(1, Math.trunc(selected.quantity)) }
    if (isVehicle && !normalized.registration.trim()) { setError('Immatriculation obligatoire.'); return }
    if (isVehicle && assets.some(asset => asset.kind === 'vehicule' && asset.id !== normalized.id && asset.registration.trim().toUpperCase() === normalized.registration.trim().toUpperCase())) {
      setError('Cette immatriculation est déjà enregistrée dans le parc automobile.')
      return
    }
    if (isVehicle && normalized.fleetOwner === 'ESAT' && !esats.some(e => e.id === normalized.esatId)) {
      setError('Sélectionnez l’ESAT propriétaire de ce véhicule.'); return
    }
    if (isVehicle && !vehicleFuelTypes.some(option => option.value === normalized.fuelType)) {
      setError('Veuillez choisir le carburant ou la motorisation électrique du véhicule.')
      return
    }
    const next = assets.some(asset => asset.id === normalized.id) ? assets.map(asset => asset.id === normalized.id ? normalized : asset) : [...assets, normalized]
    try { writeAssets(next); setAssets(next); setSelected(null); if (isVehicle) setVehicleTab('parc'); setError(''); setNotice(isVehicle ? 'Véhicule enregistré.' : 'Équipement enregistré.') }
    catch { setError('Enregistrement impossible.') }
  }

  function deleteAsset(asset: Asset) {
    if (!canDelete || !window.confirm(`Supprimer ${asset.name} ?`)) return
    if (reservations.some(row => row.assetId === asset.id)) { setError('Ce matériel possède un historique de réservations : suppression bloquée.'); return }
    const next = assets.filter(row => row.id !== asset.id)
    writeAssets(next); setAssets(next); setNotice('Équipement supprimé.')
  }

  function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reservation || !canEditReservation) return
    const asset = displayedAssets.find(row => row.id === reservation.assetId)
    if (!asset || !reservation.beneficiary.trim()) { setError('Précisez le destinataire et le matériel.'); return }
    if (isVehicle && !vehicleIsReservable(asset)) { setError('Véhicule personnel indisponible : immatriculation manquante ou bénévole inactif.'); return }
    if (reservation.standId && !campaignStands.some(s => s.id === reservation.standId)) { setError('Le stand choisi ne fait pas partie de la campagne active.'); return }
    if (!reservation.dateFrom || !reservation.dateTo || reservation.dateFrom > reservation.dateTo) { setError('Période de réservation incorrecte.'); return }
    const targetStand = campaignStands.find(s => s.id === reservation.standId)
    if (targetStand && (targetStand.date < reservation.dateFrom || targetStand.date > reservation.dateTo)) { setError('La période doit inclure la date du stand.'); return }
    const storedReservation = targetStand ? { ...reservation, beneficiary: targetStand.nom } : reservation
    if (!Number.isInteger(reservation.quantity) || reservation.quantity <= 0) { setError('Quantité invalide.'); return }
    const capacityError = reservationCapacityError(asset, storedReservation, reservations)
    if (capacityError) { setError(capacityError); return }
    const next = reservations.some(row => row.id === reservation.id) ? reservations.map(row => row.id === reservation.id ? storedReservation : row) : [...reservations, storedReservation]
    try { writeReservations(next); setReservations(next); setReservation(null); setError(''); setNotice('Réservation enregistrée pour cette campagne.') }
    catch { setError('Enregistrement impossible.') }
  }

  function setStatus(row: Reservation, status: Reservation['status']) {
    if (!canModify) return
    const next = reservations.map(item => item.id === row.id ? { ...item, status } : item)
    writeReservations(next); setReservations(next); setNotice(status === 'retourne' ? 'Retour enregistré.' : 'Sortie enregistrée.')
  }

  const startAdd = () => { setSelected(createAsset(kind)); setError(''); if (isVehicle) setVehicleTab('ajout') }
  const startEdit = (asset: Asset) => { setSelected({ ...asset }); setError(''); if (isVehicle) setVehicleTab('ajout') }
  const startReservation = (asset: Asset) => { setReservation(emptyReservation(asset.id, campagneId)); setError(''); if (isVehicle) setVehicleTab('affectations') }
  const showCatalogue = !isVehicle || vehicleTab === 'parc'
  const showReservations = !isVehicle || vehicleTab === 'affectations'
  const showAssetForm = Boolean(selected && (!isVehicle || vehicleTab === 'ajout'))

  return <main className="com-manage">
    <header className="com-heading"><div><span>COMMUNICATION · LOGISTIQUE</span><h1>{isVehicle ? 'Gestion des véhicules' : 'Matériel de communication'}</h1><p>{isVehicle ? 'Parc, conducteurs, périodes de réservation et disponibilité.' : 'Kakémonos, affiches, banderoles et affectations aux stands.'}</p><small>{selectedCampagne?.nom ?? 'Aucune campagne sélectionnée'}</small></div>
      {!isVehicle && canCreate && <button className="com-button primary" type="button" onClick={startAdd}><Plus size={16}/>Ajouter du matériel</button>}
    </header>
    {isVehicle && <nav className="com-vehicle-nav" aria-label="Navigation gestion des véhicules">
      <button type="button" className={`com-vehicle-tab ${vehicleTab === 'parc' ? 'active' : ''}`} aria-current={vehicleTab === 'parc' ? 'page' : undefined} onClick={() => {setVehicleTab('parc'); setError('')}}><CarFront size={17}/>Parc automobile</button>
      {(canCreate || (selected && assets.some(item => item.id === selected.id))) && <button type="button" className={`com-vehicle-tab ${vehicleTab === 'ajout' ? 'active' : ''}`} aria-current={vehicleTab === 'ajout' ? 'page' : undefined} onClick={() => {if (canCreate) setSelected(createAsset('vehicule')); setVehicleTab('ajout'); setError('')}}><Plus size={17}/>{canCreate ? 'Ajouter un véhicule' : 'Modifier le véhicule'}</button>}
      <button type="button" className={`com-vehicle-tab ${vehicleTab === 'affectations' ? 'active' : ''}`} aria-current={vehicleTab === 'affectations' ? 'page' : undefined} onClick={() => {setVehicleTab('affectations'); setError('')}}><ClipboardList size={17}/>Affectations ({campaignReservations.length})</button>
      <button type="button" className={`com-vehicle-tab ${vehicleTab === 'ravitaillement' ? 'active' : ''}`} aria-current={vehicleTab === 'ravitaillement' ? 'page' : undefined} onClick={() => {setVehicleTab('ravitaillement'); setError('')}}><Fuel size={17}/>Ravitaillement & recharge ({refuellingPoints.filter(point => point.active).length})</button>
    </nav>}
    <div className="com-stats"><div><small>{isVehicle ? 'Véhicules répertoriés' : 'Références au catalogue'}</small><strong>{displayedAssets.length}</strong></div><div><small>Réservations en cours</small><strong>{activeReservations.length}</strong></div><div><small>Campagne</small><strong>{selectedCampagne?.annee ?? '—'}</strong></div></div>
    {notice && <p className="com-alert success" role="status"><CheckCircle2 size={16}/>{notice}</p>}
    {error && <p className="com-alert error" role="alert">{error}</p>}
    {showCatalogue && <section className="com-panel"><h2>{isVehicle ? 'Parc automobile' : 'Inventaire du matériel'}</h2><div style={{overflowX:'auto'}}><table className="com-table"><thead><tr><th>{isVehicle ? 'Véhicule' : 'Matériel'}</th><th>{isVehicle ? 'Immatriculation' : 'Catégorie'}</th><th>{isVehicle ? 'Carburant / énergie' : 'Stock'}</th>{isVehicle && <th>Capacité</th>}<th>Localisation</th><th>Actions</th>{isVehicle && <th>Bénévole</th>}</tr></thead><tbody>
      {displayedAssets.length === 0 && <tr><td colSpan={isVehicle ? 7 : 5}>{isVehicle ? 'Aucun véhicule enregistré.' : 'Aucun équipement enregistré.'}</td></tr>}
      {displayedAssets.map(asset => <tr key={asset.id}><td><strong>{asset.name}</strong>{isVehicle && !isVolunteerOnly(asset) && <small style={{display:'block',opacity:.7}}>{asset.fleetOwner === 'ESAT' ? `Véhicule ESAT · ${etablissements.find(e=>e.id===asset.esatId)?.nom ?? 'ESAT'}` : 'Véhicule AEIM'}</small>}</td><td>{isVehicle ? (asset.registration || 'À renseigner') : asset.category || '—'}</td><td>{isVehicle ? fuelLabel(asset.fuelType) : asset.quantity}</td>{isVehicle && <td>{asset.capacity || '—'}</td>}<td>{asset.location || '—'}</td><td><div className="com-asset-actions">
        {isVolunteerOnly(asset) ? <Link className="com-button light" to="/bdd/benevoles">Fiche bénévole</Link> : <>
          {canModify && <button type="button" className="com-button light" onClick={() => startEdit(asset)}>Modifier</button>}
          {canDelete && <button type="button" className="com-button danger" onClick={() => deleteAsset(asset)} title="Supprimer"><Trash2 size={15}/></button>}
        </>}
        {isVehicle && <button type="button" className="com-button light" onClick={() => showVehicleRefuelling(asset)} title="Consulter les points de ravitaillement et de recharge compatibles"><Fuel size={15}/> Où ravitailler ?</button>}
        {canCreate && vehicleIsReservable(asset) && <button type="button" className="com-button blue" onClick={() => startReservation(asset)}>Réserver</button>}
      </div></td>{isVehicle && <td>{(ownerByAssetId.get(asset.id) || []).length ? (ownerByAssetId.get(asset.id) || []).map(v => `${v.prenom} ${v.nom}${v.statut === 'Inactif' ? ' (inactif)' : ''}`).join(', ') : '—'}</td>}</tr>)}
    </tbody></table></div></section>}
    {showReservations && <section className="com-panel" style={{marginTop: isVehicle ? 0 : 20}}><h2>Affectations de la campagne</h2><div style={{overflowX:'auto'}}><table className="com-table"><thead><tr><th>{isVehicle ? 'Véhicule' : 'Matériel'}</th><th>Affectation</th><th>Dates</th><th>{isVehicle ? 'Conducteur' : 'Qté'}</th><th>État</th><th>Actions</th></tr></thead><tbody>
      {campaignReservations.length === 0 && <tr><td colSpan={6}>Aucune réservation pour cette campagne.</td></tr>}
      {campaignReservations.map(row => <tr key={row.id}><td>{displayedAssets.find(asset => asset.id === row.assetId)?.name ?? 'Matériel inconnu'}</td><td>{row.standId ? <><strong>Stand : {stands.find(s => s.id === row.standId)?.nom ?? row.beneficiary}</strong><br/><small>Rattachement par identifiant</small></> : row.beneficiary}</td><td>{row.dateFrom} → {row.dateTo}</td><td>{isVehicle ? row.driver || '—' : row.quantity}</td><td>{row.status === 'reserve' ? 'Réservé' : row.status === 'sorti' ? 'Sorti' : 'Retourné'}</td><td><div className="com-asset-actions">{canModify && <><button type="button" className="com-button light" onClick={() => setReservation({ ...row })}>Modifier</button>{row.status === 'reserve' && <button type="button" className="com-button blue" onClick={() => setStatus(row, 'sorti')}>Sortie</button>}{row.status !== 'retourne' && <button type="button" className="com-button light" onClick={() => setStatus(row, 'retourne')}>Retour</button>}</>}</div></td></tr>)}
    </tbody></table></div></section>}


    {isVehicle && vehicleTab === 'ravitaillement' && <section className="com-panel" aria-label="Ravitaillement et recharge">
      <div className="com-detail-head"><h2>Où ravitailler ou recharger les véhicules ?</h2>
        {canCreate && <button type="button" className="com-button primary" onClick={() => {setEditingRefuellingPoint(newRefuellingPoint());setError('')}}><Plus size={16}/> Ajouter un point</button>}
      </div>
      <p className="com-muted">Liste renseignée par l'équipe : aucune disponibilité en direct. Vérifier sur place les horaires, les badges et les conditions d'accès.</p>
      <div className="com-fields" style={{margin:'18px 0'}}>
        <label><span>Afficher les points compatibles avec</span>
          <select value={refuellingVehicleId} onChange={event => setRefuellingVehicleId(event.target.value)}>
            <option value="">Tous les véhicules / toutes les énergies</option>
            {displayedAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.registration || 'sans immatriculation'} · {fuelLabel(asset.fuelType)}</option>)}
          </select>
        </label>
      </div>
      {refuellingVehicle && energiesForVehicle(refuellingVehicle.fuelType).length === 0 &&
        <p className="com-alert error">Énergie de ce véhicule non renseignée : tous les points sont affichés, sans vérification de compatibilité.</p>}
      <div style={{overflowX:'auto'}}><table className="com-table"><thead><tr><th>Point</th><th>Énergies proposées</th><th>Adresse</th><th>Accès / carte / badge</th><th>Actions</th></tr></thead><tbody>
        {visibleRefuellingPoints.length === 0 && <tr><td colSpan={5}>Aucun point compatible enregistré. Vous pouvez en ajouter un depuis ce menu.</td></tr>}
        {visibleRefuellingPoints.map(point => <tr key={point.id}>
          <td><strong>{point.name}</strong>{!point.active && <small style={{display:'block',color:'#ab6625'}}>Désactivé</small>}{point.notes && <small style={{display:'block',opacity:.8}}>{point.notes}</small>}</td>
          <td>{point.energies.map(energy => refuellingEnergyOptions.find(option => option.value === energy)?.label || energy).join(', ')}</td>
          <td><MapPin size={14} style={{verticalAlign:'middle'}}/> {point.address}</td>
          <td>{point.access || 'À préciser'}</td>
          <td><div className="com-asset-actions">
            {canModify && <button type="button" className="com-button light" onClick={() => {setEditingRefuellingPoint({...point});setError('')}}>Modifier</button>}
            {canDelete && <button type="button" className="com-button danger" title="Supprimer le point" onClick={() => deleteRefuellingPoint(point)}><Trash2 size={15}/></button>}
          </div></td>
        </tr>)}
      </tbody></table></div>
      {refuellingPoints.some(point => !point.active) && <p className="com-muted">{refuellingPoints.filter(point => !point.active).length} point(s) désactivé(s), conservé(s) dans le répertoire mais non proposé(s) pour les trajets.</p>}
      {editingRefuellingPoint && <form onSubmit={saveRefuellingPoint} className="com-block"><h3>{refuellingPoints.some(point => point.id === editingRefuellingPoint.id) ? 'Modifier le point' : 'Nouveau point de ravitaillement'}</h3>
        <div className="com-fields" style={{marginTop:16}}>
          <label><span>Nom du point *</span><input required value={editingRefuellingPoint.name} onChange={event => setEditingRefuellingPoint({...editingRefuellingPoint,name:event.target.value})}/></label>
          <label><span>Adresse complète *</span><input required value={editingRefuellingPoint.address} onChange={event => setEditingRefuellingPoint({...editingRefuellingPoint,address:event.target.value})}/></label>
          <label><span>Carte / badge / conditions d'accès</span><input placeholder="Ex. Badge AEIM, carte carburant autorisée" value={editingRefuellingPoint.access} onChange={event => setEditingRefuellingPoint({...editingRefuellingPoint,access:event.target.value})}/></label>
          <label><span>Informations pratiques</span><input placeholder="Ex. Entrée par le parking arrière" value={editingRefuellingPoint.notes} onChange={event => setEditingRefuellingPoint({...editingRefuellingPoint,notes:event.target.value})}/></label>
        </div>
        <fieldset className="com-refuelling-energies"><legend>Énergies proposées *</legend>
          {refuellingEnergyOptions.map(option => <label key={option.value}><input type="checkbox" checked={editingRefuellingPoint.energies.includes(option.value)} onChange={event => setEditingRefuellingPoint({...editingRefuellingPoint,energies:event.target.checked ? [...editingRefuellingPoint.energies,option.value] : editingRefuellingPoint.energies.filter(value => value !== option.value)})}/>{option.label}</label>)}
        </fieldset>
        <label className="com-refuelling-active"><input type="checkbox" checked={editingRefuellingPoint.active} onChange={event => setEditingRefuellingPoint({...editingRefuellingPoint,active:event.target.checked})}/> Point actuellement autorisé / disponible dans la liste</label>
        <div className="com-actions com-bottom"><button type="button" className="com-button light" onClick={() => setEditingRefuellingPoint(null)}>Annuler</button><button type="submit" className="com-button primary"><Save size={16}/> Enregistrer</button></div>
      </form>}
    </section>}

    {showAssetForm && selected && <section className="com-panel" style={{marginTop:isVehicle ? 0 : 20}}><h2>{isVehicle ? (assets.some(item => item.id === selected.id) ? 'Modifier le véhicule' : 'Ajouter un véhicule') : 'Fiche matériel'}</h2><form onSubmit={saveAsset}><div className="com-fields">
      <label><span>{isVehicle ? 'Modèle du véhicule *' : 'Nom du matériel *'}</span><input required value={selected.name} onChange={event => setSelected({ ...selected, name: event.target.value })}/></label>
      {isVehicle ? <><label><span>Parc propriétaire *</span><select value={selected.fleetOwner ?? 'AEIM'} onChange={event => setSelected({ ...selected, fleetOwner: event.target.value as 'AEIM' | 'ESAT', esatId: undefined })}><option value="AEIM">Véhicule AEIM</option><option value="ESAT">Véhicule ESAT</option></select></label>{selected.fleetOwner === 'ESAT' && <label><span>ESAT propriétaire *</span><select required value={selected.esatId ?? ''} onChange={event => setSelected({ ...selected, esatId: event.target.value })}><option value="">Sélectionner un ESAT</option>{esats.map(esat => <option key={esat.id} value={esat.id}>{esat.nom}{esat.ville ? ` · ${esat.ville}` : ''}</option>)}</select></label>}<label><span>Immatriculation *</span><input required value={selected.registration} onChange={event => setSelected({ ...selected, registration: event.target.value })}/></label><label><span>Carburant / motorisation *</span><select required value={selected.fuelType ?? ''} onChange={event => setSelected({ ...selected, fuelType: event.target.value })}><option value="">Choisir une énergie</option>{vehicleFuelTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Capacité de chargement</span><input value={selected.capacity} onChange={event => setSelected({ ...selected, capacity: event.target.value })}/></label></> : <><label><span>Type</span><select value={selected.category} onChange={event => setSelected({ ...selected, category: event.target.value })}><option value="">Autre</option>{['Kakémono', 'Affiche', 'Banderole', 'Flyer', 'Présentoir', 'Outil de communication'].map(value => <option key={value}>{value}</option>)}</select></label><label><span>Quantité totale</span><input type="number" required min="1" step="1" value={selected.quantity} onChange={event => setSelected({ ...selected, quantity: Number(event.target.value) })}/></label><label><span>État</span><select value={selected.condition} onChange={event => setSelected({ ...selected, condition: event.target.value })}><option>Bon</option><option>À vérifier</option><option>À réparer</option><option>Hors service</option></select></label></>}
      <label><span>Localisation habituelle</span><input value={selected.location} onChange={event => setSelected({ ...selected, location: event.target.value })}/></label>
    </div><div className="com-actions com-bottom"><button type="button" className="com-button light" onClick={() => {setSelected(null); if (isVehicle) setVehicleTab('parc'); setError('')}}>Annuler</button><button type="submit" className="com-button primary"><Save size={16}/> Enregistrer</button></div></form></section>}

    {reservation && showReservations && <section className="com-panel" style={{marginTop:20}}><h2>{isVehicle ? 'Réservation du véhicule' : 'Affectation du matériel'}</h2><form onSubmit={saveReservation}><div className="com-fields">
      <label><span>Équipement</span><select value={reservation.assetId} onChange={event => setReservation({ ...reservation, assetId: event.target.value })}>{displayedAssets.filter(asset => !isVehicle || vehicleIsReservable(asset) || asset.id === reservation.assetId).map(asset => <option key={asset.id} value={asset.id}>{asset.name}{isVehicle && (ownerByAssetId.get(asset.id) || []).length ? ` — ${(ownerByAssetId.get(asset.id) || []).map(v => `${v.prenom} ${v.nom}`).join(', ')}` : ''}</option>)}</select></label>
      {!isVehicle && <label><span>Rattacher à un stand (facultatif)</span><select value={reservation.standId || ''} onChange={event => {
        const stand = campaignStands.find(s => s.id === event.target.value)
        setReservation({ ...reservation, standId: stand?.id, beneficiary: stand?.nom ?? '',
          dateFrom: stand?.date ?? reservation.dateFrom, dateTo: stand?.date ?? reservation.dateTo })
      }}><option value="">Affectation libre</option>{campaignStands.map(stand => <option key={stand.id} value={stand.id}>{stand.nom} · {stand.date}</option>)}</select>
      <small><Link to="/gestion/stands-brioches">Voir les stands de la campagne</Link></small></label>}
      <label><span>{isVehicle ? 'Service / livraison' : 'Stand / établissement / responsable'} *</span><input required disabled={Boolean(reservation.standId)} value={reservation.standId ? campaignStands.find(s => s.id === reservation.standId)?.nom ?? reservation.beneficiary : reservation.beneficiary} onChange={event => setReservation({ ...reservation, beneficiary: event.target.value })}/></label>
      {isVehicle ? <label><span>Conducteur</span><input value={reservation.driver} onChange={event => setReservation({ ...reservation, driver: event.target.value })}/></label> : <label><span>Quantité réservée</span><input type="number" required min="1" step="1" value={reservation.quantity} onChange={event => setReservation({ ...reservation, quantity: Number(event.target.value) })}/></label>}
      <label><span>Début *</span><input type="date" required value={reservation.dateFrom} onChange={event => setReservation({ ...reservation, dateFrom: event.target.value })}/></label>
      <label><span>Retour prévu *</span><input type="date" required value={reservation.dateTo} onChange={event => setReservation({ ...reservation, dateTo: event.target.value })}/></label>
      <label><span>Commentaire</span><input value={reservation.comment} onChange={event => setReservation({ ...reservation, comment: event.target.value })}/></label>
    </div><div className="com-actions com-bottom"><button type="button" className="com-button light" onClick={() => setReservation(null)}>Annuler</button><button type="submit" className="com-button primary"><Save size={16}/> Enregistrer la réservation</button></div></form></section>}
    <p className="com-disclaimer">Parc AEIM et véhicules personnels des bénévoles (liés à leur fiche BDD, non dupliqués). Catalogue partagé entre campagnes sur ce navigateur. Les réservations sont attribuées à la campagne sélectionnée. Les affectations avec un stand sont reliées par son identifiant et visibles dans sa fiche. Synchronisation multi-utilisateurs à prévoir avec le SI.</p>
  </main>
}

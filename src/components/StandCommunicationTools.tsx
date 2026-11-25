import { useEffect, useState, type FormEvent } from 'react'
import { ClipboardList, Plus, Save, RotateCcw, PackageCheck, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePermissions } from '../contexts/permissionsState'
import { useUsers } from '../contexts/UsersContext'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import {
  communicationId, readAssets, readReservations, reservationCapacityError, writeReservations,
  type Asset, type Reservation,
} from '../services/communicationAssets'
import './StandCommunicationTools.css'

type StandRef = { id: string; nom: string; date: string }

/** Affectation reliée à l'ID du stand et au catalogue existant, sans nouveau stock parallèle. */
export default function StandCommunicationTools({ stand, campagneId }: { stand: StandRef; campagneId: string }) {
  const { currentUser } = useUsers()
  const { hasPermission } = usePermissions()
  const campaignWritable = useCampaignWriteAccess()
  const may = (action: 'creer' | 'modifier' | 'supprimer') => Boolean(
    currentUser && campaignWritable && hasPermission(currentUser.role, 'materiel_communication', action))
  const [assets, setAssets] = useState<Asset[]>(readAssets)
  const [reservations, setReservations] = useState<Reservation[]>(readReservations)
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const materials = assets.filter(asset => asset.kind === 'materiel')
  const linked = reservations.filter(row => row.campaignId === campagneId && row.standId === stand.id)
  const active = linked.filter(row => row.status !== 'retourne')

  useEffect(() => {
    const refresh = () => { setAssets(readAssets()); setReservations(readReservations()) }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [])

  function startNew() {
    setError(''); setNotice('')
    setEditing({ id: communicationId(), assetId: materials[0]?.id ?? '', campaignId: campagneId,
      standId: stand.id, beneficiary: stand.nom, driver: '', quantity: 1,
      dateFrom: stand.date, dateTo: stand.date, status: 'reserve', comment: '' })
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const isExisting = reservations.some(row => row.id === editing.id)
    if (!(isExisting ? may('modifier') : may('creer'))) return
    const asset = materials.find(row => row.id === editing.assetId)
    if (!asset) { setError('Sélectionne un matériel existant dans le catalogue.'); return }
    if (!Number.isSafeInteger(editing.quantity) || editing.quantity < 1) { setError('La quantité doit être un entier positif.'); return }
    if (!editing.dateFrom || !editing.dateTo || editing.dateFrom > editing.dateTo ||
      stand.date < editing.dateFrom || stand.date > editing.dateTo) {
      setError('La période doit inclure la date du stand.'); return
    }
    const row: Reservation = { ...editing, standId: stand.id, campaignId: campagneId, beneficiary: stand.nom }
    const occupied = reservationCapacityError(asset, row, reservations)
    if (occupied && row.status !== 'retourne') { setError(occupied); return }
    const next = isExisting ? reservations.map(item => item.id === row.id ? row : item) : [...reservations, row]
    try {
      writeReservations(next); setReservations(next); setEditing(null); setError('');
      setNotice(isExisting ? 'Affectation mise à jour.' : 'Matériel rattaché au stand.')
    } catch { setError('Enregistrement impossible : stockage local indisponible.') }
  }

  function changeStatus(row: Reservation, status: Reservation['status']) {
    if (!may('modifier')) return
    const next = reservations.map(item => item.id === row.id ? { ...item, status } : item)
    try {
      writeReservations(next); setReservations(next);
      setNotice(status === 'sorti' ? 'Sortie enregistrée.' : 'Retour enregistré.')
    } catch { setError('Enregistrement du mouvement impossible.') }
  }

  function remove(row: Reservation) {
    if (!may('supprimer') || !window.confirm('Supprimer cette affectation de matériel ?')) return
    const next = reservations.filter(item => item.id !== row.id)
    try { writeReservations(next); setReservations(next); setNotice('Affectation supprimée.') }
    catch { setError('Suppression impossible.') }
  }

  return <section className="ob-com-stand-tools" aria-label={`Outils de communication du stand ${stand.nom}`}>
    <div className="ob-com-stand-tools__header">
      <div><h3><ClipboardList size={18}/> Outils de communication</h3>
        <p>{active.length} affectation(s) en cours · {linked.length} au total</p></div>
      {may('creer') && materials.length > 0 && <button type="button" className="ob-com-stand-tools__primary" onClick={startNew}><Plus size={15}/> Attribuer</button>}
    </div>
    {materials.length === 0 && <p className="ob-com-stand-tools__muted">Aucun matériel au catalogue. <Link to="/gestion/materiel-communication">Créer le matériel de communication</Link> pour l'attribuer à ce stand.</p>}
    {linked.length === 0 && materials.length > 0 && <p className="ob-com-stand-tools__muted">Aucun kakémono, affiche ou autre outil rattaché à ce stand.</p>}
    {linked.length > 0 && <div className="ob-com-stand-tools__list">{linked.map(row => {
      const asset = materials.find(item => item.id === row.assetId)
      return <div className="ob-com-stand-tools__line" key={row.id}>
        <div><strong>{asset?.name ?? 'Matériel retiré du catalogue'}</strong><small>{row.quantity} unité(s) · {row.dateFrom === row.dateTo ? row.dateFrom : `${row.dateFrom} → ${row.dateTo}`} · {row.status === 'reserve' ? 'Réservé' : row.status === 'sorti' ? 'Sorti' : 'Retourné'}</small>{row.comment && <small>{row.comment}</small>}</div>
        <div className="ob-com-stand-tools__actions">
          {may('modifier') && row.status === 'reserve' && <button type="button" onClick={() => changeStatus(row, 'sorti')}><PackageCheck size={14}/> Sortie</button>}
          {may('modifier') && row.status === 'sorti' && <button type="button" onClick={() => changeStatus(row, 'retourne')}><RotateCcw size={14}/> Retour</button>}
          {may('modifier') && <button type="button" aria-label="Modifier l'affectation" onClick={() => {setEditing({...row});setError('')}}><Pencil size={14}/></button>}
          {may('supprimer') && <button type="button" aria-label="Supprimer l'affectation" onClick={() => remove(row)}><Trash2 size={14}/></button>}
        </div>
      </div>
    })}</div>}
    {notice && <p className="ob-com-stand-tools__success" role="status">{notice}</p>}
    {!editing && error && <p className="ob-com-stand-tools__error" role="alert">{error}</p>}
    {editing && <form className="ob-com-stand-tools__form" onSubmit={save}>
      <h4>{linked.some(row => row.id === editing.id) ? 'Modifier une affectation' : 'Attribuer du matériel'}</h4>
      <div className="ob-com-stand-tools__fields">
        <label>Matériel <select value={editing.assetId} required onChange={e => setEditing({...editing,assetId:e.target.value})}>{materials.map(asset => <option key={asset.id} value={asset.id}>{asset.name} (stock : {asset.quantity})</option>)}</select></label>
        <label>Quantité <input type="number" min="1" step="1" required value={editing.quantity} onChange={e => setEditing({...editing, quantity:Number(e.target.value)})}/></label>
        <label>Début <input type="date" required value={editing.dateFrom} onChange={e => setEditing({...editing,dateFrom:e.target.value})}/></label>
        <label>Retour prévu <input type="date" required value={editing.dateTo} onChange={e => setEditing({...editing,dateTo:e.target.value})}/></label>
        <label className="ob-com-stand-tools__full">Observation <input type="text" value={editing.comment} onChange={e => setEditing({...editing,comment:e.target.value})}/></label>
      </div>
      {error && <p className="ob-com-stand-tools__error" role="alert">{error}</p>}
      <div className="ob-com-stand-tools__actions"><button type="button" onClick={() => {setEditing(null);setError('')}}>Annuler</button><button type="submit" className="ob-com-stand-tools__primary"><Save size={15}/> Enregistrer</button></div>
    </form>}
  </section>
}

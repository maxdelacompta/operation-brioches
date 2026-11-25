import { useEffect, useState, type FormEvent } from 'react'
import { PackagePlus, X } from 'lucide-react'
import type { EtablissementAEIM } from '../types/etablissements'
import type { FinanceRow } from '../lib/financeRegister'
import { STOCK_CHANGED } from '../lib/briochesStock'
import { getUserDisplayName, useUsers } from '../contexts/UsersContext'
import { recordActivity } from '../services/activityLog'
import {
  creerIdReceptionMecenat, enregistrerReceptionMecenat, quantiteRecueMecenat,
  type DemandeReceptionMecenat,
} from '../lib/mecenatBrioches'

type Props = {
  row: FinanceRow
  canReceive: boolean
  etablissements: EtablissementAEIM[]
  onNotice: (s:string) => void
  onError: (s:string) => void
}
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
type FormReception = Omit<DemandeReceptionMecenat, 'quantite'> & { quantite: string }

export default function MecenatBriochesReception({row, canReceive, etablissements, onNotice, onError}:Props) {
  const { currentUser } = useUsers()
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState<FormReception | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const refresh = () => setVersion(v => v+1)
    window.addEventListener(STOCK_CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {window.removeEventListener(STOCK_CHANGED, refresh); window.removeEventListener('storage', refresh)}
  }, [])
  // La version déclenche le recalcul à chaque changement du registre des stocks.
  void version
  const recues = quantiteRecueMecenat(row.id, row.campagne)
  const annoncees = Number(row.quantite || 0)

  const ouvrir = () => {
    setError('')
    setForm({
      campagne:row.campagne, mecenatId:row.id, mouvementId:creerIdReceptionMecenat(row.id),
      etablissementId: row.etablissementId || '', quantite:String(Math.max(1, annoncees-recues)),
      date:localToday(), referenceLot:row.reference || '', fabrication:'', dateLimite:'',
      natureLimite:'interne', remarque:'',
    })
  }
  const changer = (value:Partial<FormReception>) => setForm(old => old ? {...old, ...value} : null)
  const enregistrer = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form || busy || !canReceive) return
    if (!etablissements.some(e => e.id === form.etablissementId && e.statut === 'ACTIF')) {
      setError('Sélectionne un établissement actif.'); return
    }
    setBusy(true)
    try {
      const result = enregistrerReceptionMecenat({...form, quantite:Number(form.quantite)})
      if (result.nouveau) {
        try { recordActivity({
          actorId: currentUser?.id ?? null,
          actorName: currentUser ? getUserDisplayName(currentUser) : 'Session non identifiée',
          category: 'mecenat', action: 'creation',
          target: `Réception ${row.reference || row.id}`,
          message: `Réception physique de ${form.quantite} brioche(s) offertes par ${row.partenaire || 'mécène'}, campagne ${row.campagne}, établissement ${form.etablissementId}`,
          source: 'metier',
        }) } catch { /* La réception physique reste enregistrée même si le journal est indisponible. */ }
      }
      onError('')
      onNotice(result.nouveau
        ? `Réception de ${form.quantite} brioche(s) enregistrée dans le stock de l’établissement.`
        : 'Réception déjà existante : aucune quantité ajoutée en double.')
      setForm(null)
      setError('')
      setVersion(v=>v+1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de confirmer la réception.'
      setError(message)
      onError(message)
    } finally {setBusy(false)}
  }

  return <>
    <span className="ob-finance-subline">Brioches : {recues} reçue(s){annoncees > 0 ? ` / ${annoncees} annoncée(s)` : ' · quantité annoncée non renseignée'}</span>
    {canReceive && <button type="button" title="Confirmer une arrivée physique de brioches" onClick={ouvrir}>
      <PackagePlus size={16}/> Réceptionner
    </button>}
    {form && <div className="ob-extra-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setForm(null)}}>
      <form className="ob-extra-modal ob-finance-modal" aria-label="Réception de brioches mécènes" role="dialog" aria-modal="true" onSubmit={enregistrer}>
        <div className="ob-extra-modalhead"><div><small>MÉCÉNAT EN NATURE</small><h2>Réceptionner des brioches</h2></div>
          <button type="button" disabled={busy} onClick={()=>setForm(null)} aria-label="Fermer"><X size={20}/></button></div>
        <p><strong>{row.partenaire}</strong> · {recues} reçues sur {annoncees || 'quantité non renseignée'} annoncées.</p>
        <p className="ob-finance-info">Seule la quantité physiquement reçue sera ajoutée au stock. Le don ne génère ni achat, ni facture, ni règlement. Une autre réception pourra être enregistrée plus tard. Si cette arrivée a déjà été enregistrée manuellement dans les stocks, ne la ressaisissez pas ici.</p>
        <div className="ob-extra-form">
          <label><span>Établissement destinataire *</span><select required value={form.etablissementId} onChange={e=>changer({etablissementId:e.target.value})}>
            <option value="">Choisir un établissement</option>{etablissements.filter(e=>e.statut==='ACTIF').map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
          </select></label>
          <label><span>Date de réception *</span><input type="date" required value={form.date} onChange={e=>changer({date:e.target.value})}/></label>
          <label><span>Quantité réellement reçue *</span><input type="number" required min="1" max="1000000" step="1" value={form.quantite} onChange={e=>changer({quantite:e.target.value})}/></label>
          <label><span>Lot / référence</span><input maxLength={100} value={form.referenceLot} onChange={e=>changer({referenceLot:e.target.value})}/></label>
          <label><span>Date de fabrication (si connue)</span><input type="date" value={form.fabrication} onChange={e=>changer({fabrication:e.target.value})}/></label>
          <label><span>Date limite du lot</span><input type="date" value={form.dateLimite} onChange={e=>changer({dateLimite:e.target.value})}/></label>
          <label><span>Nature de la date limite</span><select value={form.natureLimite} onChange={e=>changer({natureLimite:e.target.value as FormReception['natureLimite']})}>
            <option value="interne">Limite interne</option><option value="DLC">DLC</option><option value="DDM">DDM</option>
          </select></label>
          <label><span>Observations</span><input value={form.remarque} maxLength={200} onChange={e=>changer({remarque:e.target.value})}/></label>
        </div>
        <p className="ob-extra-note">La date limite permet les alertes de péremption. Si elle n'est pas connue, la réception reste à qualifier dans le suivi du tableau de bord ; aucune durée de conservation n'est inventée.</p>
        {error && <p className="ob-finance-error" role="alert">{error}</p>}
        <div className="ob-extra-footer"><button type="button" className="ob-extra-btn secondary" disabled={busy} onClick={()=>setForm(null)}>Annuler</button>
          <button type="submit" className="ob-extra-btn primary" disabled={busy}>Confirmer la réception physique</button></div>
      </form>
    </div>}
  </>
}

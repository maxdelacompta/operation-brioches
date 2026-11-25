import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Download, FileText, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useObData } from '../contexts/ObDataContext'
import { useUsers } from '../contexts/UsersContext'
import { usePermissions } from '../contexts/permissionsState'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import {
  downloadEntityDocument, generateConvention, getEntityDocumentBlob, removeEntityDocument, saveEntityDocument,
} from '../services/conventionDocuments'
import { createSponsoringDeal, makeBenefit, persistSponsoring, readSponsoring } from '../services/sponsoringStore'
import type { SponsoringBenefit, SponsoringDeal, SponsoringStatus } from '../types/sponsoring'
import './CommunicationManagement.css'

const STATUS: Record<SponsoringStatus, string> = {
  brouillon: 'Brouillon', envoyee: 'Convention envoyée', signee: 'Convention signée', terminee: 'Partenariat terminé',
}
const euros = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
const safeName = (value: string) => value.replace(/[^a-z0-9-_]/gi, '-').slice(0, 65)

export default function Sponsoring() {
  const { selectedCampagne, donateurs } = useObData()
  const { currentUser } = useUsers()
  const { hasPermission } = usePermissions()
  const campaignWritable = useCampaignWriteAccess()
  const allowed = (action: 'creer' | 'modifier' | 'supprimer' | 'exporter') => Boolean(selectedCampagne && currentUser &&
    (action === 'exporter' || campaignWritable) && hasPermission(currentUser.role, 'sponsoring', action))
  const canCreate = allowed('creer')
  const canModify = allowed('modifier')
  const canDelete = allowed('supprimer')
  const canExport = allowed('exporter')
  const campagneId = selectedCampagne?.id ?? ''
  const [rows, setRows] = useState<SponsoringDeal[]>(readSponsoring)
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<SponsoringDeal | null>(null)
  const [newBenefit, setNewBenefit] = useState('')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const isExisting = Boolean(draft && rows.some(row => row.id === draft.id))
  const canEdit = isExisting ? canModify : canCreate

  const campaignRows = useMemo(() => rows.filter(row => row.campagneId === campagneId), [rows, campagneId])
  const visible = campaignRows.filter(row => `${row.entreprise} ${row.contact}`.toLowerCase().includes(query.toLowerCase()))
  const total = campaignRows.reduce((sum, row) => sum + row.montant, 0)
  const planned = draft?.benefits.filter(item => item.planned).length ?? 0
  const done = draft?.benefits.filter(item => item.planned && item.done).length ?? 0

  function select(row: SponsoringDeal) {
    setSelectedId(row.id)
    setDraft({ ...row, benefits: row.benefits.map(item => ({ ...item })) })
    setError('')
    setNotice('')
  }

  function create() {
    if (!canCreate) return
    const row = createSponsoringDeal(campagneId)
    setSelectedId(row.id)
    setDraft(row)
    setNotice('')
    setError('')
  }

  function updateBenefit(id: string, change: Partial<SponsoringBenefit>) {
    setDraft(current => current ? ({ ...current, benefits: current.benefits.map(item =>
      item.id === id ? { ...item, ...change } : item) }) : current)
  }

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!canEdit || !draft || draft.campagneId !== campagneId) return
    if (!draft.entreprise.trim()) { setError('Renseignez une entreprise.'); return }
    if (!Number.isFinite(draft.montant) || draft.montant < 0) { setError('Le montant doit être positif.'); return }
    const next = { ...draft, entreprise: draft.entreprise.trim(), updatedAt: new Date().toISOString() }
    const updated = rows.some(row => row.id === next.id)
      ? rows.map(row => row.id === next.id ? next : row)
      : [...rows, next]
    try {
      persistSponsoring(updated)
      setRows(updated)
      setDraft(next)
      setNotice('Partenariat enregistré dans ce navigateur.')
      setError('')
    } catch {
      setError('Stockage indisponible : les modifications ne sont pas enregistrées.')
    }
  }

  async function remove() {
    if (!canDelete || !draft || !isExisting || !window.confirm(`Supprimer le sponsoring de ${draft.entreprise || 'ce partenaire'} ?`)) return
    try {
      for (const benefit of draft.benefits) await removeEntityDocument(campagneId, draft.id, `preuve-${benefit.id}`)
      await removeEntityDocument(campagneId, draft.id, 'convention-signee')
      const next = rows.filter(row => row.id !== draft.id)
      persistSponsoring(next)
      setRows(next)
      setDraft(null)
      setSelectedId('')
      setNotice('Partenariat supprimé.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  function setDonor(value: string) {
    const donor = donateurs.find(item => String(item.id) === value)
    setDraft(current => current ? {
      ...current,
      donateurId: donor?.id ?? null,
      entreprise: donor?.nom ?? current.entreprise,
      contact: donor ? `${donor.contactPrenom ?? ''} ${donor.contactNom ?? ''}`.trim() : current.contact,
      adresse: donor ? [donor.numeroVoie, donor.adresse, donor.cp, donor.ville].filter(Boolean).join(' ') : current.adresse,
    } : current)
  }

  async function uploadDocument(kind: string, file: File | undefined) {
    if (!file || !draft || !canEdit) return
    try {
      const meta = await saveEntityDocument(campagneId, draft.id, kind, file)
      if (kind === 'convention-signee') {
        setDraft(current => current ? { ...current, signedConvention: meta } : current)
      } else {
        setDraft(current => current ? { ...current, benefits: current.benefits.map(item =>
          kind === `preuve-${item.id}` ? { ...item, proof: meta } : item) } : current)
      }
      setError('')
      setNotice('Fichier ajouté. Cliquez sur Enregistrer pour conserver sa référence sur la fiche.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import impossible.')
    }
  }

  async function downloadDocument(kind: string, name: string) {
    if (!draft) return
    try { await downloadEntityDocument(campagneId, draft.id, kind, name) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Document introuvable.') }
  }

  async function generate() {
    if (!draft || !canExport) return
    try {
      await generateConvention(campagneId, 'sponsoring', {
        entreprise: draft.entreprise,
        contact: draft.contact,
        adresse: draft.adresse,
        montant: euros(draft.montant),
        campagne: selectedCampagne?.nom ?? campagneId,
        date: draft.date ? new Date(`${draft.date}T12:00:00`).toLocaleDateString('fr-FR') : '',
        contreparties: draft.benefits.filter(item => item.planned).map(item => `• ${item.label}`).join('\n'),
      }, `convention-sponsoring-${safeName(draft.entreprise)}.docx`)
      setNotice('Convention Word générée à partir du modèle de la campagne.')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Génération impossible.')
    }
  }

  async function bilan() {
    if (!draft || !canExport) return
    const pdf = new jsPDF()
    const margin = 18
    let y = 24
    const line = (value: string, size = 11) => {
      pdf.setFontSize(size)
      const text = pdf.splitTextToSize(value, 172) as string[]
      if (y + text.length * 6 > 275) { pdf.addPage(); y = 24 }
      pdf.text(text, margin, y)
      y += Math.max(1, text.length) * 6 + 3
    }
    pdf.setTextColor(23, 59, 109)
    line('OPÉRATION BRIOCHE — BILAN DE SPONSORING', 17)
    pdf.setTextColor(38, 51, 70)
    line(`Campagne : ${selectedCampagne?.nom ?? campagneId}`)
    line(`Entreprise : ${draft.entreprise}`)
    line(`Montant : ${euros(draft.montant)} · Statut : ${STATUS[draft.statut]}`)
    y += 5
    line(`CONTREPARTIES : ${done} réalisées sur ${planned} prévues`, 13)
    for (const item of draft.benefits.filter(benefit => benefit.planned)) {
      line(`${item.done ? '[X]' : '[ ]'} ${item.label}${item.doneAt ? ` (${item.doneAt})` : ''}`)
      if (item.comment) line(`     ${item.comment}`)
      if (item.proof) line(`     Justificatif : ${item.proof.name}`)
    }
    if (draft.notes) { y += 4; line('COMMENTAIRES', 13); line(draft.notes) }
    // Les images sont intégrées au PDF ; les justificatifs Word/PDF restent téléchargeables à part.
    for (const item of draft.benefits.filter(benefit => benefit.planned && benefit.proof && /\.(png|jpe?g|webp)$/i.test(benefit.proof.name))) {
      try {
        const blob = await getEntityDocumentBlob(campagneId, draft.id, `preuve-${item.id}`)
        if (!blob) continue
        const bitmap = await createImageBitmap(blob)
        const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        const ratio = canvas.width / canvas.height
        const width = Math.min(170, 235 * ratio)
        const height = width / ratio
        pdf.addPage()
        pdf.setFontSize(13)
        pdf.text(pdf.splitTextToSize(`Justificatif : ${item.label}`, 170), 18, 20)
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.83), 'JPEG', 18, 28, width, height)
      } catch {
        // Le nom du justificatif demeure présent dans le bilan, même si l'image est illisible.
      }
    }
    pdf.save(`bilan-sponsoring-${safeName(draft.entreprise)}.pdf`)
  }

  return (
    <main className="com-manage">
      <header className="com-heading">
        <div><span>COMMUNICATION · OPÉRATION BRIOCHE</span><h1>Sponsoring</h1><p>Conventions, montants et retour sur image, au même endroit.</p><small>{selectedCampagne?.nom ?? 'Aucune campagne sélectionnée'}</small></div>
        {canCreate && <button type="button" className="com-button primary" onClick={create}><Plus size={17} /> Nouveau partenariat</button>}
      </header>
      <div className="com-stats">
        <div><small>Partenariats</small><strong>{campaignRows.length}</strong></div>
        <div><small>Montant total déclaré</small><strong>{euros(total)}</strong></div>
        <div><small>Conventions signées</small><strong>{campaignRows.filter(row => ['signee', 'terminee'].includes(row.statut)).length}</strong></div>
      </div>
      {error && <p className="com-alert error" role="alert">{error}</p>}
      {notice && <p className="com-alert success" role="status"><CheckCircle2 size={16}/>{notice}</p>}
      <div className="com-layout">
        <aside className="com-panel com-list">
          <label><span>Rechercher un partenaire</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Entreprise, contact…" /></label>
          {visible.length === 0 && <p className="com-muted">Aucun sponsoring pour cette campagne.</p>}
          {visible.map(row => {
            const promised = row.benefits.filter(item => item.planned)
            const completed = promised.filter(item => item.done).length
            return <button type="button" key={row.id} className={`com-list-item ${selectedId === row.id ? 'selected' : ''}`} onClick={() => select(row)}>
              <strong>{row.entreprise}</strong><span>{euros(row.montant)} · {STATUS[row.statut]}</span><small>{completed}/{promised.length} engagements réalisés</small>
            </button>
          })}
        </aside>
        <section className="com-panel com-detail">
          {!draft ? <div className="com-empty"><FileText size={36}/><h2>Sélectionnez un partenaire</h2><p>Retrouvez sa convention, les contreparties et les justificatifs.</p></div> : <form onSubmit={save}>
            <div className="com-detail-head"><h2>{rows.some(row => row.id === draft.id) ? 'Fiche partenaire' : 'Nouveau partenariat'}</h2><button type="button" className="com-button light" onClick={() => { setDraft(null); setSelectedId('') }}><X size={15}/> Fermer</button></div>
            <div className="com-fields">
              <label><span>Entreprise référencée</span><select disabled={!canEdit} value={draft.donateurId ?? ''} onChange={event => setDonor(event.target.value)}><option value="">Saisie libre</option>{donateurs.filter(item => !item.archive).map(item => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></label>
              <label><span>Entreprise *</span><input required disabled={!canEdit} value={draft.entreprise} onChange={event => setDraft({ ...draft, entreprise: event.target.value })}/></label>
              <label><span>Contact</span><input disabled={!canEdit} value={draft.contact} onChange={event => setDraft({ ...draft, contact: event.target.value })}/></label>
              <label><span>Adresse</span><input disabled={!canEdit} value={draft.adresse} onChange={event => setDraft({ ...draft, adresse: event.target.value })}/></label>
              <label><span>Montant (€) *</span><input required type="number" min="0" step="0.01" disabled={!canEdit} value={draft.montant} onChange={event => setDraft({ ...draft, montant: Number(event.target.value) })}/></label>
              <label><span>Date</span><input type="date" disabled={!canEdit} value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })}/></label>
              <label><span>Statut</span><select disabled={!canEdit} value={draft.statut} onChange={event => setDraft({ ...draft, statut: event.target.value as SponsoringStatus })}>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <section className="com-block"><h3>Convention de sponsoring</h3><p>Le Word officiel est ajouté dans Administration → Campagnes → Documents.</p>
              <div className="com-actions">
                {canExport && <button type="button" className="com-button blue" onClick={() => void generate()}><FileText size={17}/> Générer la convention Word</button>}
                {canEdit && <label className="com-button light com-file"><Upload size={16}/> {draft.signedConvention ? 'Remplacer la convention signée' : 'Ajouter la convention signée'}<input type="file" accept=".pdf,.docx" onChange={event => { void uploadDocument('convention-signee', event.target.files?.[0]); event.target.value = '' }}/></label>}
                {draft.signedConvention && canExport && <button type="button" className="com-button light" onClick={() => void downloadDocument('convention-signee', draft.signedConvention!.name)}><Download size={16}/> {draft.signedConvention.name}</button>}
              </div>
            </section>
            <section className="com-block"><div className="com-block-heading"><div><h3>Retour sur image et contreparties</h3><p>{done}/{planned} engagements réalisés</p></div><strong>{planned ? Math.round(done / planned * 100) : 0}%</strong></div>
              <div className="com-benefits">
                {draft.benefits.map(item => <div className="com-benefit" key={item.id}>
                  <div className="com-benefit-head"><strong>{item.label}</strong>{canEdit && <button type="button" className="com-icon" title="Retirer cette contrepartie" onClick={() => setDraft({ ...draft, benefits: draft.benefits.filter(benefit => benefit.id !== item.id) })}><Trash2 size={15}/></button>}</div>
                  <div className="com-benefit-controls"><label><input type="checkbox" disabled={!canEdit} checked={item.planned} onChange={event => updateBenefit(item.id, { planned: event.target.checked, done: event.target.checked ? item.done : false })}/> Prévue</label><label><input type="checkbox" disabled={!canEdit || !item.planned} checked={item.done && item.planned} onChange={event => updateBenefit(item.id, { done: event.target.checked, doneAt: event.target.checked ? (item.doneAt || new Date().toISOString().slice(0, 10)) : '' })}/> Réalisée</label></div>
                  {item.planned && <div className="com-benefit-details"><label><span>Date</span><input type="date" disabled={!canEdit} value={item.doneAt} onChange={event => updateBenefit(item.id, { doneAt: event.target.value })}/></label><label><span>Commentaire</span><input disabled={!canEdit} value={item.comment} onChange={event => updateBenefit(item.id, { comment: event.target.value })} placeholder="Ex. publication du 14 novembre"/></label></div>}
                  {item.planned && <div className="com-actions">{canEdit && <label className="com-button light com-file"><Upload size={15}/> {item.proof ? 'Remplacer la preuve' : 'Ajouter une preuve'}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={event => { void uploadDocument(`preuve-${item.id}`, event.target.files?.[0]); event.target.value = '' }}/></label>}{item.proof && canExport && <button type="button" className="com-button light" onClick={() => void downloadDocument(`preuve-${item.id}`, item.proof!.name)}><Download size={15}/>{item.proof.name}</button>}</div>}
                </div>)}
              </div>
              {canEdit && <div className="com-add-benefit"><input value={newBenefit} onChange={event => setNewBenefit(event.target.value)} placeholder="Autre contrepartie personnalisée"/><button type="button" className="com-button light" disabled={!newBenefit.trim()} onClick={() => { setDraft({ ...draft, benefits: [...draft.benefits, makeBenefit(newBenefit.trim())] }); setNewBenefit('') }}><Plus size={15}/> Ajouter</button></div>}
            </section>
            <label className="com-notes"><span>Notes sur le partenariat</span><textarea rows={3} disabled={!canEdit} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })}/></label>
            <div className="com-actions com-bottom">{canExport && <button type="button" className="com-button blue" onClick={() => void bilan()}><Download size={17}/> Bilan PDF</button>}{canDelete && isExisting && <button type="button" className="com-button danger" onClick={() => void remove()}><Trash2 size={16}/> Supprimer</button>}{canEdit && <button type="submit" className="com-button primary"><Save size={16}/> Enregistrer</button>}</div>
          </form>}
        </section>
      </div>
      <p className="com-disclaimer">Prototype : données et pièces jointes enregistrées localement dans ce navigateur, sans synchronisation entre postes. Les montants de sponsoring ne sont pas ajoutés automatiquement à la comptabilité.</p>
    </main>
  )
}

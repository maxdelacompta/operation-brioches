import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, ClipboardList, FileDown, FileText, GraduationCap, Plus, Save, ScanLine, Search, Trash2, UploadCloud } from 'lucide-react'
import { useObData } from '../contexts/ObDataContext'
import { useUsers } from '../contexts/UsersContext'
import { usePermissions } from '../contexts/permissionsState'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import { emptyClass, emptySchool, emptySchoolFlyerSettings, normalizeStudentName, readSchoolData, schoolId, writeSchoolData, type School, type SchoolClass, type SchoolData, type SchoolFlyerSettings, type SchoolOrder } from '../services/ecolesStore'
import { exportClassSheet, exportIndividualOrder, exportSchoolRecapPdf } from '../services/ecolesPdf'
import { scanSchoolFiles, type ScannedOrderDraft } from '../services/ecolesOcr'
import './CommunicationManagement.css'
import './Ecoles.css'

type Tab = 'ecoles' | 'commandes' | 'recap'
const EURO = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function safeInteger(value: number) { return Number.isInteger(value) && value > 0 && value <= 500 }
export default function Ecoles() {
  const { selectedCampagne } = useObData()
  const { currentUser } = useUsers()
  const { hasPermission } = usePermissions()
  const writable = useCampaignWriteAccess()
  const campaignId = selectedCampagne?.id ?? ''
  const price = Math.max(0, selectedCampagne?.prixUnitaire ?? 0)
  const can = (action: 'consulter' | 'creer' | 'modifier' | 'valider' | 'exporter' | 'supprimer') =>
    Boolean(currentUser && hasPermission(currentUser.role, 'ecoles', action) && (action === 'consulter' || action === 'exporter' || writable) && campaignId)
  const [data, setData] = useState<SchoolData>({ schools: [], orders: [] })
  const [flyerForm, setFlyerForm] = useState<SchoolFlyerSettings>(emptySchoolFlyerSettings())
  const context = { campaignId, campaignName: selectedCampagne?.nom ?? 'Sans campagne', price,
    flyer: data.flyerSettingsByCampaign?.[campaignId] }
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('ecoles')
  const [showOCR, setShowOCR] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [editor, setEditor] = useState<School | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualQty, setManualQty] = useState(1)
  const [manualClass, setManualClass] = useState('')
  const [drafts, setDrafts] = useState<ScannedOrderDraft[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')

  useEffect(() => {
    let alive = true
    void readSchoolData().then(result => { if (alive) { setData(result); setReady(true) } })
      .catch(e => { if (alive) { setReady(true); setError(e instanceof Error ? e.message : 'Stockage écoles indisponible.') } })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    setFlyerForm(data.flyerSettingsByCampaign?.[campaignId] ?? emptySchoolFlyerSettings())
  }, [campaignId, data.flyerSettingsByCampaign])
  async function saveFlyerSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!can('modifier')) return
    await persist({ ...data, flyerSettingsByCampaign: { ...data.flyerSettingsByCampaign,
      [campaignId]: { ...flyerForm } } }, 'Présentation aux familles enregistrée pour cette campagne.')
  }
  const school = data.schools.find(s => s.id === selectedId) ?? null
  const participating = useMemo(() => data.schools.flatMap(s => s.classes.filter(cls => cls.campaignIds.includes(campaignId)).map(cls => ({ ...cls, school: s }))), [data.schools, campaignId])
  const campaignOrders = useMemo(() => data.orders.filter(o => o.campaignId === campaignId), [data.orders, campaignId])
  const totalQty = campaignOrders.reduce((sum, o) => sum + o.quantity, 0)
  const visibleSchools = data.schools.filter(s => `${s.name} ${s.city} ${s.code}`.toLowerCase().includes(search.toLowerCase()))
  const schoolOrders = campaignOrders.filter(o => o.schoolId === selectedId)
  const updateEditor = (patch: Partial<School>) => setEditor(prev => prev ? { ...prev, ...patch } : null)
  const updateClass = (id: string, patch: Partial<SchoolClass>) => setEditor(prev => prev ? { ...prev, classes: prev.classes.map(cls => cls.id === id ? { ...cls, ...patch } : cls) } : null)
  async function persist(next: SchoolData, success: string): Promise<boolean> {
    if (saving) return false
    setSaving(true); setError('')
    try { await writeSchoolData(next); setData(next); setNotice(success); return true }
    catch (e) { setError(e instanceof Error ? `Enregistrement impossible : ${e.message}` : 'Enregistrement impossible.'); return false }
    finally { setSaving(false) }
  }
  async function saveSchool(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editor || !can(data.schools.some(s => s.id === editor.id) ? 'modifier' : 'creer')) return
    if (!editor.name.trim() || !editor.city.trim()) { setError('Le nom et la commune sont obligatoires.'); return }
    if (editor.classes.some(c => !c.name.trim())) { setError('Chaque classe doit avoir un nom.'); return }
    const cleaned = { ...editor, name: editor.name.trim(), city: editor.city.trim(), code: editor.id,
      classes: editor.classes.map(cls => ({ ...cls, name: cls.name.trim(), code: cls.id })) }
    const isExisting = data.schools.some(s => s.id === cleaned.id)
    const schools = isExisting ? data.schools.map(s => s.id === cleaned.id ? cleaned : s) : [...data.schools, cleaned]
    if (await persist({ ...data, schools }, isExisting ? 'École modifiée.' : 'École créée.')) { setSelectedId(cleaned.id); setEditor(null) }
  }
  async function deleteSchool() {
    if (!school || !can('supprimer') || saving) return
    if (data.orders.some(o => o.schoolId === school.id)) { setError('Suppression bloquée : cette école possède un historique de commandes.'); return }
    if (!window.confirm(`Supprimer définitivement ${school.name} et ses classes ?`)) return
    if (await persist({ ...data, schools: data.schools.filter(s => s.id !== school.id) }, 'École supprimée.')) setSelectedId('')
  }
  async function saveManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!can('creer') || !manualClass || !manualName.trim() || !safeInteger(manualQty)) { setError('Nom, classe et quantité (1 à 500) obligatoires.'); return }
    const cls = participating.find(c => c.id === manualClass)
    if (!cls) { setError('La classe ne participe pas à cette campagne.'); return }
    const duplicate = campaignOrders.some(o => o.classId === manualClass && normalizeStudentName(o.studentName) === normalizeStudentName(manualName))
    if (duplicate) { setError('Une commande existe déjà pour cet élève dans cette classe. Utilise la modification plutôt que créer un doublon.'); return }
    const next: SchoolOrder = { id: schoolId('CMD'), campaignId, schoolId: cls.school.id, classId: manualClass,
      studentName: manualName.trim(), quantity: manualQty, source: 'manuel', sourceFile: '', sourcePage: 0, createdAt: new Date().toISOString() }
    if (await persist({ ...data, orders: [...data.orders, next] }, 'Commande enregistrée.')) { setManualName(''); setManualQty(1) }
  }
  async function deleteOrder(order: SchoolOrder) {
    if (!can('supprimer') || !window.confirm(`Supprimer la commande de ${order.studentName} ?`)) return
    await persist({ ...data, orders: data.orders.filter(o => o.id !== order.id) }, 'Commande supprimée.')
  }
  async function changeQuantity(order: SchoolOrder) {
    if (!can('modifier')) return
    const value = window.prompt(`Nouvelle quantité pour ${order.studentName}`, String(order.quantity))
    if (value === null) return
    const n = Number(value)
    if (!safeInteger(n)) { setError('La quantité doit être un entier entre 1 et 500.'); return }
    await persist({ ...data, orders: data.orders.map(o => o.id === order.id ? { ...o, quantity: n } : o) }, 'Quantité modifiée.')
  }
  async function importFiles(files: File[]) {
    if (!can('valider') || !files.length) return
    setShowOCR(true); setScanning(true); setError(''); setScanProgress('Initialisation de la lecture…')
    try {
      const results = await scanSchoolFiles(files, data.schools, setScanProgress)
      setDrafts(prev => [...prev, ...results]); setNotice(`${results.length} ligne(s) proposées. Contrôle manuel obligatoire avant enregistrement.`)
      setScanProgress('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de lecture OCR.') }
    finally { setScanning(false) }
  }
  function updateDraft(id: string, patch: Partial<ScannedOrderDraft>) { setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d)) }
  async function validateDraft(draft: ScannedOrderDraft) {
    if (!can('valider')) return
    const s = data.schools.find(s => s.id === draft.schoolId)
    const cls = s?.classes.find(c => c.id === draft.classId && c.campaignIds.includes(campaignId))
    if (!s || !cls || !draft.studentName.trim() || !safeInteger(draft.quantity)) { setError('Sélectionne une école, une classe participante, un nom et une quantité entière (1 à 500).'); return }
    const duplicate = campaignOrders.some(o => o.classId === draft.classId && normalizeStudentName(o.studentName) === normalizeStudentName(draft.studentName))
    if (duplicate) { setError(`Doublon possible : ${draft.studentName} possède déjà une commande dans cette classe.`); return }
    const record: SchoolOrder = { id: schoolId('CMD'), campaignId, schoolId: s.id, classId: cls.id,
      studentName: draft.studentName.trim(), quantity: draft.quantity, source: 'ocr', sourceFile: draft.filename,
      sourcePage: draft.page, createdAt: new Date().toISOString() }
    if (await persist({ ...data, orders: [...data.orders, record] }, 'Retour OCR vérifié et affecté.')) setDrafts(prev => prev.filter(row => row.id !== draft.id))
  }
  function addDraftRow(draft: ScannedOrderDraft) {
    setDrafts(prev => [...prev, { ...draft, id: schoolId('CMD'), studentName: '', quantity: 0 }])
  }
  function exportCsv() {
    if (!can('exporter')) return
    const header = ['Campagne', 'École', 'Classe', 'Élève', 'Brioches', 'Prix unitaire', 'Montant', 'Source', 'Document']
    const rows = campaignOrders.map(order => {
      const s = data.schools.find(s => s.id === order.schoolId)
      return [context.campaignName, s?.name ?? '', s?.classes.find(c => c.id === order.classId)?.name ?? '', order.studentName,
        order.quantity, price.toFixed(2), (price * order.quantity).toFixed(2), order.source, order.sourceFile]
    })
    downloadCSV(`Ecoles_commandes_${campaignId}.csv`, [header, ...rows])
  }
  const totalsBySchool = data.schools.map(s => {
    const orders = campaignOrders.filter(o => o.schoolId === s.id)
    const qty = orders.reduce((sum, o) => sum + o.quantity, 0)
    return { s, orders: orders.length, qty }
  })

  return <main className="com-manage ecoles-page">
    <header className="com-heading">
      <div><span>GESTION · OPÉRATION BRIOCHE</span><h1>Écoles</h1>
        <p>Établissements, classes, bons de commande, lecture OCR et récapitulatifs.</p>
        <small>{selectedCampagne?.nom ?? 'Sélectionne une campagne pour commencer'}</small></div>
      {tab === 'ecoles' && can('creer') && <button className="com-button primary" type="button" onClick={() => { setEditor(emptySchool()); setError('') }}><Plus size={16}/> Nouvelle école</button>}
    </header>
    <div className="com-stats ecoles-stats">
      <div><small>Écoles enregistrées</small><strong>{data.schools.length}</strong></div>
      <div><small>Classes participantes</small><strong>{participating.length}</strong></div>
      <div><small>Brioches commandées</small><strong>{totalQty}</strong></div>
      <div><small>Montant estimé</small><strong>{EURO(totalQty * price)}</strong></div>
    </div>
    <nav className="ecoles-tabs" aria-label="Sections Écoles">
      {([['ecoles', 'Établissements', GraduationCap], ['commandes', 'Commandes', ClipboardList], ['recap', 'Récapitulatif', FileText]] as const).map(([value, label, Icon]) =>
        <button type="button" key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); setError('') }}><Icon size={17}/>{label}{value === 'commandes' && drafts.length > 0 && <b title="Retours OCR en attente de validation">{drafts.length}</b>}</button>)}
    </nav>
    {!ready && <p className="com-muted">Ouverture du registre des écoles…</p>}
    {notice && <p className="com-alert success" role="status"><Check size={16}/>{notice}</p>}
    {error && <p className="com-alert error" role="alert">{error}</p>}
    {ready && <>
      {tab === 'ecoles' && <div className="com-layout">
        <aside className="com-panel com-list"><label><span>Rechercher une école</span><div className="ecoles-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, ville…"/></div></label>
          {visibleSchools.length === 0 && <p className="com-muted">Aucune école enregistrée.</p>}
          {visibleSchools.map(s => <button key={s.id} type="button" className={`com-list-item ${selectedId === s.id ? 'selected' : ''}`}
            onClick={() => { setSelectedId(s.id); setEditor(null) }}><strong>{s.name}</strong><small>{s.city} · {s.classes.length} classe(s)</small><small>{s.id}</small></button>)}
        </aside>
        <section className="com-panel">
          {editor ? <>
            <div className="com-detail-head"><h2>{data.schools.some(s => s.id === editor.id) ? 'Modifier l’école' : 'Nouvelle école'}</h2><button type="button" className="com-button light" onClick={() => setEditor(null)}>Annuler</button></div>
            <form onSubmit={saveSchool}>
              <div className="com-fields">
                <label><span>Nom de l’école *</span><input required value={editor.name} onChange={e => updateEditor({ name: e.target.value })}/></label>
                <label><span>Type d’établissement</span><select value={editor.category} onChange={e => updateEditor({ category: e.target.value })}><option>École maternelle</option><option>École élémentaire</option><option>École primaire</option><option>Collège</option><option>Lycée</option><option>Autre établissement</option></select></label>
                <label className="com-full"><span>Adresse</span><input value={editor.address} onChange={e => updateEditor({ address: e.target.value })}/></label>
                <label><span>Code postal</span><input value={editor.postalCode} onChange={e => updateEditor({ postalCode: e.target.value })}/></label>
                <label><span>Commune *</span><input required value={editor.city} onChange={e => updateEditor({ city: e.target.value })}/></label>
                <label><span>Direction</span><input value={editor.director} onChange={e => updateEditor({ director: e.target.value })}/></label>
                <label><span>Référent opération</span><input value={editor.contact} onChange={e => updateEditor({ contact: e.target.value })}/></label>
                <label><span>Téléphone</span><input type="tel" value={editor.phone} onChange={e => updateEditor({ phone: e.target.value })}/></label>
                <label><span>Adresse e-mail</span><input type="email" value={editor.email} onChange={e => updateEditor({ email: e.target.value })}/></label>
                <label><span>Date limite des bons à retourner</span><input type="date" value={editor.orderReturnDate ?? ''} onChange={e => updateEditor({ orderReturnDate: e.target.value })}/></label>
                <label><span>Livraison / distribution dans l’école</span><input maxLength={140} value={editor.deliveryInfo ?? ''} onChange={e => updateEditor({ deliveryInfo: e.target.value })} placeholder="Ex. Livraison en avril, distribution par les enseignants"/></label>
                <label className="com-full"><span>Notes (sans données sensibles)</span><textarea value={editor.notes} onChange={e => updateEditor({ notes: e.target.value })} rows={2}/></label>
              </div>
              <section className="com-block"><div className="com-block-heading"><h3>Classes concernées</h3><button type="button" className="com-button blue" onClick={() => updateEditor({ classes: [...editor.classes, emptyClass(campaignId)] })}><Plus size={15}/> Ajouter une classe</button></div>
                <p>Les classes sont pérennes. Coche « Participe » pour les inclure dans la campagne sélectionnée.</p>
                {editor.classes.map(cls => {
                  const hasOrders = data.orders.some(o => o.classId === cls.id)
                  return <div className="ecoles-class-edit" key={cls.id}>
                    <label><span>Classe *</span><input required value={cls.name} placeholder="CM1 A" onChange={e => updateClass(cls.id, { name: e.target.value })}/></label>
                    <label><span>Niveau</span><input value={cls.level} placeholder="CM1" onChange={e => updateClass(cls.id, { level: e.target.value })}/></label>
                    <label><span>Enseignant(e)</span><input value={cls.teacher} onChange={e => updateClass(cls.id, { teacher: e.target.value })}/></label>
                    <label className="ecoles-participate"><input type="checkbox" checked={cls.campaignIds.includes(campaignId)} disabled={data.orders.some(o => o.classId === cls.id && o.campaignId === campaignId)} title={data.orders.some(o => o.classId === cls.id && o.campaignId === campaignId) ? 'Impossible de désinscrire une classe avec des commandes sur cette campagne' : undefined} onChange={e => updateClass(cls.id, { campaignIds: e.target.checked ? [...new Set([...cls.campaignIds, campaignId])] : cls.campaignIds.filter(id => id !== campaignId) })}/> Participe</label>
                    <button disabled={hasOrders} type="button" className="com-button danger" title={hasOrders ? 'Suppression impossible : historique des commandes' : 'Retirer cette classe'} onClick={() => updateEditor({ classes: editor.classes.filter(c => c.id !== cls.id) })}><Trash2 size={16}/></button>
                  </div>
                })}
              </section>
              <div className="com-actions com-bottom"><button className="com-button primary" disabled={saving} type="submit"><Save size={16}/> Enregistrer l’école</button></div>
            </form>
          </> : school ? <>
            <div className="com-detail-head"><h2>{school.name}</h2><div className="com-actions">{can('modifier') && <button type="button" className="com-button light" onClick={() => setEditor({ ...school, classes: school.classes.map(c => ({ ...c, campaignIds: [...c.campaignIds] })) })}>Modifier</button>}{can('supprimer') && <button type="button" className="com-button danger" onClick={() => void deleteSchool()}><Trash2 size={16}/></button>}</div></div>
            <p className="com-muted">{school.category} · {school.address} · {school.postalCode} {school.city}</p>
            <div className="ecoles-facts"><div><small>Direction</small><strong>{school.director || '—'}</strong></div><div><small>Contact</small><strong>{school.contact || '—'}</strong></div><div><small>Téléphone</small><strong>{school.phone || '—'}</strong></div><div><small>E-mail</small><strong>{school.email || '—'}</strong></div></div>
            <h3>Classes de l’établissement</h3><div className="ecoles-table-wrap"><table className="com-table"><thead><tr><th>Classe</th><th>Enseignant(e)</th><th>Campagne</th><th>Documents</th></tr></thead><tbody>
              {school.classes.length === 0 && <tr><td colSpan={4}>Aucune classe renseignée.</td></tr>}
              {school.classes.map(cls => <tr key={cls.id}><td><strong>{cls.name}</strong><br/><small>{cls.level || cls.id}</small></td><td>{cls.teacher || '—'}</td><td>{cls.campaignIds.includes(campaignId) ? 'Participante' : 'Non inscrite'}</td><td><div className="com-actions">
                {cls.campaignIds.includes(campaignId) && can('exporter') && <><button type="button" className="com-button light" onClick={() => exportClassSheet(school, cls, context, campaignOrders)}><FileDown size={15}/> Feuille classe</button><button type="button" className="com-button blue" onClick={() => { void exportIndividualOrder(school, cls, context).catch(e => setError(e instanceof Error ? e.message : 'Échec de génération du bon individuel.')) }}><FileDown size={15}/> Bon individuel</button></>}
              </div></td></tr>)}
            </tbody></table></div>
            <div className="com-actions" style={{ marginTop: 19 }}><button type="button" className="com-button blue" onClick={() => { setTab('commandes'); setManualClass(school.classes.find(c => c.campaignIds.includes(campaignId))?.id ?? '') }}>Suivre les commandes</button>{can('exporter') && <button type="button" className="com-button light" onClick={() => exportSchoolRecapPdf(school, schoolOrders, context)}>Exporter le récapitulatif PDF</button>}</div>
          </> : <div className="com-empty"><GraduationCap size={38}/><h2>Répertoire des écoles</h2><p>Sélectionne une école ou crée sa fiche pour renseigner les classes.</p></div>}
        </section>
      </div>}
      {tab === 'commandes' && <section className="com-panel">
        <div className="ecoles-flyer-notice"><strong>Bon individuel recto-verso avec partie détachable</strong><p>La campagne peut contenir un modèle PDF personnalisable dans Campagnes → Documents, comme pour les JDI. Le coupon détachable OCR est protégé : seule la partie haute du verso et le recto sont personnalisables. Impression A4 paysage recto-verso.</p></div>
        <form className="ecoles-flyer-config" onSubmit={e => void saveFlyerSettings(e)}>
          <div className="com-detail-head"><h2>Texte de présentation aux familles</h2><small>Texte utilisé si aucun PDF personnalisé n’est importé</small></div>
          <div className="com-fields">
            <label><span>Dates de l’Opération Brioches</span><input maxLength={85} value={flyerForm.operationDates} onChange={e => setFlyerForm(prev => ({ ...prev, operationDates: e.target.value }))} placeholder="Ex. Du 23 au 29 mars 2026"/></label>
            <label><span>Projet financé par cette campagne</span><input maxLength={150} value={flyerForm.fundedProject} onChange={e => setFlyerForm(prev => ({ ...prev, fundedProject: e.target.value }))} placeholder="Ex. La création de la première crèche de l’AEIM"/></label>
            <label className="com-full"><span>Message aux familles (facultatif)</span><textarea rows={3} maxLength={270} value={flyerForm.familyMessage} onChange={e => setFlyerForm(prev => ({ ...prev, familyMessage: e.target.value }))} placeholder="Votre école participe à une action solidaire locale..."/></label>
          </div>
          <div className="com-actions"><button className="com-button blue" disabled={!can('modifier') || saving} type="submit"><Save size={15}/> Enregistrer le texte du bon</button></div>
          <small className="com-muted">La date limite de retour se renseigne dans chaque fiche école. Le montant minimum provient du prix unitaire de la campagne. Vérifie ces éléments avant l’impression.</small>
        </form>
        <div className="com-detail-head ecoles-orders-head">
          <h2>Commandes des élèves</h2>
          <div className="ecoles-orders-actions">
            <small>{campaignOrders.length} commande(s) sur la campagne</small>
            <button type="button" className="com-button blue" aria-expanded={showOCR} aria-controls="ecoles-ocr-import" disabled={scanning} onClick={() => setShowOCR(visible => !visible)}>
              <ScanLine size={16}/>{showOCR ? 'Masquer l’import OCR' : 'Importer des bons (OCR)'}
              {drafts.length > 0 && <span className="ecoles-pending-count">{drafts.length} à vérifier</span>}
            </button>
          </div>
        </div>
        {can('creer') && <form className="ecoles-order-form" onSubmit={e => void saveManual(e)}>
          <label><span>Classe participante</span><select value={manualClass} required onChange={e => setManualClass(e.target.value)}><option value="">Choisir…</option>{participating.map(cls => <option key={cls.id} value={cls.id}>{cls.school.name} / {cls.name}</option>)}</select></label>
          <label><span>Nom et prénom de l’élève</span><input required maxLength={90} value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nom Prénom"/></label>
          <label><span>Nombre de brioches</span><input type="number" min={1} max={500} step={1} required value={manualQty} onChange={e => setManualQty(Number(e.target.value))}/></label>
          <button type="submit" className="com-button primary" disabled={saving}>Enregistrer</button>
        </form>}
        {showOCR && <div className="ecoles-ocr-inline" id="ecoles-ocr-import">
        <h2>Lecture des retours de bons de commande</h2>
        <p className="com-muted">Importe des scans PDF, JPG ou PNG. L’OCR essaie d’identifier les codes école/classe et les noms. Toute ligne doit être relue et confirmée : la lecture de l’écriture manuscrite peut être inexacte.</p>
        <div className="ecoles-import"><UploadCloud size={26}/><div><strong>Importer les bons retournés</strong><small>PDF ou images · 30 Mo maximum par fichier · jusqu’à 40 pages par PDF</small></div><input type="file" multiple accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" disabled={scanning || !can('valider')} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void importFiles(files) }}/></div>
        {scanning && <p className="com-muted" role="status">Lecture en cours : {scanProgress}</p>}
        {drafts.length === 0 && !scanning && <p className="com-muted">Aucun document en attente de vérification.</p>}
        {drafts.map((draft, index) => <div className="ecoles-review" key={draft.id}>
          <div className="ecoles-review-head"><strong>Retour {index + 1} · {draft.filename} (page {draft.page})</strong><span>{draft.confidence}</span></div>
          <div className="ecoles-review-grid"><div className="ecoles-preview">{draft.preview && <img src={draft.preview} alt={`Aperçu scanné ${draft.filename} page ${draft.page}`}/>}<details><summary>Texte lu par l’OCR</summary><pre>{draft.rawText || 'Aucun texte reconnu.'}</pre></details></div>
            <div className="ecoles-review-fields">
              <label><span>École</span><select value={draft.schoolId} onChange={e => updateDraft(draft.id, { schoolId: e.target.value, classId: '' })}><option value="">Sélectionner une école…</option>{data.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label><span>Classe de la campagne</span><select value={draft.classId} onChange={e => updateDraft(draft.id, { classId: e.target.value })}><option value="">Sélectionner une classe…</option>{data.schools.find(s => s.id === draft.schoolId)?.classes.filter(c => c.campaignIds.includes(campaignId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label><span>Nom et prénom (à vérifier)</span><input value={draft.studentName} onChange={e => updateDraft(draft.id, { studentName: e.target.value })}/></label>
              <label><span>Quantité (à vérifier)</span><input type="number" min={1} max={500} step={1} value={draft.quantity || ''} onChange={e => updateDraft(draft.id, { quantity: Number(e.target.value) })}/></label>
              <p className="com-muted">Le document n’est enregistré qu’après validation. Pour une feuille avec plusieurs élèves, ajoute des lignes supplémentaires si l’OCR n’a pas tout reconnu.</p>
              <div className="com-actions"><button type="button" className="com-button light" onClick={() => addDraftRow(draft)}><Plus size={15}/> Ajouter une ligne</button><button type="button" className="com-button blue" disabled={!can('valider') || saving} onClick={() => void validateDraft(draft)}><Check size={15}/> Valider et affecter</button><button type="button" className="com-button danger" onClick={() => setDrafts(prev => prev.filter(x => x.id !== draft.id))}>Ignorer</button></div>
            </div>
          </div>
        </div>)}
        </div>}
        <div className="ecoles-table-wrap"><table className="com-table"><thead><tr><th>École</th><th>Classe</th><th>Élève</th><th>Quantité</th><th>Montant estimé</th><th>Origine</th><th>Actions</th></tr></thead><tbody>
          {campaignOrders.length === 0 && <tr><td colSpan={7}>Aucune commande pour cette campagne.</td></tr>}
          {campaignOrders.map(order => { const s = data.schools.find(s => s.id === order.schoolId); return <tr key={order.id}><td>{s?.name ?? '—'}</td><td>{s?.classes.find(cls => cls.id === order.classId)?.name ?? '—'}</td><td><strong>{order.studentName}</strong></td><td>{order.quantity}</td><td>{EURO(order.quantity * price)}</td><td>{order.source === 'ocr' ? `OCR · ${order.sourceFile}` : 'Saisie'}</td><td><div className="com-asset-actions">{can('modifier') && <button type="button" className="com-button light" onClick={() => void changeQuantity(order)}>Qté</button>}{can('supprimer') && <button type="button" className="com-button danger" onClick={() => void deleteOrder(order)}><Trash2 size={15}/></button>}</div></td></tr> })}
        </tbody></table></div>
      </section>}
      {tab === 'recap' && <section className="com-panel">
        <div className="com-detail-head"><h2>Récapitulatif de la campagne</h2>{can('exporter') && <button className="com-button blue" type="button" onClick={exportCsv}><FileDown size={16}/> Export nominatif CSV</button>}</div>
        <p className="com-muted">Prix unitaire actuellement défini dans la campagne : {EURO(price)}. Montants indicatifs, sans rapprochement avec les règlements.</p>
        <div className="ecoles-table-wrap"><table className="com-table"><thead><tr><th>École</th><th>Classe</th><th>Élèves avec commande</th><th>Brioches</th><th>Montant</th></tr></thead><tbody>
          {participating.map(cls => { const rows = campaignOrders.filter(o => o.classId === cls.id); const qty = rows.reduce((n, o) => n + o.quantity, 0); return <tr key={cls.id}><td>{cls.school.name}</td><td><strong>{cls.name}</strong></td><td>{rows.length}</td><td>{qty}</td><td>{EURO(qty * price)}</td></tr> })}
          {participating.length === 0 && <tr><td colSpan={5}>Aucune classe participante.</td></tr>}
        </tbody><tfoot><tr><th colSpan={2}>TOTAL CAMPAGNE</th><th>{campaignOrders.length}</th><th>{totalQty}</th><th>{EURO(totalQty * price)}</th></tr></tfoot></table></div>
        <h3>Détail par école</h3>
        {totalsBySchool.filter(row => row.orders > 0).map(({ s, orders, qty }) => <details className="ecoles-recap-school" key={s.id}><summary><strong>{s.name}</strong><span>{orders} élève(s) · {qty} brioches · {EURO(qty * price)}</span></summary>
          <div className="com-actions" style={{ margin: '12px 0' }}>{can('exporter') && <button type="button" className="com-button light" onClick={() => exportSchoolRecapPdf(s, campaignOrders, context)}>Télécharger le PDF école</button>}</div>
          {s.classes.map(cls => { const rows = campaignOrders.filter(o => o.classId === cls.id); return rows.length > 0 && <div key={cls.id}><h4>{cls.name}</h4><div className="ecoles-table-wrap"><table className="com-table"><thead><tr><th>Élève</th><th>Brioches</th><th>Montant</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.studentName}</td><td>{row.quantity}</td><td>{EURO(price * row.quantity)}</td></tr>)}</tbody></table></div></div> })}
        </details>)}
      </section>}
      <p className="com-disclaimer"><strong>Préproduction :</strong> ce module utilise un stockage local IndexedDB. Avant le déploiement, la DSI devra sécuriser les données nominatives des élèves : hébergement, droits d’accès, sauvegardes, durée de conservation et conformité RGPD. Aucun retour OCR n’est affecté automatiquement.</p>
    </>}
  </main>
}

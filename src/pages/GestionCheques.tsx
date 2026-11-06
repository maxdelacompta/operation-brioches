import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, ChevronDown, FileText, Landmark, Printer, Search, UploadCloud } from 'lucide-react'
import { useObData } from '../contexts/ObDataContext'
import { calculerCoffre } from '../services/coffre'
import { getCampagneJustificatifsSettings } from '../services/campagneJustificatifs'
import './GestionCheques.css'
import ScanCheques, { type ScanCheque } from './ScanCheques'
import { getChequeScan } from './chequeScanStorage'

type Statut = 'À vérifier' | 'À remettre' | 'Remis en banque' | 'Encaissé' | 'Rejeté'
type RemiseCategorie = 'Sur place' | 'Hors place'
type Cheque = { id: string; numero: string; emetteur: string; montant: number; date: string; banque: string; etablissement: string; campagne: string; statut: Statut; remiseId: string; fichier: string; departement?: string; signature?: 'Oui' | 'Non' | 'À vérifier' }
type Remise = { id: string; nom: string; date: string; statut: 'Brouillon' | 'Déposée'; operationId?: string; categorie?: RemiseCategorie; campagneId?: string; chrono?: string }
const CK = 'ob2026-cheques-v1'
const RK = 'ob2026-remises-cheques-v1'
const CHRONO_KEY = 'ob2026-remises-cheques-chrono-v1'
const today = () => new Date().toLocaleDateString('en-CA')
const euro = (n: number) => n.toLocaleString('fr-FR', {style:'currency',currency:'EUR'})
function load<T,>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback } }
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`
const nextChrono = (existing: Remise[]) => {
  const previous = Math.max(0, Number(localStorage.getItem(CHRONO_KEY) || '0'), ...existing.map(r => Number(r.chrono) || 0))
  const next = previous + 1
  localStorage.setItem(CHRONO_KEY, String(next))
  return String(next).padStart(6, '0')
}

const emplacement = (d?:string) => !d || !/^\d{2}$/.test(d) ? 'À déterminer' : ['54','55','57','88'].includes(d) ? 'Sur place' : 'Hors place'

export default function GestionCheques() {
  const { fichesCaisse, depotsBanque, campagnes, activeCampagne, selectedCampagne, setSelectedCampagneId, creerDepotBanque } = useObData()
  const campagneCoffre = selectedCampagne?.id ?? ''
  const setCampagneCoffre = setSelectedCampagneId
  const campagneActive = campagneCoffre || activeCampagne?.id || campagnes[0]?.id || ''
  const bilanCoffre = useMemo(() => {
    if (!campagneActive) return { donnees: null, erreur: 'Aucune campagne disponible.' }
    try {
      return { donnees: calculerCoffre(campagneActive, fichesCaisse, depotsBanque), erreur: '' }
    } catch (err) {
      return { donnees: null, erreur: err instanceof Error ? err.message : 'Données du coffre indisponibles.' }
    }
  }, [campagneActive, fichesCaisse, depotsBanque])
  const fichesCheques = useMemo(() => fichesCaisse.filter(f => f.campagne === campagneActive && f.nbCheques > 0), [fichesCaisse, campagneActive])
  const depotsCheques = useMemo(() => depotsBanque.filter(d => d.campagne === campagneActive && d.statut === 'ENREGISTRE' && d.nbCheques > 0), [depotsBanque, campagneActive])

  const [cheques, setCheques] = useState<Cheque[]>(() => load(CK, []))
  const [remises, setRemises] = useState<Remise[]>(() => load(RK, []))
  const [filter, setFilter] = useState<'Tous' | Statut>('Tous')
  const [search, setSearch] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [selectedRemise, setSelectedRemise] = useState('')
    const [pdfError, setPdfError] = useState('')
  const [creatingPdf, setCreatingPdf] = useState(false)
  const [scanSaving] = useState(false)
  const [scansWarning, setScansWarning] = useState('')
  const [detailRemise, setDetailRemise] = useState<string>('')
  const [viewTab, setViewTab] = useState<'bordereau'|'compta'>('bordereau')
  const [mainTab, setMainTab] = useState<'global'|'cheques'|'remises'>('global')
  const [confirmation, setConfirmation] = useState<{chrono:string;message:string}|null>(null)
  const [depositBusy, setDepositBusy] = useState(false)
  useEffect(() => { if (!confirmation) return; const timer = window.setTimeout(() => { setConfirmation(null); setMainTab('remises') }, 15000); return () => window.clearTimeout(timer) }, [confirmation])
      const detail = remises.find(r => r.id === detailRemise)
  const detailItems = detail ? cheques.filter(c => c.remiseId === detail.id) : []
  const ribDetail = detail ? getCampagneJustificatifsSettings(detail.campagneId || detailItems[0]?.campagne || campagneActive, campagnes.find(c=>c.id === (detail.campagneId || detailItems[0]?.campagne))?.annee ?? null) : null
  const groupedDetail = [
    {label:'Hors place',items:detailItems.filter(c=>emplacement(c.departement)==='Hors place')},
    {label:'Sur place',items:detailItems.filter(c=>emplacement(c.departement)==='Sur place')},
  ].filter(g=>g.items.length)
  function getComptaSettings(){
    const id = detail?.campagneId || detailItems[0]?.campagne || campagneActive
    const year = campagnes.find(c=>c.id===id)?.annee ?? null
    return getCampagneJustificatifsSettings(id,year).comptabilite
  }
  const formatRemiseDate=(value:string)=>{
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    return m ? `${m[3]}${m[2]}${m[1].slice(2)}` : ''
  }
  function makeExportRows(){
    if(!detail) return []
    const setup=getComptaSettings()
    const rows = detailItems.map(c=>({type:emplacement(c.departement)==='Sur place'?'S':'H',ref:c.numero.replace(/[^0-9]/g,''),nom:c.emetteur,bank:c.banque,amount:Math.round(c.montant*100),date:c.date,account:setup.compteDons,libelle:c.emetteur}))
    const cats = [{name:'Sur place',code:'S'},{name:'Hors place',code:'H'}]
    for(const cat of cats){const list=rows.filter(r=>r.type===cat.code);if(list.length)rows.push({type:cat.code,ref:`RC${(detail.chrono||'').padStart(6,'0')}`,nom:'',bank:'',amount:list.reduce((a,r)=>a+r.amount,0),date:detail.date,account:setup.compteBanque,libelle:`Remise de cheque(s) ${cat.name}`})}
    return rows
  }
  function validateAccounting(){
    if(!detail)return false
    const setup=getComptaSettings()
    if(!setup.compteBanque.trim()||!setup.compteDons.trim()||!setup.analytique.trim()||!setup.journal.trim()){
      setPdfError('Renseigne le compte banque, le compte dons, l’analytique et le journal dans les paramètres de la campagne.');return false
    }
    if(detailItems.some(c=>emplacement(c.departement)==='À déterminer')){setPdfError('Un département est à vérifier avant l’export.');return false}
    return true
  }
  function downloadBlob(blob:Blob,filename:string){const uri=URL.createObjectURL(blob);const a=document.createElement('a');a.href=uri;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(uri),3000)}
  async function downloadExcel(){
    if(!validateAccounting()||!detail)return
    try{
      const ExcelJS = (await import('exceljs')).default
      const wb=new ExcelJS.Workbook(), ws=wb.addWorksheet('datas')
      ws.columns=[{header:'Type de chèque',key:'type',width:18},{header:'Réf.Paiement',key:'ref',width:23},{header:'Don',key:'don',width:38},{header:'Journal',key:'journal',width:14},{header:'Echéance',key:'date',width:19},{header:'Compte général',key:'compte',width:22},{header:'Montant',key:'montant',width:17},{header:'Libéllé',key:'libelle',width:45}]
      const setup=getComptaSettings()
      const rows=makeExportRows()
      const remises=rows.filter(r=>r.ref.startsWith('RC'))
      for(const r of [...remises,...rows.filter(r=>!r.ref.startsWith('RC'))]){
        const date=new Date(`${detail.date}T12:00:00`)
        const isBank=r.ref.startsWith('RC')
        ws.addRow({type:isBank?'':r.type,ref:isBank?'REMISE-CHQ-OB':'',don:isBank?'':`${r.date} - ${r.nom}`,journal:Number(setup.journal)||setup.journal,date:isBank?'':date,compte:r.account,montant:r.amount/100,libelle:r.libelle})
      }
      ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173B70'}}
      ws.getColumn(7).numFmt='#,##0.00';ws.getColumn(5).numFmt='dd/mm/yyyy';ws.views=[{state:'frozen',ySplit:1}]
      const buffer=await wb.xlsx.writeBuffer()
      downloadBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`remise-${detail.chrono||detail.id}-ecritures.xlsx`)
    }catch(e){setPdfError(e instanceof Error?`Excel impossible : ${e.message}`:'Excel impossible : vérifie exceljs.')}
  }
  function downloadTxt(){
    if(!validateAccounting()||!detail)return
    const setup=getComptaSettings()
    const pad=(v:string,n:number)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').slice(0,n).padEnd(n,' ')
    const fmt=(r:ReturnType<typeof makeExportRows>[number])=>{
      const isBank=r.ref.startsWith('RC')
      const account=pad(r.account,12)
      const date=formatRemiseDate(detail.date)
      const ref=pad(r.ref,12)
      const journal=pad(setup.journal,3)
      const label=pad(r.libelle,isBank?50:50)
      const amount=String(r.amount).slice(0,11).padStart(11,' ')
      const suffix=isBank?'+DO'.padEnd(15,' '):`+CO${setup.analytique}`.slice(0,15).padEnd(15,' ')
      return `${account}${date}${ref}${journal}${label}${amount}${suffix}`
    }
    // Une ligne par chèque, puis la/les contrepartie(s) banque, comme l'exemple CEGI.
    const rows=makeExportRows()
    const content=rows.map(fmt).join('\r\n')+'\r\n'
    downloadBlob(new Blob([content],{type:'text/plain;charset=windows-1252'}),`remise-${detail.chrono||detail.id}-import.txt`)
  }
  function saveCheques(next: Cheque[]) { setCheques(next); localStorage.setItem(CK, JSON.stringify(next)) }
  function saveRemises(next: Remise[]) { setRemises(next); localStorage.setItem(RK, JSON.stringify(next)) }
  const filtered = useMemo(() => cheques.filter(c => c.campagne === campagneActive && (filter === 'Tous' || c.statut === filter) && [c.numero,c.emetteur,c.banque,c.etablissement,c.campagne,c.fichier].join(' ').toLowerCase().includes(search.toLowerCase())),[cheques,filter,search,campagneActive])
  const chequesCampagne = cheques.filter(c => c.campagne === campagneActive)
  const remisesCampagne = remises.filter(r => r.campagneId === campagneActive || (!r.campagneId && chequesCampagne.some(c => c.remiseId === r.id)))
  const total = (data: Cheque[]) => data.reduce((sum,c) => sum + c.montant,0)
  const count = (r: Remise) => cheques.filter(c => c.remiseId === r.id)
  function saveScanBatch(items: ScanCheque[]): string[] {
    const duplicates = items.filter((c,i) =>
      cheques.some(x => x.numero.trim().toLowerCase() === c.numero.trim().toLowerCase() && x.banque.trim().toLowerCase() === c.banque.trim().toLowerCase()) ||
      items.findIndex(y => y.numero.trim().toLowerCase() === c.numero.trim().toLowerCase() && y.banque.trim().toLowerCase() === c.banque.trim().toLowerCase()) !== i
    ).map(c => c.numero)
    if (duplicates.length) return duplicates
    if (!items.length || items.some(c => !/^\d{2}$/.test(c.departement.trim()))) {
      setPdfError('Vérifie le département de chaque chèque avant de créer la remise.')
      return ['Département manquant']
    }
    // Transaction unique : créer la remise dès la validation, jamais à la fermeture.
    const chrono = nextChrono(remises)
    const remise: Remise = {
      id: uid(), operationId: uid(), chrono, campagneId: campagneActive,
      nom: `Bordereau de remise n° ${chrono}`, date: today(), statut: 'Brouillon'
    }
    const added: Cheque[] = items.map(c => ({
      ...c, id:uid(), etablissement:'', campagne:campagneActive,
      statut:'À remettre', remiseId:remise.id
    }))
    saveCheques([...added, ...cheques])
    saveRemises([remise, ...remises])
    setSelectedRemise(remise.id)
    setViewTab('bordereau')
    setShowScanner(false)
    setDetailRemise(remise.id)
    setMainTab('remises')
    return []
  }
  function updateCheque(id:string, patch:Partial<Cheque>) { saveCheques(cheques.map(c => c.id===id ? {...c,...patch}:c)) }
  function deposerRemise(r: Remise) {
    if (depositBusy) return
    const lignes = count(r)
    if (!lignes.length || lignes.some(c => c.statut !== 'À remettre')) { setPdfError('Les chèques doivent être au statut À remettre.'); return }
    const campagne = r.campagneId || lignes[0]?.campagne || campagneActive
    const reference = `RC${r.chrono || r.id}`
    if (r.statut === 'Déposée') { setPdfError('Cette remise est déjà enregistrée comme déposée.'); return }
    setDepositBusy(true)
    const alreadyRecorded = depotsBanque.some(d => d.campagne === campagne && d.reference === reference && d.statut === 'ENREGISTRE')
    try {
      if (!alreadyRecorded) {
        // Cette méthode vérifie le stock du Coffre puis crée le mouvement dans Suivi banque.
        creerDepotBanque({
          reference, campagne, nbCheques: lignes.length,
          montantCheques: Math.round(total(lignes) * 100) / 100,
          billets100:0, billets50:0, billets20:0, billets10:0, billets5:0,
          pieces2:0, pieces1:0, pieces050:0, pieces020:0, pieces010:0,
          pieces005:0, pieces002:0, pieces001:0,
          remarque:`Remise de chèques n° ${r.chrono || r.id}`
        })
      }
      saveRemises(remises.map(x => x.id === r.id ? {...x, statut:'Déposée'} : x))
      saveCheques(cheques.map(c => c.remiseId === r.id ? {...c, statut:'Remis en banque'} : c))
      setDetailRemise('')
      setMainTab('remises')
      setConfirmation({ chrono:r.chrono || r.id, message:'La remise est enregistrée dans Suivi banque et déduite du Coffre.' })
    } catch (e) {
      setPdfError(`Dépôt non enregistré : ${e instanceof Error ? e.message : 'Erreur inconnue'}. Le bordereau reste en brouillon et le Coffre est inchangé.`)
    } finally { setDepositBusy(false) }
  }
  async function printRemise(r: Remise, itemsOverride?: Cheque[], includeScans = false) {
    const items = itemsOverride || count(r)
    if (!items.length) { setPdfError('Cette remise ne contient aucun chèque.'); return }
    setPdfError(''); setCreatingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const width = doc.internal.pageSize.getWidth()
      const height = doc.internal.pageSize.getHeight()
      const margin = 16
      const pageWidth = width - margin * 2
      const campagneId = r.campagneId || items[0]?.campagne || campagneActive
      const campagneData = campagnes.find(c => c.id === campagneId)
      const rib = getCampagneJustificatifsSettings(campagneId, campagneData?.annee ?? null)
      const chrono = r.chrono || String(r.id).replace(/\D/g, '').slice(-6).padStart(6, '0')
      const money = (value:number) => value.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})
      const strip = (value?: string) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      const drawLine = (y:number) => { doc.setDrawColor(201, 27, 54); doc.setLineWidth(0.8); doc.line(margin, y, width - margin, y) }
      const fit = (text:string, max:number) => {
        const raw = strip(text)
        let out = raw
        while (doc.getTextWidth(out) > max && out.length > 3) out = out.slice(0, -2)
        return out.length < raw.length ? `${out}…` : out
      }
      const blocks = [
        { title: 'Remise de chèques Hors place', list: items.filter(c => emplacement(c.departement) === 'Hors place') },
        { title: 'Remise de chèques Sur place', list: items.filter(c => emplacement(c.departement) === 'Sur place') },
        { title: 'Remise de chèques à vérifier', list: items.filter(c => emplacement(c.departement) === 'À déterminer') },
      ].filter(group => group.list.length)

      doc.setFillColor(245, 245, 247)
      doc.rect(0, 0, width, height, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(17)
      doc.setTextColor(17, 17, 17)
      doc.text(`Bordereau de remise de chèques N° ${chrono}`, width / 2, 28, { align: 'center' })
      doc.setFontSize(9)
      doc.setTextColor(98, 110, 123)
      doc.text(`Campagne : ${strip(campagneData?.nom || campagneId)} · Type : ${strip('Sur place + Hors place')} · Date : ${r.date}`, width / 2, 35, { align: 'center' })

      drawLine(50)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(33, 33, 33)

      const orderLabel = rib.cheque?.ordre?.trim() || 'Titulaire du compte'
      const bankLabel = rib.virement?.banque?.trim() || 'Banque non renseignée'
      const iban = rib.virement?.iban?.trim() || 'IBAN non renseigné'
      const bic = rib.virement?.bic?.trim() || 'BIC non renseigné'
      const countItems = items.length
      const sumItems = total(items)

      const leftX = margin
      const rightX = 116
      doc.setFont('helvetica', 'bold')
      doc.text(fit(orderLabel, 90), leftX, 58)
      doc.setFont('helvetica', 'normal')
      doc.text(fit(campagneData?.id || '', 90), leftX, 63)
      doc.text('Association gestionnaire', leftX, 68)

      doc.setFont('helvetica', 'bold')
      doc.text('Banque', rightX, 58)
      doc.setFont('helvetica', 'normal')
      doc.text(fit(bankLabel, 75), rightX + 22, 58)
      doc.setFont('helvetica', 'bold')
      doc.text('IBAN', rightX, 63)
      doc.setFont('helvetica', 'normal')
      doc.text(fit(iban, 75), rightX + 22, 63)
      doc.setFont('helvetica', 'bold')
      doc.text('BIC', rightX, 68)
      doc.setFont('helvetica', 'normal')
      doc.text(fit(bic, 75), rightX + 22, 68)

      doc.text(`Date remise : ${r.date}`, leftX, 79)
      doc.text(`Nombre de chèque(s) : ${countItems}`, leftX, 84)
      doc.text(`Montant total : ${money(sumItems)} €`, leftX, 89)
      doc.text('Catégories : Sur place / Hors place', rightX, 79)

      let y = 102
      const cols = { num: margin + 2, bank: 52, name: 97, type: 141, amount: 176 }
      for (const block of blocks) {
        const blockTotal = total(block.list)
        if (y > 238) { doc.addPage(); y = 24 }
        doc.setFillColor(232, 232, 232)
        doc.rect(margin, y, pageWidth, 8, 'F')
        doc.setTextColor(26, 26, 26)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(strip(block.title), margin + 2, y + 5.3)
        y += 10

        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.text('N° CHEQUE', cols.num, y)
        doc.text('BANQUE', cols.bank, y)
        doc.text('NOM EMETTEUR', cols.name, y)
        doc.text('TYPE CHEQUE', cols.type, y)
        doc.text('MONTANT', cols.amount, y)
        y += 4
        doc.setLineWidth(0.2)
        doc.setDrawColor(215, 215, 215)
        doc.line(margin, y, width - margin, y)
        y += 5

        doc.setFont('helvetica', 'normal')
        for (const c of block.list) {
          if (y > 268) { doc.addPage(); y = 24 }
          doc.text(fit(c.numero || '-', 42), cols.num, y)
          doc.text(fit(c.banque || '-', 42), cols.bank, y)
          doc.text(fit(c.emetteur || '-', 40), cols.name, y)
          doc.text(fit(emplacement(c.departement), 26), cols.type, y)
          doc.text(`${money(c.montant)}`, width - margin, y, { align: 'right' })
          y += 6
        }

        doc.setFont('helvetica', 'bold')
        doc.text(block.title.includes('Hors') ? 'Chèque Hors place' : block.title.includes('Sur') ? 'Chèque Sur place' : 'Chèque à vérifier', margin + 24, y)
        doc.text(`Nombre : ${block.list.length}`, 103, y)
        doc.text(`Total : ${money(blockTotal)} €`, width - margin, y, { align: 'right' })
        y += 12
      }

      drawLine(height - 24)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(90, 90, 90)
      doc.text('Document de suivi interne édité depuis Gestion des chèques.', margin, height - 16)
      doc.text(`Réf. campagne : ${strip(campagneId)}  ·  Bordereau chrono ${chrono}`, width - margin, height - 16, { align: 'right' })
      if (includeScans) {
        const missing: string[] = []
        for (const cheque of items) {
          const blob = await getChequeScan(cheque.id)
          if (!blob) { missing.push(cheque.numero); continue }
          const bitmap = await createImageBitmap(blob)
          const canvas = document.createElement('canvas')
          canvas.width = bitmap.width; canvas.height = bitmap.height
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Impossible de préparer les images des chèques.')
          context.fillStyle='#ffffff'; context.fillRect(0,0,canvas.width,canvas.height)
          context.drawImage(bitmap,0,0); bitmap.close()
          const jpeg = canvas.toDataURL('image/jpeg', 0.94)
          const availableWidth = width - 2 * margin
          const availableHeight = height - 65
          const ratio = Math.min(availableWidth/canvas.width,availableHeight/canvas.height)
          const imgW = canvas.width * ratio, imgH = canvas.height * ratio
          doc.addPage()
          doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(25,50,83)
          doc.text(`Cheque ${cheque.numero} - ${strip(cheque.emetteur)}`,margin,20)
          doc.setFont('helvetica','normal');doc.setFontSize(10)
          doc.text(`${strip(cheque.banque)}  |  ${money(cheque.montant)} EUR  |  ${strip(emplacement(cheque.departement))}`,margin,28)
          doc.addImage(jpeg,'JPEG',margin,35,imgW,imgH)
          doc.setTextColor(110,110,110);doc.setFontSize(8)
          doc.text('Copie du cheque fournie a titre de piece jointe au bordereau.',margin,height-15)
        }
        if(missing.length) {
          setScansWarning(`Export partiel : scan indisponible pour le(s) chèque(s) ${missing.join(', ')}. Les nouveaux lots conservent les images ; les anciens ne peuvent pas être reconstitués.`)
          return
        }
      }
      doc.save(`bordereau-remise-${chrono}${includeScans ? '-avec-cheques' : ''}.pdf`)
    } catch(e) {
      setPdfError(e instanceof Error ? `Generation PDF impossible : ${e.message}` : 'Generation PDF impossible. Verifie que jspdf est installe.')
    } finally {
      setCreatingPdf(false)
    }
  }
  function closeScanner() {
    // Annuler ou fermer n'enregistre aucun lot.
    setShowScanner(false)
  }

  return <div className="gc-page">
    <header className="gc-hero"><div><span className="gc-kicker">DONS PERÇUS · OPÉRATION BRIOCHES</span><h1>Gestion des chèques</h1><p>Importez et vérifiez un lot : les remises et leurs bordereaux PDF sont ensuite créés automatiquement.</p></div><div className="gc-actions"><button className="gc-btn primary" onClick={()=>{setMainTab('cheques');setShowScanner(true)}}><UploadCloud size={17}/> Importer un lot de chèques</button></div></header>
    <nav className="gc-main-tabs" aria-label="Sections Gestion des chèques">
      <button type="button" className={mainTab==='global'?'active':''} onClick={()=>setMainTab('global')}>Vue globale</button>
      <button type="button" className={mainTab==='cheques'?'active':''} onClick={()=>setMainTab('cheques')}>Chèques enregistrés</button>
      <button type="button" className={mainTab==='remises'?'active':''} onClick={()=>setMainTab('remises')}>Bordereaux de remise de chèques</button>
    </nav>
    {mainTab==='global'&&<>
    <div className="gc-stats"><article><span>Chèques enregistrés</span><strong>{chequesCampagne.length}</strong><Banknote size={20}/></article><article><span>À remettre / vérifier</span><strong>{euro(total(chequesCampagne.filter(c=>['À vérifier','À remettre'].includes(c.statut))))}</strong><Landmark size={20}/></article><article><span>Remises créées</span><strong>{remisesCampagne.length}</strong><FileText size={20}/></article><article><span>Montant total enregistré</span><strong>{euro(total(chequesCampagne))}</strong><Check size={20}/></article></div>
    <section className="gc-card gc-coffre-source" aria-label="Données du coffre">
      <div className="gc-heading"><div><h2>Chèques issus du Coffre</h2><p>Solde automatique calculé avec les fiches de caisse et les dépôts bancaires enregistrés.</p></div>
        <label className="gc-coffre-campagne">Campagne
          <select value={campagneActive} onChange={e => setCampagneCoffre(e.target.value)}>
            {campagnes.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
          </select>
        </label>
      </div>
      {bilanCoffre.erreur ? <p className="gc-error">{bilanCoffre.erreur}</p> : <>
        <div className="gc-coffre-stats"><div><span>Chèques non déposés</span><strong>{bilanCoffre.donnees?.totalCheques ?? 0}</strong></div>
          <div><span>Montant restant au coffre</span><strong>{euro((bilanCoffre.donnees?.montantCheques ?? 0) / 100)}</strong></div>
          <div><span>Fiches de caisse avec chèques</span><strong>{fichesCheques.length}</strong></div>
          <div><span>Dépôts bancaires enregistrés</span><strong>{depotsCheques.length}</strong></div>
        </div>
        <details className="gc-coffre-details"><summary>Consulter l'origine des chèques dans les fiches de caisse</summary>
          <div className="gc-table-wrap"><table className="gc-table"><thead><tr><th>Fiche</th><th>Date</th><th>Origine</th><th>Nombre</th><th>Montant</th></tr></thead><tbody>
            {fichesCheques.map(f => <tr key={f.id}><td>{f.numero}</td><td>{f.date}</td><td>{f.libelle || f.type}</td><td>{f.nbCheques}</td><td>{euro(f.montantCheques)}</td></tr>)}
          </tbody></table></div>
        </details>
      </>}
      <p className="gc-coffre-note">Le Coffre connaît les totaux par fiche, pas les numéros individuels. Lorsqu’une remise est déposée, un mouvement est créé dans Suivi banque et le Coffre est recalculé automatiquement. Un bordereau en brouillon ne modifie pas le Coffre.</p>
    </section>
    </>}
    <div className={`gc-grid gc-grid--tabs gc-tab-${mainTab}`}><section className="gc-card gc-cheques-panel"><div className="gc-heading"><div><h2>Registre des chèques</h2><p>Informations enregistrées après contrôle des originaux.</p></div><span className="gc-count">{filtered.length} chèque(s)</span></div><div className="gc-toolbar"><label className="gc-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un chèque, une banque, un établissement..."/></label><div className="gc-select"><select aria-label="Filtrer par statut" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>{['Tous','À vérifier','À remettre','Remis en banque','Encaissé','Rejeté'].map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={15}/></div></div><div className="gc-table-wrap"><table className="gc-table"><thead><tr><th>N° chèque</th><th>Émetteur / Banque</th><th>Lieu</th><th>Signature</th><th>Date</th><th>Établissement</th><th>Montant</th><th>Statut</th><th>Remise</th><th/></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td><strong>{c.numero}</strong>{c.fichier&&<small>Fichier : {c.fichier}</small>}</td><td>{c.emetteur||'—'}<small>{c.banque||'Banque non renseignée'}</small></td><td>{emplacement(c.departement)}{c.departement&&<small>Dépt. {c.departement}</small>}</td><td>{c.signature||'À vérifier'}</td><td>{c.date}</td><td>{c.etablissement||'—'}</td><td className="gc-money">{euro(c.montant)}</td><td><select className="gc-mini-select" value={c.statut} disabled={!!c.remiseId&&remises.find(r=>r.id===c.remiseId)?.statut==='Déposée'&&c.statut==='À remettre'} onChange={e=>updateCheque(c.id,{statut:e.target.value as Statut})}>{(['À vérifier','À remettre','Remis en banque','Encaissé','Rejeté'] as Statut[]).map(s=><option key={s}>{s}</option>)}</select></td><td><select className="gc-mini-select" disabled value={c.remiseId} ><option value="">Non affecté</option>{remises.filter(r=>r.id===c.remiseId).map(r=><option key={r.id} value={r.id}>{r.nom}</option>)}</select></td><td></td></tr>)}</tbody></table>{!filtered.length&&<div className="gc-empty">Aucun chèque pour le moment. Ajoute ton premier chèque pour commencer.</div>}</div></section>
    <aside className="gc-card gc-remises"><div className="gc-heading"><div><h2>Bordereaux de remise</h2><p>Préparez et suivez vos dépôts.</p></div></div>{!remisesCampagne.length&&<div className="gc-empty"><Landmark size={30}/><p>Aucune remise créée</p><p>Importe puis valide un lot de chèques pour générer une remise.</p></div>}{remisesCampagne.map(r=><article className={`gc-remise ${r.id===selectedRemise?'active':''}`} key={r.id}><button className="gc-remise-title" onClick={()=>setSelectedRemise(r.id===selectedRemise?'':r.id)}><strong>{r.nom}</strong><span>{r.statut}</span></button><div className="gc-remise-meta">{count(r).length} chèque(s) · {euro(total(count(r)))}{r.chrono ? ` · Chrono ${r.chrono}` : ''}</div>{selectedRemise===r.id&&<div className="gc-remise-detail"><p>{r.date} · {r.statut==='Brouillon'?'En attente de dépôt bancaire.':'Remise déclarée déposée.'}</p><button className="gc-btn ghost" onClick={()=>{setDetailRemise(r.id);setViewTab('bordereau')}}><FileText size={16}/> Voir le bordereau</button>{r.statut==='Brouillon'&&<button className="gc-btn primary" onClick={()=>deposerRemise(r)}>Marquer comme déposée</button>}</div>}</article>)}</aside></div>
    <p className="gc-notice">Version locale : les informations sont enregistrées dans ce navigateur. Les fichiers de chèques sélectionnés ne sont pas archivés ; seul leur nom est conservé. Un lot validé crée un bordereau en brouillon. Le dépôt est enregistré dans Suivi banque, et déduit du Coffre, uniquement lorsque tu cliques sur « Déposer dans Suivi banque ». Aucun double dépôt n’est créé pour la même référence.</p>
    {showScanner&&<ScanCheques onClose={closeScanner} onSave={saveScanBatch}/>}    
    {detail&&<div className="gc-overlay gc-detail-overlay"><section className="gc-detail-modal" role="dialog" aria-modal="true" aria-label="Détail du bordereau">
      <header className="gc-detail-header"><div><span className="gc-kicker">REMISE DE CHÈQUES · {detail.statut.toUpperCase()}</span><h2>Bordereau n° {detail.chrono || detail.id}</h2><p>Campagne : {campagnes.find(c=>c.id===(detail.campagneId||campagneActive))?.nom || detail.campagneId || campagneActive} · {detail.date}</p></div><button className="gc-btn ghost" onClick={()=>{setDetailRemise('');setMainTab('remises')}}>← Fermer et revenir aux bordereaux</button></header>
      <nav className="gc-detail-tabs"><button className={viewTab==='bordereau'?'active':''} onClick={()=>setViewTab('bordereau')}>Aperçu du bordereau</button><button className={viewTab==='compta'?'active':''} onClick={()=>setViewTab('compta')}>Écritures comptables</button></nav>
      {viewTab==='bordereau'?<div className="gc-paper-wrap"><div className="gc-paper" id="gc-paper">
        <h2>Bordereau de remise de chèques N° {detail.chrono || detail.id}</h2>
        <div className="gc-red-rule"/>
        <div className="gc-paper-info"><div><strong>{ribDetail?.cheque.ordre || 'AEIM'}</strong><p>Campagne : {campagnes.find(c=>c.id===(detail.campagneId||campagneActive))?.nom || detail.campagneId || campagneActive}</p></div><div><p><b>Banque :</b> {ribDetail?.virement.banque || 'À renseigner dans Campagnes'}</p><p><b>IBAN :</b> {ribDetail?.virement.iban || 'À renseigner'}</p><p><b>BIC :</b> {ribDetail?.virement.bic || 'À renseigner'}</p></div></div>
        <div className="gc-paper-meta"><span>Date de remise : {detail.date}</span><span>Nombre de chèques : {detailItems.length}</span><strong>Montant total : {euro(total(detailItems))}</strong></div>
        <h3>Émetteurs</h3><div className="gc-red-rule"/>
        {groupedDetail.map(g=><div key={g.label} className="gc-paper-group"><h4>Remise de chèques {g.label}</h4><table><thead><tr><th>N° CHÈQUE</th><th>BANQUE</th><th>NOM ÉMETTEUR</th><th>TYPE CHÈQUE</th><th>MONTANT</th></tr></thead><tbody>{g.items.map(c=><tr key={c.id}><td>{c.numero}</td><td>{c.banque}</td><td>{c.emetteur}</td><td>{g.label}</td><td className="gc-paper-money">{euro(c.montant)}</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Chèques {g.label}</td><td>Nombre : {g.items.length}</td><td colSpan={2}>Total : {euro(total(g.items))}</td></tr></tfoot></table></div>)}
        <div className="gc-paper-grandtotal">TOTAL GÉNÉRAL · {detailItems.length} chèque(s) <strong>{euro(total(detailItems))}</strong></div>
        <p className="gc-paper-foot">Bordereau de suivi interne · La remise n'est pas déclarée déposée par la génération du PDF.</p>
      </div></div>:<section className="gc-accounting"><p>Les comptes sont repris des paramètres comptables de la campagne. Vérifie le tableau avant de produire les fichiers.</p><div className="gc-account-table"><table><thead><tr><th>Type</th><th>N° chèque / pièce</th><th>Compte</th><th>Libellé</th><th>Montant</th></tr></thead><tbody>{makeExportRows().map((r,i)=><tr key={i}><td>{r.ref.startsWith('RC')?'Banque':r.type==='S'?'Sur place':'Hors place'}</td><td>{r.ref}</td><td>{r.account || 'À renseigner'}</td><td>{r.libelle}</td><td>{euro(r.amount/100)}</td></tr>)}</tbody></table></div><p>Excel reprend les huit colonnes du modèle fourni. TXT reprend les écritures par chèque, puis la contrepartie banque par catégorie. Aucun fichier n’est envoyé automatiquement en comptabilité.</p></section>}
      <footer className="gc-detail-actions"><button type="button" className="gc-btn ghost" onClick={()=>{setDetailRemise('');setMainTab('remises')}}>← Fermer / Retour</button><div className="gc-detail-action-spacer"/>{detail.statut==='Brouillon'&&<button type="button" className="gc-btn primary" disabled={depositBusy} onClick={()=>deposerRemise(detail)}><Landmark size={16}/> {depositBusy?'Enregistrement…':'Déposer dans Suivi banque'}</button>}{viewTab==='bordereau'?<><button className="gc-btn ghost" onClick={()=>window.print()}><Printer size={16}/> Imprimer</button><button className="gc-btn ghost" disabled={creatingPdf} onClick={()=>printRemise(detail)}><FileText size={16}/> Bordereau seul</button><button className="gc-btn primary" disabled={creatingPdf || scanSaving} onClick={()=>printRemise(detail,undefined,true)}><FileText size={16}/> Bordereau + chèques</button></>:<><button className="gc-btn primary" onClick={downloadExcel}>Exporter Excel</button><button className="gc-btn ghost" onClick={downloadTxt}>Exporter TXT comptable</button></>}</footer>
    </section></div>}
    {confirmation&&<div className="gc-overlay gc-confirm-overlay" role="status" aria-live="polite">
      <div className="gc-confirm-card"><span className="gc-confirm-check">✓</span>
        <h2>Remise de chèques finalisée</h2>
        <p>Bordereau n° {confirmation.chrono}</p>
        <ul><li>Remise enregistrée automatiquement dans Suivi banque</li><li>Chèques et montant déduits du Coffre</li><li>Bordereau conservé dans l'historique</li></ul>
        <small>Cette information se ferme automatiquement après 15 secondes.</small>
      </div>
    </div>}
    {scansWarning&&<div className="gc-scans-warning" role="alert">{scansWarning}<button type="button" onClick={()=>setScansWarning('')}>Fermer</button></div>}
    {pdfError&&<div className="gc-overlay"><div className="gc-modal gc-small"><header><h2>Export du bordereau</h2></header><p className="gc-error">{pdfError}</p><div className="gc-modal-actions"><button className="gc-btn primary" onClick={()=>setPdfError('')}>Fermer</button></div></div></div>}
  </div>
}

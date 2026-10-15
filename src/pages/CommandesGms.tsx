import CompactStatCard from '../components/ui/CompactStatCard'
import { Fragment, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDays, Download, Printer,
  Euro,
  Package,
  Search,
  Store, Plus, Minus, X, Check, Pencil,
} from 'lucide-react'

import { useArtisans } from '../contexts/ArtisansContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useMairies } from '../contexts/MairiesContext'
import { synchroniserReceptionGms } from '../lib/commandeGmsStock'
import type {
  CommandeArtisan,
  Fournisseur,
  StatutCommandeArtisan,
} from '../types/artisans'
import {
  argent,
  categoriesFournisseur,
  dateLisible,
  montantCommande,
  jourLocal,
  numeroCommandeSuivant,
} from '../types/artisans'

import { paiementRapprocheVerrouille, MESSAGE_PAIEMENT_VERROUILLE } from '../lib/paiementCommandeLock'

import './CommandesGms.css'

type StatutFiltre = 'TOUS' | 'CREES' | 'CONFIRMES' | 'LIVRES' | 'PAYES'
type DestinationGms = { id: string; type: 'ETABLISSEMENT' | 'MAIRIE' | 'STAND'; referenceId: string; nom: string; adresse: string; quantite: number; livre: boolean }
type CommandeGmsSuivi = CommandeArtisan & { destinations?: DestinationGms[]; etablissementId?: string; destinationType?: 'ETABLISSEMENT' | 'MAIRIE' | 'STAND'; destinationId?: string; destinationNom?: string; livre?: boolean; paye?: boolean }
const nouvelleDestination = (): DestinationGms => ({ id: `dest-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, type: 'ETABLISSEMENT', referenceId:'', nom:'', adresse:'', quantite:0, livre:false })
const destinationsDe = (c: CommandeGmsSuivi): DestinationGms[] => c.destinations?.length ? c.destinations : (c.destinationId || c.etablissementId || c.destinationNom ? [{id:`ancien-${c.id}`,type:c.destinationType ?? 'ETABLISSEMENT',referenceId:c.destinationId || c.etablissementId || '',nom:c.destinationNom || '',adresse:'',quantite:c.quantiteCommandee,livre:!!c.livre}] : [])
const livraisonsTerminees = (c: CommandeGmsSuivi) => { const dest=destinationsDe(c); return dest.length > 0 && dest.every(d=>d.livre) }
const estConfirmee = (c: CommandeArtisan) => ['CONFIRMEE','RETRAIT_PREVU','TERMINEE'].includes(c.statut)
const libelleBon = (c: CommandeArtisan) => {
  const suivi = c as CommandeGmsSuivi
  if (suivi.paye) return 'Payé'
  if (livraisonsTerminees(suivi)) return 'Livré'
  if (destinationsDe(suivi).some(d=>d.livre)) return 'Livraison partielle'
  return estConfirmee(c) ? 'Bon de commande confirmé' : 'Bon de commande créé'
}
const etapeCommande = (c: CommandeArtisan): Exclude<StatutFiltre, 'TOUS'> => {
  const suivi = c as CommandeGmsSuivi
  if (!estConfirmee(c)) return 'CREES'
  if (suivi.paye) return 'PAYES'
  if (livraisonsTerminees(suivi)) return 'LIVRES'
  return 'CONFIRMES'
}



function nomGms(
  fournisseurId: string,
  fournisseurs: Array<{ id: string; nom: string }>,
) {
  return (
    fournisseurs.find((item) => item.id === fournisseurId)?.nom ||
    fournisseurId ||
    '—'
  )
}

function estGms(fournisseur: Fournisseur) {
  return categoriesFournisseur(fournisseur).includes('GMS')
}

export default function CommandesGms() {
  const { commandesArtisans, setCommandesArtisans, fournisseurs } = useArtisans()
  const { etablissements } = useEtablissements()
  const { mairies } = useMairies()
  const mairiesDisponibles = useMemo(() => mairies.filter(m => m.statut === 'ACTIVE').sort((a,b) => (a.nomAffiche || a.commune).localeCompare(b.nomAffiche || b.commune, 'fr')), [mairies])
  const destinationLibelleLigne = (d: DestinationGms) => d.type === 'ETABLISSEMENT' ? etablissements.find(e=>e.id===d.referenceId)?.nom || d.nom || 'Établissement à préciser' : d.type === 'MAIRIE' ? mairies.find(m=>m.id===d.referenceId)?.nomAffiche || mairies.find(m=>m.id===d.referenceId)?.commune || d.nom || 'Mairie à préciser' : d.nom || 'Stand à préciser'
  const destinationLibelle = (c: CommandeArtisan) => destinationsDe(c as CommandeGmsSuivi).map(d=>`${destinationLibelleLigne(d)} (${d.quantite})`).join(' · ') || 'À répartir'
  const changerDestination = (id: string, patch: Partial<DestinationGms>) => setEdition(c=>c ? {...c,destinations:destinationsDe(c).map(d=>d.id===id ? {...d,...patch}:d)} : null)
  const [message, setMessage] = useState('')
  const [destinationsOuvertes, setDestinationsOuvertes] = useState<string[]>([])
  const basculerDestinations = (id: string) => setDestinationsOuvertes(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  const etablissementsDisponibles = useMemo(() => etablissements.filter(e => e.statut === 'ACTIF').sort((a,b) => a.nom.localeCompare(b.nom,'fr')), [etablissements])
  const [editionCellule, setEditionCellule] = useState<{ id: string; cle: string } | null>(null)
  const [valeurCellule, setValeurCellule] = useState('')
  const [edition, setEdition] = useState<CommandeGmsSuivi | null>(null)
  const [editionId, setEditionId] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [totalTtc, setTotalTtc] = useState('')

  function ouvrirCreation() {
    const premier = fournisseurs.filter(estGms).find(f => f.statut !== 'INACTIF')
    const campagneActuelle = String(new Date().getFullYear())
    setEdition({
      id: `commande-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      numero: numeroCommandeSuivant(commandesArtisans, campagneActuelle),
      artisanId: premier?.id ?? '', campagne: campagneActuelle, dateCommande: jourLocal(), dateRetrait: '',
      repartitionJours: '', secteur: premier?.secteur ?? '', responsableSecteur: premier?.responsableSecteur ?? '',
      adresseResponsable: '', telephoneResponsable: '', personneRetrait: '', quantiteCommandee: 0,
      quantiteFabriquee: null, prixUnitaire: premier?.tarif2026 ?? premier?.tarif2025 ?? 0,
      statut: 'BROUILLON', etablissementId: '', destinationType: 'ETABLISSEMENT', destinationId: '', destinationNom: '', destinations:[nouvelleDestination()], livre: false, paye: false, etiquettesConsignes: '', bdcEnvoyeLe: '', etiquettesEnvoyeesLe: '',
      fondsEstimes: null, fondsRecus: null, factureNumero: '', factureRecueLe: '', factureScanneeLe: '',
      factureTransmiseLe: '', remarque: '', remarqueFacture: '',
    })
    setEditionId(null)
    setTotalTtc('')
    setErreur('')
  }

  function ouvrirEdition(commande: CommandeArtisan) {
    setEdition({ ...commande, destinations:destinationsDe(commande as CommandeGmsSuivi).map(d=>({...d})) })
    setTotalTtc(String(Number((commande.quantiteCommandee * commande.prixUnitaire).toFixed(2))))
    setEditionId(commande.id)
    setErreur('')
  }

  function modifier<K extends keyof CommandeArtisan>(cle: K, valeur: CommandeArtisan[K]) {
    setEdition(e => e ? { ...e, [cle]: valeur } : null)
  }

  function choisirFournisseur(id: string) {
    const f = fournisseurs.find(item => item.id === id)
    setEdition(e => e ? {
      ...e, artisanId: id,
      secteur: f?.secteur ?? e.secteur,
      responsableSecteur: f?.responsableSecteur ?? e.responsableSecteur,
      // Le prix total TTC saisi reste inchangé lors du choix d'un fournisseur.
      prixUnitaire: e.prixUnitaire,
    } : null)
  }

  function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!edition) return
    if (editionId && paiementRapprocheVerrouille(editionId)) {
      const origine = commandesArtisans.find(c => c.id === editionId)
      if (!origine || !edition.paye || edition.statut !== origine.statut || edition.artisanId !== origine.artisanId || edition.quantiteCommandee !== origine.quantiteCommandee || Math.abs(Number(totalTtc.replace(',', '.')) - montantCommande(origine)) > .01) {
        setErreur(MESSAGE_PAIEMENT_VERROUILLE); return
      }
    }
    if (!fournisseurs.filter(estGms).some(f => f.id === edition.artisanId)) {
      setErreur('Sélectionne un fournisseur GMS existant.')
      return
    }
    const montantTtc = Number(totalTtc.replace(',', '.'))
    if (!edition.campagne.trim() || !edition.dateCommande || !Number.isInteger(edition.quantiteCommandee) || edition.quantiteCommandee <= 0 || totalTtc.trim() === '' || !Number.isFinite(montantTtc) || montantTtc < 0) {
      setErreur('Renseigne une campagne, une date, une quantité entière positive et un montant TTC valide.')
      return
    }
    // Compatibilité : la base existante stocke un prix unitaire.
    // Ne pas arrondir à 2 décimales ici, sinon quantité × prix perdrait des centimes.
    const dest = destinationsDe(edition)
    const ancienne = commandesArtisans.find(c=>c.id===editionId) as CommandeGmsSuivi | undefined
    if (ancienne?.paye && edition.paye && (JSON.stringify(dest)!==JSON.stringify(destinationsDe(ancienne)) || edition.quantiteCommandee!==ancienne.quantiteCommandee || edition.artisanId!==ancienne.artisanId || montantTtc!==montantCommande(ancienne))) { setErreur('Repasse le paiement en attente avant de modifier une commande payée.'); return }
    if (!dest.length || dest.some(d => !Number.isInteger(d.quantite) || d.quantite <= 0 || (d.type !== 'STAND' && !d.referenceId) || (d.type === 'STAND' && (!d.nom.trim() || !d.adresse.trim())))) { setErreur('Chaque destination doit être identifiée avec une quantité positive ; les stands doivent avoir un nom et une adresse.'); return }
    if (dest.reduce((n,d)=>n+d.quantite,0) !== edition.quantiteCommandee) { setErreur('La somme des quantités livrées doit être égale à la quantité commandée.'); return }
    if (!estConfirmee(edition) && dest.some(d=>d.livre)) { setErreur('Confirme le bon avant de saisir une livraison.'); return }
    if (edition.paye && !livraisonsTerminees(edition)) { setErreur('Toutes les destinations doivent être livrées avant paiement.'); return }

    if (edition.paye && (!livraisonsTerminees(edition) || !estConfirmee(edition))) { setErreur('Un bon doit être confirmé et livré avant d’être payé.'); return }
    const commande: CommandeGmsSuivi = { ...edition, destinations:dest, livre:livraisonsTerminees(edition), paye:edition.paye, prixUnitaire: montantTtc / edition.quantiteCommandee, campagne: edition.campagne.trim(), numero: editionId ? edition.numero : numeroCommandeSuivant(commandesArtisans, edition.campagne.trim()) }
    const sync = synchroniserReceptionGms(commande, commandesArtisans.find(c => c.id === editionId), etablissements)
    if (!sync.ok) { setErreur(sync.erreur ?? 'Erreur de stock'); return }
    setCommandesArtisans(anciennes => editionId
      ? anciennes.map(c => c.id === editionId ? commande : c)
      : [...anciennes, commande])
    setEdition(null)
    setEditionId(null)
    setErreur('')
  }


  function modifierCellule(c: CommandeArtisan, cle: string, val: string) {
    setEditionCellule(null)
    if (paiementRapprocheVerrouille(c.id)) { setMessage(MESSAGE_PAIEMENT_VERROUILLE); return }
    const suivant: CommandeGmsSuivi = { ...(c as CommandeGmsSuivi) }
    if (cle === 'quantiteCommandee') {
      const q = Number(val); if (!Number.isInteger(q) || q <= 0) return setMessage('Quantité invalide.')
      suivant.quantiteCommandee = q
    } else if (cle === 'montant') {
      const m = Number(val.replace(',', '.')); if (!Number.isFinite(m) || m < 0) return setMessage('Montant TTC invalide.')
      suivant.prixUnitaire = m / suivant.quantiteCommandee
    } else if (cle === 'statut') {
      suivant.statut = val === 'BROUILLON' ? 'BROUILLON' : 'CONFIRMEE'
      if ((val === 'LIVRE' || val === 'PAYE') && !livraisonsTerminees(suivant)) return setMessage('Livraison incomplète : valide chaque destination dans la répartition.')
      suivant.livre = livraisonsTerminees(suivant)
      suivant.paye = val === 'PAYE'
    } else if (cle === 'artisanId') {
      if (!fournisseurs.some(f => f.id === val && estGms(f))) return setMessage('Fournisseur invalide.')
      suivant.artisanId = val
    } else if (cle === 'destinationType' || cle === 'destinationId' || cle === 'destinationNom') { return setMessage('Modifie la répartition avec le bouton destinations.') }
    else if (cle === 'dateCommande' || cle === 'dateRetrait' || cle === 'campagne' || cle === 'secteur') Object.assign(suivant, { [cle]: val })
    else if (cle !== 'livre' && cle !== 'paye') return
    if (cle === 'livre' || cle === 'paye') {
      if (!estConfirmee(c)) return setMessage('Confirme d’abord le bon de commande.')
      if (cle === 'paye' && val === 'true' && !livraisonsTerminees(suivant)) return setMessage('Marque d’abord le bon comme livré.')
      suivant[cle] = val === 'true'
    }
    if ((c as CommandeGmsSuivi).paye && (cle === 'quantiteCommandee' || cle === 'montant' || (cle === 'destinationType' || cle === 'destinationId' || cle === 'destinationNom') || cle === 'artisanId')) return setMessage('Une commande payée doit d’abord être repassée en non payée avant ces modifications.')
    if (estConfirmee(c) && cle === 'artisanId') return setMessage('Déconfirme le bon avant de changer de fournisseur.')
    const sync = synchroniserReceptionGms(suivant, c, etablissements)
    if (!sync.ok) { setMessage(sync.erreur ?? 'Mise à jour refusée.'); return }
    setCommandesArtisans(prev => prev.map(x => x.id === c.id ? suivant : x))
    setMessage('Modification enregistrée automatiquement.')
  }

  function cellule(c: CommandeArtisan, cle: string, affichage: string, type: 'text'|'number'|'date'|'select' = 'text') {
    if (cle === 'statut' && paiementRapprocheVerrouille(c.id)) return <span className="ind-status-locked" title="Paiement rapproché et validé dans Factures & Paiements">🔒 Payé</span>
    const active = editionCellule?.id === c.id && editionCellule.cle === cle
    const options = cle === 'livre' ? [['false','À livrer'],['true','Livré']] : cle === 'paye' ? [['false','À payer'],['true','Payé']] : cle === 'statut' ? [['BROUILLON','Bon créé'],['CONFIRMEE','Bon confirmé'],['LIVRE','Livré'],['PAYE','Payé']]
      : cle === 'artisanId' ? fournisseurs.filter(estGms).map(f => [f.id, f.nom])
      : []
    if (active) return type === 'select'
      ? <select autoFocus className="ind-inline-input" value={valeurCellule} onChange={e => modifierCellule(c,cle,e.target.value)} onBlur={() => setEditionCellule(null)}>{options.map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select>
      : <input autoFocus className="ind-inline-input" type={type} step={type === 'number' ? 'any' : undefined} value={valeurCellule} onChange={e => setValeurCellule(e.target.value)} onBlur={() => modifierCellule(c,cle,valeurCellule)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); modifierCellule(c,cle,valeurCellule) } if(e.key === 'Escape')setEditionCellule(null) }} />
    return <button className="ind-inline-button" type="button" title="Cliquer pour modifier" onClick={() => {
      setEditionCellule({ id: c.id, cle })
      setValeurCellule(cle === 'statut' ? ((c as CommandeGmsSuivi).paye ? 'PAYE' : livraisonsTerminees(c as CommandeGmsSuivi) ? 'LIVRE' : estConfirmee(c) ? 'CONFIRMEE' : 'BROUILLON') : cle === 'montant' ? String(montantCommande(c)) : String((c as unknown as Record<string, unknown>)[cle] ?? ''))
    }}>{affichage || '—'} <Pencil size={12}/></button>
  }

  async function exporterExcel() {
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Commandes GMSs')
      ws.addRow(['Bon','Fournisseur','Campagne','Destinations / quantités','Date commande','Date retrait','Quantité','Total TTC','Prix / brioche','Statut','Secteur'])
      resultats.forEach(c => ws.addRow([c.numero,nomGms(c.artisanId,fournisseursGms),c.campagne,destinationLibelle(c),c.dateCommande,c.dateRetrait,c.quantiteCommandee,montantCommande(c),c.prixUnitaire,libelleBon(c),c.secteur]))
      ws.getRow(1).font = { bold: true, color: { argb:'FFFFFFFF' } }
      ws.getRow(1).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FF173B6D'} }
      ws.columns.forEach(col => { col.width = 24 })
      ws.getColumn(8).numFmt = '#,##0.00 "€"'
      ws.getColumn(9).numFmt = '#,##0.0000 "€"'
      ws.autoFilter = { from:'A1', to:`K${resultats.length + 1}` }
      const bytes = await wb.xlsx.writeBuffer()
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
      const link=document.createElement('a');link.href=url;link.download='commandes-GMS.xlsx';link.click()
      window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    } catch { setMessage('Export Excel indisponible : vérifier exceljs.') }
  }

  function imprimerBonCommande(c: CommandeArtisan) {
    const fournisseur = fournisseurs.find(f => f.id === c.artisanId)
    const destinations = destinationsDe(c as CommandeGmsSuivi)
    const lignesLivraison = destinations.map(d=>{ const e=etablissements.find(e=>e.id===d.referenceId); const m=mairies.find(m=>m.id===d.referenceId); return { nom:destinationLibelleLigne(d), adresse:d.type==='STAND' ? d.adresse : d.type==='MAIRIE' ? [m?.numeroVoie,m?.adresse,m?.cp,m?.ville].filter(Boolean).join(' ') : [e?.adresse,e?.codePostal,e?.ville].filter(Boolean).join(' '), quantite:d.quantite, statut:d.livre?'Livré':'À livrer' } })
    const siege = etablissements.find(e => e.code?.toUpperCase() === 'SIEGE' || e.nom.trim().toUpperCase() === 'SIEGE')
    const enc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] ?? ch))
    const champ = (v: unknown) => enc(v || 'Non renseigné')
    const adresse = (f?: { adresse?: string; codePostal?: string; ville?: string }) =>
      [f?.adresse, [f?.codePostal, f?.ville].filter(Boolean).join(' ')].filter(Boolean).map(enc).join('<br>') || 'Adresse non renseignée'
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon de commande ${enc(c.numero)}</title>
      <style>
        @page{size:A4 portrait;margin:16mm}
        *{box-sizing:border-box}body{font:12px/1.55 Arial,Helvetica,sans-serif;color:#1c3556;margin:0}
        header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #e57a21;padding-bottom:22px}
        .brand{font-size:23px;font-weight:800;color:#123b72}.subtitle{font-size:12px;color:#637b96}
        .ref{text-align:right}.ref strong{font-size:20px;color:#123b72}
        h1{font-size:21px;text-transform:uppercase;letter-spacing:1px;color:#123b72;margin:26px 0 8px}
        .muted{color:#6d8094}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0}
        .card{border:1px solid #dce5ef;border-radius:8px;padding:15px;min-height:130px}
        .card h2{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#d16d1a;margin:0 0 12px}
        table{border-collapse:collapse;width:100%;margin-top:20px}th{background:#123b72;color:white;text-align:left;font-size:11px;padding:11px}
        td{border-bottom:1px solid #dce5ef;padding:13px 11px}td.num,th.num{text-align:right}
        .total{display:flex;justify-content:flex-end;gap:25px;padding:17px 10px;background:#f1f5fa;font-size:16px;font-weight:800;color:#123b72}
        .notes{margin:24px 0;min-height:36px;white-space:pre-wrap}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:32px}
        .sign{border-top:1px solid #bccbda;padding:12px 0;min-height:85px;color:#64768a}
        footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #dce5ef;padding-top:7px;font-size:10px;color:#798b9d}
        @media screen {.printbar{position:fixed;right:15px;top:15px;background:#123b72;color:white;border:0;border-radius:8px;padding:10px 18px;cursor:pointer}body{padding:32px;max-width:850px;margin:auto;background:white}}
        @media print {.printbar{display:none}}
      </style></head><body>
      <button class="printbar" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
      <header><div><div class="brand">AEIM · Opération Brioches</div><div class="subtitle">Commande de brioches — Campagne ${enc(c.campagne)}</div></div>
      <div class="ref"><div>BON DE COMMANDE</div><strong>${enc(c.numero)}</strong><div>Émis le ${enc(dateLisible(c.dateCommande))}</div></div></header>
      <h1>Bon de commande</h1><div class="muted">Référence à rappeler sur toute correspondance et facture : ${enc(c.numero)}</div>
      <div class="grid"><section class="card"><h2>Fournisseur</h2><strong>${champ(fournisseur?.nom)}</strong><div>${adresse(fournisseur)}</div>
      <div>Tél. : ${champ(fournisseur?.telephone)}</div><div>E-mail : ${champ(fournisseur?.email)}</div>${fournisseur?.siret ? `<div>SIRET : ${enc(fournisseur.siret)}</div>` : ''}</section>
      <section class="card"><h2>Donneur d’ordre / facturation</h2><strong>AEIM — Siège</strong><div>${siege ? adresse(siege) : "6 allée de Saint-Cloud<br>54600 Villers-lès-Nancy"}</div>
      ${siege?.telephone ? `<div>Tél. : ${enc(siege.telephone)}</div>` : ""}${siege?.email ? `<div>E-mail : ${enc(siege.email)}</div>` : ""}</section></div>
      <section class="card" style="min-height:100px;margin-top:12px"><h2>Répartition des lieux de livraison</h2>
      <table><thead><tr><th>Lieu de livraison</th><th>Adresse</th><th class="num">Brioches</th><th>Suivi</th></tr></thead><tbody>${lignesLivraison.map(d=>`<tr><td>${enc(d.nom)}</td><td>${enc(d.adresse || 'À préciser')}</td><td class="num">${d.quantite}</td><td>${enc(d.statut)}</td></tr>`).join('')}</tbody></table></section>
      <div><strong>Date de retrait / livraison prévue :</strong> ${c.dateRetrait ? enc(dateLisible(c.dateRetrait)) : 'À convenir'}</div>
      <div><strong>Secteur :</strong> ${champ(c.secteur)}</div>
      <table><thead><tr><th>Désignation</th><th class="num">Quantité</th><th class="num">Prix unitaire TTC</th><th class="num">Montant TTC</th></tr></thead>
      <tbody><tr><td>Brioches — Opération Brioches ${enc(c.campagne)}</td><td class="num">${enc(new Intl.NumberFormat('fr-FR').format(c.quantiteCommandee))}</td>
      <td class="num">${enc(argent(c.prixUnitaire))}</td><td class="num">${enc(argent(montantCommande(c)))}</td></tr></tbody></table>
      <div class="total"><span>Total TTC</span><span>${enc(argent(montantCommande(c)))}</span></div>
      <div class="notes"><strong>Observations / consignes :</strong> ${champ(c.remarque)}</div>
      <div class="signatures"><div class="sign">Pour l'AEIM — Nom, date et signature</div><div class="sign">Pour le fournisseur — Accusé de réception / signature</div></div>
      <footer>Document généré depuis OB2026 · Vérifier les coordonnées et modalités avant transmission.</footer>
      </body></html>`
    const page = window.open('', '_blank')
    if (!page) { setMessage('Autorise les fenêtres pop-up pour ouvrir le bon de commande.'); return }
    page.document.open(); page.document.write(html); page.document.close(); page.focus()
  }

  const [recherche, setRecherche] = useState('')
  const [campagne, setCampagne] = useState('TOUTES')
  const [statut, setStatut] = useState<StatutFiltre>('TOUS')

  const fournisseursGms = useMemo(
    () => fournisseurs.filter(estGms),
    [fournisseurs],
  )

  const idsGms = useMemo(
    () => new Set(fournisseursGms.map((item) => item.id)),
    [fournisseursGms],
  )

  const commandesGms = useMemo(
    () =>
      commandesArtisans.filter((commande) =>
        idsGms.has(commande.artisanId),
      ),
    [commandesArtisans, idsGms],
  )

  const campagnes = useMemo(
    () =>
      [...new Set(commandesGms.map((item) => item.campagne))]
        .filter(Boolean)
        .sort((a, b) =>
          b.localeCompare(a, 'fr', { numeric: true }),
        ),
    [commandesGms],
  )

  const resultats = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase('fr')

    return commandesGms.filter((commande) => {
      const GMS = nomGms(
        commande.artisanId,
        fournisseursGms,
      )

      const correspondRecherche =
        !motif ||
        [
          commande.numero,
          GMS,
          commande.secteur,
          commande.responsableSecteur,
          commande.personneRetrait,
          commande.campagne,
        ]
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(motif)

      const correspondCampagne =
        campagne === 'TOUTES' ||
        commande.campagne === campagne

      const correspondStatut = statut === 'TOUS' || etapeCommande(commande) === statut

      return (
        correspondRecherche &&
        correspondCampagne &&
        correspondStatut
      )
    })
  }, [
    commandesGms,
    fournisseursGms,
    recherche,
    campagne,
    statut,
  ])

  const totalQuantite = useMemo(
    () =>
      resultats.reduce(
        (total, commande) =>
          total + commande.quantiteCommandee,
        0,
      ),
    [resultats],
  )

  const totalMontant = useMemo(
    () =>
      resultats.reduce(
        (total, commande) =>
          total + montantCommande(commande),
        0,
      ),
    [resultats],
  )

  return (
    <main className="ind-page">
      <header className="ind-header">
        <div>
          <span className="ind-eyebrow">
            COMMANDES ACHATS
          </span>

          <h1>GMS</h1>

          <p>
            Suivi des commandes de brioches auprès des
            fournisseurs GMS.
          </p>
        </div>
        <div className="ind-header-buttons"><button type="button" className="ind-cancel" onClick={exporterExcel}><Download size={17}/> Excel</button><button type="button" className="ind-primary" onClick={ouvrirCreation} disabled={!fournisseursGms.some(f => f.statut !== 'INACTIF')}>
          <Plus size={18} /> Nouvelle commande
        </button></div>
      </header>

      {message && <p className="ind-notice" role="status">{message}<button type="button" onClick={() => setMessage('')}>×</button></p>}
      <nav className="ind-tabs" aria-label="Étapes des commandes">
        {([
          ['TOUS', 'Tous'],
          ['CREES', 'Bons créés'],
          ['CONFIRMES', 'Bons confirmés'],
          ['LIVRES', 'Livrés'],
          ['PAYES', 'Payés'],
        ] as const).map(([cle, titre]) => (
          <button key={cle} type="button" className={statut === cle ? 'active' : ''}
            aria-current={statut === cle ? 'page' : undefined}
            onClick={() => setStatut(cle)}>
            {titre} ({cle === 'TOUS' ? commandesGms.length : commandesGms.filter(c => etapeCommande(c) === cle).length})
          </button>
        ))}
      </nav>
      <section className="ind-stats">
        <CompactStatCard className="ind-stat"
          icon={<Package size={21} />}
          label="Commandes"
          value={String(resultats.length)}
        />

        <CompactStatCard className="ind-stat"
          icon={<Store size={21} />}
          label="Brioches commandées"
          value={new Intl.NumberFormat('fr-FR').format(
            totalQuantite,
          )}
        />

        <CompactStatCard className="ind-stat"
          icon={<Euro size={21} />}
          label="Montant estimé"
          value={argent(totalMontant)}
        />
      </section>

      <section className="ind-card">
        <div className="ind-toolbar">
          <label className="ind-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Rechercher une commande, un GMS, un secteur…"
              value={recherche}
              onChange={(event) =>
                setRecherche(event.target.value)
              }
            />
          </label>

          <select
            value={campagne}
            onChange={(event) =>
              setCampagne(event.target.value)
            }
            aria-label="Filtrer par campagne"
          >
            <option value="TOUTES">
              Toutes les campagnes
            </option>

            {campagnes.map((value) => (
              <option
                key={value}
                value={value}
              >
                {value}
              </option>
            ))}
          </select>

          <select
            value={statut}
            onChange={(event) =>
              setStatut(
                event.target.value as StatutFiltre,
              )
            }
            aria-label="Filtrer par statut"
          >
            <option value="TOUS">Toutes les étapes</option><option value="CREES">Bons créés</option><option value="CONFIRMES">Bons confirmés</option><option value="LIVRES">Livrés</option><option value="PAYES">Payés</option>
          </select>
        </div>

        <div className="ind-results">
          <strong>
            {resultats.length} commande
            {resultats.length > 1 ? 's' : ''}
          </strong>

          <span>
            {fournisseursGms.length} fournisseur
            {fournisseursGms.length > 1 ? 's GMS' : ' GMS'}
            dans la base fournisseurs
          </span>
        </div>

        <div className="ind-table-wrap">
          <table className="ind-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>GMS</th>
                <th>Campagne</th>
                <th>Date commande</th>
                <th>Date retrait</th>
                <th>Livraisons / destinations</th><th>Secteur</th>
                <th>Quantité</th>
                <th>Prix TTC / brioche</th>
                <th>Total TTC</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {resultats.map(
                (commande: CommandeArtisan) => (
                  <Fragment key={commande.id}>
                  <tr className={(commande as CommandeGmsSuivi).paye ? 'ind-row-paid' : ''}>
                    <td className="ind-code">
                      {commande.numero || '—'}
                    </td>

                    <td>
                      {cellule(commande,'artisanId',nomGms(commande.artisanId,fournisseursGms),'select')}
                    </td>

                    <td>
                      {cellule(commande,'campagne',commande.campagne)}
                    </td>

                    <td>
                      <span className="ind-date">
                        <CalendarDays size={14} />
                        {cellule(commande,'dateCommande',dateLisible(commande.dateCommande),'date')}
                      </span>
                    </td>

                    <td>
                      {cellule(commande,'dateRetrait',dateLisible(commande.dateRetrait),'date')}
                    </td>

                    <td>
                      <button className="gms-expand-button" type="button" aria-expanded={destinationsOuvertes.includes(commande.id)} aria-label={`${destinationsOuvertes.includes(commande.id) ? 'Masquer' : 'Afficher'} les ${destinationsDe(commande as CommandeGmsSuivi).length} lieux de livraison de ${commande.numero}`} onClick={() => basculerDestinations(commande.id)}>
                        <span className="gms-expand-icon">{destinationsOuvertes.includes(commande.id) ? <Minus size={14}/> : <Plus size={14}/>}</span>
                        <strong>{destinationsDe(commande as CommandeGmsSuivi).length} lieu{destinationsDe(commande as CommandeGmsSuivi).length > 1 ? 'x' : ''} de livraison</strong>
                      </button>
                      <div className="gms-dest-progress">{destinationsDe(commande as CommandeGmsSuivi).filter(d=>d.livre).length} / {destinationsDe(commande as CommandeGmsSuivi).length} livrées</div>
                    </td>
                    <td>{cellule(commande,'secteur',commande.secteur)}</td>

                    <td>
                      {cellule(commande,'quantiteCommandee',new Intl.NumberFormat('fr-FR').format(commande.quantiteCommandee),'number')}
                    </td>

                    <td>
                      {argent(
                        commande.prixUnitaire,
                      )}
                    </td>

                    <td>
                      {cellule(commande,'montant',argent(montantCommande(commande)),'number')}
                    </td>

                    <td>
                      {cellule(commande,'statut',libelleBon(commande),'select')}
                    </td>
                    <td><div className="ind-bdc-actions"><button className="ind-edit" type="button" title="Bon de commande imprimable" aria-label={`Bon de commande ${commande.numero}`} onClick={() => imprimerBonCommande(commande)}><Printer size={17}/></button><button className="ind-edit" type="button" aria-label={`Modifier ${commande.numero}`} onClick={() => ouvrirEdition(commande)}><Pencil size={16} /></button></div></td>
                  </tr>
                  {destinationsOuvertes.includes(commande.id) && destinationsDe(commande as CommandeGmsSuivi).map((destination, index) => (
                    <tr key={`${commande.id}-${destination.id}`} className={`gms-subrow ${(commande as CommandeGmsSuivi).paye ? 'ind-row-paid' : ''}`}>
                      <td className="gms-sub-index">↳ {index + 1}</td>
                      <td colSpan={4} className="gms-sub-label">
                        <strong>{destinationLibelleLigne(destination)}</strong>
                        <span>{destination.type === 'ETABLISSEMENT' ? 'Établissement AEIM' : destination.type === 'MAIRIE' ? 'Mairie' : 'Stand'}</span>
                      </td>
                      <td><span className="gms-sub-destination">{destinationLibelleLigne(destination)}</span></td>
                      <td>—</td>
                      <td className="gms-sub-quantity">{new Intl.NumberFormat('fr-FR').format(destination.quantite)}</td>
                      <td>—</td>
                      <td>—</td>
                      <td><span className={`gms-sub-status ${destination.livre ? 'gms-sub-status--delivered' : ''}`}>{destination.livre ? 'Livré' : 'À livrer'}</span></td>
                      <td><button type="button" className="ind-edit" title={`Modifier la livraison : ${destinationLibelleLigne(destination)}`} aria-label={`Modifier la livraison : ${destinationLibelleLigne(destination)}`} onClick={() => ouvrirEdition(commande)}><Pencil size={16}/></button></td>
                    </tr>
                  ))}
                  </Fragment>
                ),
              )}

              {!resultats.length && (
                <tr>
                  <td
                    className="ind-empty"
                    colSpan={12}
                  >
                    Aucune commande GMS ne correspond aux
                    filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {edition && <div className="ind-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setEdition(null) }}>
        <section className="ind-dialog" role="dialog" aria-modal="true" aria-labelledby="ind-dialog-title">
          <header className="ind-dialog-head"><div><span className="ind-eyebrow">ACHAT DE BRIOCHES</span><h2 id="ind-dialog-title">{editionId ? 'Modifier la commande' : 'Nouvelle commande GMS'}</h2></div>
            <button type="button" className="ind-edit" aria-label="Fermer" onClick={() => setEdition(null)}><X size={20} /></button>
          </header>
          <form onSubmit={enregistrer}>
            <div className="ind-form-grid">
              <label className="ind-wide">Fournisseur GMS *
                <select required value={edition.artisanId} onChange={e => choisirFournisseur(e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {fournisseursGms.map(f => <option key={f.id} value={f.id}>{f.nom} ({f.id}){f.statut === 'INACTIF' ? ' — Inactif' : ''}</option>)}
                </select>
              </label>
              {(() => { const fournisseur = fournisseurs.find(f => f.id === edition.artisanId); return fournisseur ? <div className="ind-fournisseur-info ind-wide">
                <strong>{fournisseur.nom}</strong><span>{[fournisseur.adresse, fournisseur.codePostal, fournisseur.ville].filter(Boolean).join(' · ') || 'Adresse non renseignée'}</span>
                <span>{[fournisseur.responsable, fournisseur.telephone, fournisseur.email].filter(Boolean).join(' · ') || 'Contact non renseigné'}</span>
              </div> : null })()}
              <label>Campagne *<input required value={edition.campagne} onChange={e => modifier('campagne', e.target.value)} /></label>
              <label>N° de commande<input readOnly value={editionId ? edition.numero : numeroCommandeSuivant(commandesArtisans, edition.campagne)} /></label>
              <label>Date de commande *<input type="date" required value={edition.dateCommande} onChange={e => modifier('dateCommande', e.target.value)} /></label>
              <label>Date de retrait prévue<input type="date" value={edition.dateRetrait} onChange={e => modifier('dateRetrait', e.target.value)} /></label>
              <label>Quantité de brioches *<input type="number" required min="1" step="1" value={edition.quantiteCommandee || ''} onChange={e => modifier('quantiteCommandee', Number(e.target.value))} /></label>
              <label>Montant total TTC (€) *<input type="number" required min="0" step="0.01" value={totalTtc} onChange={e => setTotalTtc(e.target.value)} /></label>
              <section className="gms-destinations ind-wide">
                <div className="gms-dest-head"><div><strong>Répartition des livraisons</strong><p>Plusieurs établissements, mairies et stands sur un seul bon de commande.</p></div><button type="button" className="ind-cancel" onClick={()=>setEdition(p=>p?{...p,destinations:[...destinationsDe(p),nouvelleDestination()]}:null)}><Plus size={16}/> Ajouter un lieu</button></div>
                {destinationsDe(edition).map((d,i)=><div className="gms-dest-row" key={d.id}>
                  <div className="gms-dest-row-head"><strong>Livraison {i+1}</strong><button type="button" className="ind-edit" title="Supprimer cette destination" onClick={()=>setEdition(p=>p?{...p,destinations:destinationsDe(p).filter(x=>x.id!==d.id)}:null)}><X size={16}/></button></div>
                  <label>Type<select value={d.type} onChange={e=>changerDestination(d.id,{type:e.target.value as DestinationGms['type'],referenceId:'',nom:'',adresse:'',livre:false})}><option value="ETABLISSEMENT">Établissement AEIM</option><option value="MAIRIE">Mairie</option><option value="STAND">Stand</option></select></label>
                  {d.type === 'STAND' ? <><label>Nom du stand<input value={d.nom} onChange={e=>changerDestination(d.id,{nom:e.target.value})} placeholder="Ex. Stand marché"/></label><label>Adresse complète<input value={d.adresse} onChange={e=>changerDestination(d.id,{adresse:e.target.value})}/></label></> : <label>Destinataire<select value={d.referenceId} onChange={e=>changerDestination(d.id,{referenceId:e.target.value})}><option value="">Sélectionner…</option>{(d.type==='MAIRIE'?mairiesDisponibles.map(m=>({id:m.id,nom:m.nomAffiche||m.commune})):etablissementsDisponibles.map(e=>({id:e.id,nom:e.nom}))).map(o=><option value={o.id} key={o.id}>{o.nom}</option>)}</select></label>}
                  <label>Quantité<input type="number" min="1" step="1" value={d.quantite || ''} onChange={e=>changerDestination(d.id,{quantite:Number(e.target.value)})}/></label>
                  <label>Livraison<select value={d.livre?'LIVRE':'ATTENTE'} disabled={!estConfirmee(edition)} onChange={e=>changerDestination(d.id,{livre:e.target.value==='LIVRE'})}><option value="ATTENTE">À livrer</option><option value="LIVRE">Livré</option></select></label>
                </div>)}
                <div className="gms-dest-total"><span>Total réparti : <strong>{destinationsDe(edition).reduce((n,d)=>n+d.quantite,0)} / {edition.quantiteCommandee} brioches</strong></span><span>{destinationsDe(edition).filter(d=>d.livre).length} livraison(s) terminée(s)</span></div>
                <p className="gms-dest-help">Le stock AEIM est alimenté uniquement pour les établissements marqués « Livré ». Les mairies et stands restent suivis sans stock d'établissement fictif.</p>
              </section>
              <label>Secteur<input value={edition.secteur} onChange={e => modifier('secteur', e.target.value)} /></label>
              <label>Statut<select disabled={Boolean(editionId && paiementRapprocheVerrouille(editionId))} title={editionId && paiementRapprocheVerrouille(editionId) ? MESSAGE_PAIEMENT_VERROUILLE : undefined} value={(edition as CommandeGmsSuivi).paye ? 'PAYE' : livraisonsTerminees(edition) ? 'LIVRE' : estConfirmee(edition) ? 'CONFIRMEE' : 'BROUILLON'} onChange={e => { const v = e.target.value; setEdition(p => p ? {...p, statut:(v === 'BROUILLON' ? 'BROUILLON' : 'CONFIRMEE') as StatutCommandeArtisan, livre:livraisonsTerminees(p), paye:v === 'PAYE'} : null) }}><option value="BROUILLON">Bon créé</option><option value="CONFIRMEE">Bon confirmé</option><option value="LIVRE">Livré</option><option value="PAYE">Payé</option></select></label>

              <label className="ind-wide">Remarques<textarea rows={3} value={edition.remarque} onChange={e => modifier('remarque', e.target.value)} /></label>
              <div className="ind-form-total ind-wide">Prix TTC calculé par brioche <strong>{edition.quantiteCommandee > 0 && totalTtc.trim() !== '' && Number.isFinite(Number(totalTtc.replace(',', '.'))) ? argent(Number(totalTtc.replace(',', '.')) / edition.quantiteCommandee) : '—'}</strong></div>
              {erreur && <p className="ind-form-error ind-wide" role="alert">{erreur}</p>}
            </div>
            <footer className="ind-dialog-footer"><button type="button" className="ind-cancel" onClick={() => setEdition(null)}>Annuler</button><button type="submit" className="ind-primary"><Check size={17}/> Enregistrer la commande</button></footer>
          </form>
        </section>
      </div>}
    </main>
  )
}


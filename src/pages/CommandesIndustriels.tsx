import CompactStatCard from '../components/ui/CompactStatCard'
import { useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDays, Download, Printer,
  Euro,
  Package,
  Search,
  Store, Plus, X, Check, Pencil,
} from 'lucide-react'

import { useArtisans } from '../contexts/ArtisansContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { synchroniserReceptionIndustrielle } from '../lib/commandeIndustrielleStock'
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

import './CommandesIndustriels.css'

type StatutFiltre = 'TOUS' | 'CREES' | 'CONFIRMES' | 'LIVRES' | 'PAYES'
type CommandeIndustrie = CommandeArtisan & { etablissementId?: string; livre?: boolean; paye?: boolean }
const estConfirmee = (c: CommandeArtisan) => ['CONFIRMEE','RETRAIT_PREVU','TERMINEE'].includes(c.statut)
const libelleBon = (c: CommandeArtisan) => {
  const suivi = c as CommandeIndustrie
  if (suivi.paye) return 'Payé'
  if (suivi.livre) return 'Livré'
  return estConfirmee(c) ? 'Bon de commande confirmé' : 'Bon de commande créé'
}
const etapeCommande = (c: CommandeArtisan): Exclude<StatutFiltre, 'TOUS'> => {
  const suivi = c as CommandeIndustrie
  if (!estConfirmee(c)) return 'CREES'
  if (suivi.paye) return 'PAYES'
  if (suivi.livre) return 'LIVRES'
  return 'CONFIRMES'
}



function nomIndustriel(
  fournisseurId: string,
  fournisseurs: Array<{ id: string; nom: string }>,
) {
  return (
    fournisseurs.find((item) => item.id === fournisseurId)?.nom ||
    fournisseurId ||
    '—'
  )
}

function estIndustriel(fournisseur: Fournisseur) {
  return categoriesFournisseur(fournisseur).includes('INDUSTRIEL')
}

export default function CommandesIndustriels() {
  const { commandesArtisans, setCommandesArtisans, fournisseurs } = useArtisans()
  const { etablissements } = useEtablissements()
  const [message, setMessage] = useState('')
  const etablissementsDisponibles = useMemo(() => etablissements.filter(e => e.statut === 'ACTIF').sort((a,b) => a.nom.localeCompare(b.nom,'fr')), [etablissements])
  const [editionCellule, setEditionCellule] = useState<{ id: string; cle: string } | null>(null)
  const [valeurCellule, setValeurCellule] = useState('')
  const [edition, setEdition] = useState<CommandeIndustrie | null>(null)
  const [editionId, setEditionId] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [totalTtc, setTotalTtc] = useState('')

  function ouvrirCreation() {
    const premier = fournisseurs.filter(estIndustriel).find(f => f.statut !== 'INACTIF')
    const campagneActuelle = String(new Date().getFullYear())
    setEdition({
      id: `commande-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      numero: numeroCommandeSuivant(commandesArtisans, campagneActuelle),
      artisanId: premier?.id ?? '', campagne: campagneActuelle, dateCommande: jourLocal(), dateRetrait: '',
      repartitionJours: '', secteur: premier?.secteur ?? '', responsableSecteur: premier?.responsableSecteur ?? '',
      adresseResponsable: '', telephoneResponsable: '', personneRetrait: '', quantiteCommandee: 0,
      quantiteFabriquee: null, prixUnitaire: premier?.tarif2026 ?? premier?.tarif2025 ?? 0,
      statut: 'BROUILLON', etablissementId: '', livre: false, paye: false, etiquettesConsignes: '', bdcEnvoyeLe: '', etiquettesEnvoyeesLe: '',
      fondsEstimes: null, fondsRecus: null, factureNumero: '', factureRecueLe: '', factureScanneeLe: '',
      factureTransmiseLe: '', remarque: '', remarqueFacture: '',
    })
    setEditionId(null)
    setTotalTtc('')
    setErreur('')
  }

  function ouvrirEdition(commande: CommandeArtisan) {
    setEdition({ ...commande })
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
    if (!fournisseurs.filter(estIndustriel).some(f => f.id === edition.artisanId)) {
      setErreur('Sélectionne un fournisseur industriel existant.')
      return
    }
    const montantTtc = Number(totalTtc.replace(',', '.'))
    if (!edition.campagne.trim() || !edition.dateCommande || !Number.isInteger(edition.quantiteCommandee) || edition.quantiteCommandee <= 0 || totalTtc.trim() === '' || !Number.isFinite(montantTtc) || montantTtc < 0) {
      setErreur('Renseigne une campagne, une date, une quantité entière positive et un montant TTC valide.')
      return
    }
    // Compatibilité : la base existante stocke un prix unitaire.
    // Ne pas arrondir à 2 décimales ici, sinon quantité × prix perdrait des centimes.
    if (edition.paye && (!edition.livre || !estConfirmee(edition))) { setErreur('Un bon doit être confirmé et livré avant d’être payé.'); return }
    const commande: CommandeIndustrie = { ...edition, livre:estConfirmee(edition) ? edition.livre : false, paye:estConfirmee(edition) ? edition.paye : false, prixUnitaire: montantTtc / edition.quantiteCommandee, campagne: edition.campagne.trim(), numero: editionId ? edition.numero : numeroCommandeSuivant(commandesArtisans, edition.campagne.trim()) }
    const sync = synchroniserReceptionIndustrielle(commande, commandesArtisans.find(c => c.id === editionId), etablissements)
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
    const suivant: CommandeIndustrie = { ...(c as CommandeIndustrie) }
    if (cle === 'quantiteCommandee') {
      const q = Number(val); if (!Number.isInteger(q) || q <= 0) return setMessage('Quantité invalide.')
      suivant.quantiteCommandee = q
    } else if (cle === 'montant') {
      const m = Number(val.replace(',', '.')); if (!Number.isFinite(m) || m < 0) return setMessage('Montant TTC invalide.')
      suivant.prixUnitaire = m / suivant.quantiteCommandee
    } else if (cle === 'statut') {
      suivant.statut = val === 'BROUILLON' ? 'BROUILLON' : 'CONFIRMEE'
      suivant.livre = val === 'LIVRE' || val === 'PAYE'
      suivant.paye = val === 'PAYE'
    } else if (cle === 'artisanId') {
      if (!fournisseurs.some(f => f.id === val && estIndustriel(f))) return setMessage('Fournisseur invalide.')
      suivant.artisanId = val
    } else if (cle === 'etablissementId') suivant.etablissementId = val
    else if (cle === 'dateCommande' || cle === 'dateRetrait' || cle === 'campagne' || cle === 'secteur') Object.assign(suivant, { [cle]: val })
    else if (cle !== 'livre' && cle !== 'paye') return
    if (cle === 'livre' || cle === 'paye') {
      if (!estConfirmee(c)) return setMessage('Confirme d’abord le bon de commande.')
      if (cle === 'paye' && val === 'true' && !suivant.livre) return setMessage('Marque d’abord le bon comme livré.')
      suivant[cle] = val === 'true'
    }
    if ((c as CommandeIndustrie).paye && (cle === 'quantiteCommandee' || cle === 'montant' || cle === 'etablissementId' || cle === 'artisanId')) return setMessage('Une commande payée doit d’abord être repassée en non payée avant ces modifications.')
    if (estConfirmee(c) && cle === 'artisanId') return setMessage('Déconfirme le bon avant de changer de fournisseur.')
    const sync = synchroniserReceptionIndustrielle(suivant, c, etablissements)
    if (!sync.ok) { setMessage(sync.erreur ?? 'Mise à jour refusée.'); return }
    setCommandesArtisans(prev => prev.map(x => x.id === c.id ? suivant : x))
    setMessage('Modification enregistrée automatiquement.')
  }

  function cellule(c: CommandeArtisan, cle: string, affichage: string, type: 'text'|'number'|'date'|'select' = 'text') {
    const active = editionCellule?.id === c.id && editionCellule.cle === cle
    const options = cle === 'livre' ? [['false','À livrer'],['true','Livré']] : cle === 'paye' ? [['false','À payer'],['true','Payé']] : cle === 'statut' ? [['BROUILLON','Bon créé'],['CONFIRMEE','Bon confirmé'],['LIVRE','Livré'],['PAYE','Payé']]
      : cle === 'artisanId' ? fournisseurs.filter(estIndustriel).map(f => [f.id, f.nom])
      : cle === 'etablissementId' ? [['','À affecter'],...etablissementsDisponibles.map(e => [e.id, e.nom + (e.peutRecevoirStock ? '' : ' (stock non autorisé)')])] : []
    if (active) return type === 'select'
      ? <select autoFocus className="ind-inline-input" value={valeurCellule} onChange={e => modifierCellule(c,cle,e.target.value)} onBlur={() => setEditionCellule(null)}>{options.map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select>
      : <input autoFocus className="ind-inline-input" type={type} step={type === 'number' ? 'any' : undefined} value={valeurCellule} onChange={e => setValeurCellule(e.target.value)} onBlur={() => modifierCellule(c,cle,valeurCellule)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); modifierCellule(c,cle,valeurCellule) } if(e.key === 'Escape')setEditionCellule(null) }} />
    return <button className="ind-inline-button" type="button" title="Cliquer pour modifier" onClick={() => {
      setEditionCellule({ id: c.id, cle })
      setValeurCellule(cle === 'statut' ? ((c as CommandeIndustrie).paye ? 'PAYE' : (c as CommandeIndustrie).livre ? 'LIVRE' : estConfirmee(c) ? 'CONFIRMEE' : 'BROUILLON') : cle === 'montant' ? String(montantCommande(c)) : cle === 'etablissementId' ? (c as CommandeIndustrie).etablissementId ?? '' : String((c as unknown as Record<string, unknown>)[cle] ?? ''))
    }}>{affichage || '—'} <Pencil size={12}/></button>
  }

  async function exporterExcel() {
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Commandes industriels')
      ws.addRow(['Bon','Fournisseur','Campagne','Établissement','Date commande','Date retrait','Quantité','Total TTC','Prix / brioche','Statut','Secteur'])
      resultats.forEach(c => ws.addRow([c.numero,nomIndustriel(c.artisanId,fournisseursIndustriels),c.campagne,etablissements.find(e => e.id === (c as CommandeIndustrie).etablissementId)?.nom ?? '',c.dateCommande,c.dateRetrait,c.quantiteCommandee,montantCommande(c),c.prixUnitaire,libelleBon(c),c.secteur]))
      ws.getRow(1).font = { bold: true, color: { argb:'FFFFFFFF' } }
      ws.getRow(1).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FF173B6D'} }
      ws.columns.forEach(col => { col.width = 24 })
      ws.getColumn(8).numFmt = '#,##0.00 "€"'
      ws.getColumn(9).numFmt = '#,##0.0000 "€"'
      ws.autoFilter = { from:'A1', to:`K${resultats.length + 1}` }
      const bytes = await wb.xlsx.writeBuffer()
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
      const link=document.createElement('a');link.href=url;link.download='commandes-industriels.xlsx';link.click()
      window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    } catch { setMessage('Export Excel indisponible : vérifier exceljs.') }
  }

  function imprimerBonCommande(c: CommandeArtisan) {
    const fournisseur = fournisseurs.find(f => f.id === c.artisanId)
    const etab = etablissements.find(e => e.id === (c as CommandeIndustrie).etablissementId)
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
      <section class="card" style="min-height:100px;margin-top:12px"><h2>Lieu de livraison des brioches</h2><strong>${champ(etab?.nom)}</strong><div>${adresse(etab)}</div>
      ${etab?.telephone ? `<div>Tél. : ${enc(etab.telephone)}</div>` : ""}${etab?.email ? `<div>E-mail : ${enc(etab.email)}</div>` : ""}</section>
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

  const fournisseursIndustriels = useMemo(
    () => fournisseurs.filter(estIndustriel),
    [fournisseurs],
  )

  const idsIndustriels = useMemo(
    () => new Set(fournisseursIndustriels.map((item) => item.id)),
    [fournisseursIndustriels],
  )

  const commandesIndustriels = useMemo(
    () =>
      commandesArtisans.filter((commande) =>
        idsIndustriels.has(commande.artisanId),
      ),
    [commandesArtisans, idsIndustriels],
  )

  const campagnes = useMemo(
    () =>
      [...new Set(commandesIndustriels.map((item) => item.campagne))]
        .filter(Boolean)
        .sort((a, b) =>
          b.localeCompare(a, 'fr', { numeric: true }),
        ),
    [commandesIndustriels],
  )

  const resultats = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase('fr')

    return commandesIndustriels.filter((commande) => {
      const industriel = nomIndustriel(
        commande.artisanId,
        fournisseursIndustriels,
      )

      const correspondRecherche =
        !motif ||
        [
          commande.numero,
          industriel,
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
    commandesIndustriels,
    fournisseursIndustriels,
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

          <h1>Industriels</h1>

          <p>
            Suivi des commandes de brioches auprès des
            fournisseurs industriels.
          </p>
        </div>
        <div className="ind-header-buttons"><button type="button" className="ind-cancel" onClick={exporterExcel}><Download size={17}/> Excel</button><button type="button" className="ind-primary" onClick={ouvrirCreation} disabled={!fournisseursIndustriels.some(f => f.statut !== 'INACTIF')}>
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
            {titre} ({cle === 'TOUS' ? commandesIndustriels.length : commandesIndustriels.filter(c => etapeCommande(c) === cle).length})
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
              placeholder="Rechercher une commande, un industriel, un secteur…"
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
            {fournisseursIndustriels.length} fournisseur
            {fournisseursIndustriels.length > 1 ? 's industriels' : ' industriel'}
            dans la base fournisseurs
          </span>
        </div>

        <div className="ind-table-wrap">
          <table className="ind-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>Industriel</th>
                <th>Campagne</th>
                <th>Date commande</th>
                <th>Date retrait</th>
                <th>Lieu de livraison</th><th>Secteur</th>
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
                  <tr key={commande.id} className={(commande as CommandeIndustrie).paye ? 'ind-row-paid' : ''}>
                    <td className="ind-code">
                      {commande.numero || '—'}
                    </td>

                    <td>
                      {cellule(commande,'artisanId',nomIndustriel(commande.artisanId,fournisseursIndustriels),'select')}
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

                    <td>{cellule(commande,'etablissementId',etablissements.find(e => e.id === (commande as CommandeIndustrie).etablissementId)?.nom ?? 'À affecter','select')}</td>
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
                ),
              )}

              {!resultats.length && (
                <tr>
                  <td
                    className="ind-empty"
                    colSpan={12}
                  >
                    Aucune commande industrielle ne correspond aux
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
          <header className="ind-dialog-head"><div><span className="ind-eyebrow">ACHAT DE BRIOCHES</span><h2 id="ind-dialog-title">{editionId ? 'Modifier la commande' : 'Nouvelle commande industrielle'}</h2></div>
            <button type="button" className="ind-edit" aria-label="Fermer" onClick={() => setEdition(null)}><X size={20} /></button>
          </header>
          <form onSubmit={enregistrer}>
            <div className="ind-form-grid">
              <label className="ind-wide">Fournisseur industriel *
                <select required value={edition.artisanId} onChange={e => choisirFournisseur(e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {fournisseursIndustriels.map(f => <option key={f.id} value={f.id}>{f.nom} ({f.id}){f.statut === 'INACTIF' ? ' — Inactif' : ''}</option>)}
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
              <label>Lieu de livraison<select value={(edition as CommandeIndustrie).etablissementId ?? ''} onChange={e => setEdition(prev => prev ? {...prev,etablissementId:e.target.value} : null)}><option value="">À affecter</option>{etablissementsDisponibles.map(e => <option value={e.id} key={e.id}>{e.nom}{e.peutRecevoirStock ? '' : ' — stock non autorisé'}</option>)}</select></label>
              {!etablissementsDisponibles.length && <p className="ind-form-error ind-wide">Aucun établissement actif. Crée-en un dans Administration → Établissements.</p>}
              <label>Secteur<input value={edition.secteur} onChange={e => modifier('secteur', e.target.value)} /></label>
              <label>Statut<select value={(edition as CommandeIndustrie).paye ? 'PAYE' : (edition as CommandeIndustrie).livre ? 'LIVRE' : estConfirmee(edition) ? 'CONFIRMEE' : 'BROUILLON'} onChange={e => { const v = e.target.value; setEdition(p => p ? {...p, statut:(v === 'BROUILLON' ? 'BROUILLON' : 'CONFIRMEE') as StatutCommandeArtisan, livre:v === 'LIVRE' || v === 'PAYE', paye:v === 'PAYE'} : null) }}><option value="BROUILLON">Bon créé</option><option value="CONFIRMEE">Bon confirmé — réception stock</option><option value="LIVRE">Livré</option><option value="PAYE">Payé</option></select></label>

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


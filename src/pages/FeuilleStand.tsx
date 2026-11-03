import { useEffect, useMemo, useState } from 'react'
import { Printer, X, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import './FeuilleStand.css'

type StandSheet = {
  id: string
  nom: string
  lieu: string
  adresseStand?: string
  date: string
  debut: string
  fin: string
  responsable: string
  benevoleIds: string[]
  autresBenevoles: string
  caissePrevue: boolean
  tpePrevu: boolean
  briochesPrevues: number
  notes: string
}
type Volunteer = { id: string; nom: string; prenom: string }

type Props = {
  stand: StandSheet
  benevoles: Volunteer[]
  caisseLabels: string[]
  tpeLabels: string[]
  distributed: number
  giftCount: number
  giftTotal: number
  onClose: () => void
}

const SUPPORT_PHONE_DISPLAY = '03 83 44 30 65'
const SUPPORT_PHONE_LINK = 'tel:+33383443065'

const TEAMS_SUPPORT_URL = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzBiNGIwZDgtMjRhNi00MDI5LTg1YjctNDkxMGZiYWM0OGRi%40thread.v2/0?context=%7b%22Tid%22%3a%225870ff96-e2fc-4628-9f0a-9f5e80294a62%22%2c%22Oid%22%3a%224c8f8dc4-0f92-4ee4-90b4-fd87c473d6c9%22%7d'
function SheetQR({ value, label }: { value: string; label: string }) {
  const [qrResult, setQrResult] = useState({ value: '', src: '' })
  const src = qrResult.value === value ? qrResult.src : ''
  useEffect(() => {
    let alive = true
    if (value) void QRCode.toDataURL(value, { width: 240, margin: 2, errorCorrectionLevel: 'M' })
      .then(uri => { if (alive) setQrResult({ value, src: uri }) })
      .catch(() => { if (alive) setQrResult({ value, src: '' }) })
    return () => { alive = false }
  }, [value])
  return <div className="ob-feuille-qr-box">
    <strong>{label}</strong>
    {src ? <img src={src} alt={`QR code : ${label}`} /> : <div className="ob-feuille-qr-placeholder"><QrCode size={38}/><span>{value ? 'Génération…' : 'Lien à configurer'}</span></div>}
  </div>
}

export default function FeuilleStand({ stand, benevoles, caisseLabels, tpeLabels, distributed, giftCount, giftTotal, onClose }: Props) {
  const counterUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/gestion/stands-brioches/${encodeURIComponent(stand.id)}/compteur`
  const teamsUrl = TEAMS_SUPPORT_URL
  const volunteers = useMemo(() => [
    ...stand.benevoleIds.map(id => {
      const person = benevoles.find(b => b.id === id)
      return person ? `${person.prenom} ${person.nom}` : 'Bénévole non retrouvé'
    }),
    ...stand.autresBenevoles.split(/[,;\n]/).map(s => s.trim()).filter(Boolean),
  ], [stand.benevoleIds, stand.autresBenevoles, benevoles])
  const date = stand.date ? new Date(`${stand.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—'
  const print = () => window.print()
  return <div className="ob-feuille-overlay" role="dialog" aria-modal="true" aria-label={`Feuille Stand : ${stand.nom}`}>
    <div className="ob-feuille-dialog">
      <div className="ob-feuille-toolbar">
        <strong>Feuille Stand — aperçu A4</strong>
        <div><button type="button" onClick={print}><Printer size={17}/> Imprimer / PDF</button><button type="button" onClick={onClose} aria-label="Fermer"><X size={18}/></button></div>
      </div>
      <div className="ob-feuille-paper" id="ob-feuille-print">
        <header><div><small>OPÉRATION BRIOCHE · AEIM</small><h1>Feuille de stand</h1><p>{stand.nom}</p></div><span>FICHE DE SUIVI</span></header>
        <div className="ob-feuille-details">
          <div><span>Date</span><strong>{date}</strong></div><div><span>Horaires</span><strong>{stand.debut} – {stand.fin}</strong></div>
          <div><span>Commune / lieu</span><strong>{stand.lieu || 'Non renseigné'}</strong></div><div><span>Emplacement</span><strong>{stand.adresseStand || 'Non précisé'}</strong></div>
          <div><span>Responsable</span><strong>{stand.responsable || 'Non désigné'}</strong></div><div><span>Bénévoles</span><strong>{volunteers.join(' · ') || 'Aucun bénévole renseigné'}</strong></div>
          <div><span>Caisse</span><strong>{caisseLabels.length ? `N° ${caisseLabels.join(', ')}` : stand.caissePrevue ? 'Prévue · non attribuée' : 'Non prévue'}</strong></div>
          <div><span>TPE</span><strong>{tpeLabels.length ? `N° ${tpeLabels.join(', ')}` : stand.tpePrevu ? 'Prévu · non attribué' : 'Non prévu'}</strong></div>
        </div>
        <h2>Suivi des brioches</h2>
        <div className="ob-feuille-numbers"><div>Quantité prévue <strong>{stand.briochesPrevues || 'Non précisée'}</strong></div><div>Déjà remises (déclaratif) <strong>{distributed}</strong></div><div>Dons sans brioche <strong>{giftCount}</strong></div><div>Montant des dons déclarés <strong>{giftTotal.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</strong></div></div>
        <div className="ob-feuille-writing"><div>Brioches reçues (comptage) : __________________</div><div>Brioches restantes : __________________</div><div>Brioches distribuées : __________________</div><div>Écart / pertes : __________________</div></div>
        <h2>Accès rapides</h2>
        <div className="ob-feuille-qr-row"><div><SheetQR label="COMPTEUR DU STAND" value={counterUrl}/><p>Scanner pour ouvrir le compteur numérique</p></div><div><SheetQR label="ASSISTANCE TPE · TEAMS" value={teamsUrl}/><p>Scanner pour rejoindre la réunion Teams d’assistance TPE</p><p className="ob-feuille-phone-help">Si la visioconférence est impossible, appelez le <a href={SUPPORT_PHONE_LINK}>{SUPPORT_PHONE_DISPLAY}</a>.</p></div></div>
        <div className="ob-feuille-manual">
          <div className="ob-feuille-manual-heading"><strong>Comptage manuel des brioches</strong><span>1 trait = 1 brioche · barrer le groupe à 5</span></div>
          <div className="ob-feuille-tally-grid" aria-label="Grille de comptage papier : 50 groupes de cinq brioches">
            {Array.from({ length: 50 }, (_, i) => <div key={i} className="ob-feuille-tally-cell"><small>{i + 1}</small><span>│ │ │ │</span></div>)}
          </div>
          <div className="ob-feuille-manual-total">
            <span>Groupes complets × 5 : __________</span>
            <span>Brioches supplémentaires : __________</span>
            <strong>Total distribué : __________</strong>
          </div>
          <small>Au-delà de 250 brioches, continuer au verso et additionner les totaux.</small>
        </div>
        <footer>Fiche de suivi indicative · La mise à jour sur le compteur nécessite une connexion au logiciel.</footer>
      </div>
      <p className="ob-feuille-local-warning">Le lien du compteur utilise l'adresse de ce logiciel. Si l'application tourne sur localhost, le QR code ne fonctionnera pas depuis un autre téléphone. Une URL publique ou intranet accessible et une synchronisation serveur seront nécessaires.</p>
    </div>
  </div>
}

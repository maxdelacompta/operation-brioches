import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileText, Info, Trash2, Upload, Download, CheckCircle2 } from 'lucide-react'
import { previewSchoolTemplate, readSchoolTemplate, removeSchoolTemplate, saveSchoolTemplate, type SchoolTemplateMeta } from '../services/ecolesTemplate'
import './CampagneJustificatifsSettings.css'
import './CampagneEcolesTemplateSettings.css'

type Props = { campaignId: string; canManage: boolean }

export default function CampagneEcolesTemplateSettings({ campaignId, canManage }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [meta, setMeta] = useState<SchoolTemplateMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setMeta(null); setError(''); setNotice('')
    void readSchoolTemplate(campaignId)
      .then(record => { if (active) setMeta(record?.meta ?? null) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Modèle indisponible.') })
    return () => { active = false }
  }, [campaignId])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canManage) return
    setLoading(true); setError(''); setNotice('')
    try {
      const saved = await saveSchoolTemplate(campaignId, file)
      setMeta(saved)
      setNotice(`Modèle Écoles enregistré pour cette campagne, version ${saved.version}.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.') }
    finally { setLoading(false) }
  }

  async function remove() {
    if (!canManage || !window.confirm(`Supprimer le modèle Écoles de ${campaignId} ?`)) return
    setLoading(true); setError(''); setNotice('')
    try { await removeSchoolTemplate(campaignId); setMeta(null); setNotice('Modèle supprimé : retour au bon individuel standard.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible.') }
    finally { setLoading(false) }
  }

  async function download() {
    try { await previewSchoolTemplate(campaignId) }
    catch (e) { setError(e instanceof Error ? e.message : 'Téléchargement impossible.') }
  }

  return <section className="campaign-jd-school-template" aria-label="Modèle de bons de commande écoles">
    <div className="campaign-jd-heading">
      <div><span className="campaign-jd-eyebrow">ÉCOLES · BON DE COMMANDE</span>
        <h3>Modèle de campagne personnalisable</h3>
        <p>Comme pour les JDI, chaque campagne possède son propre PDF. Le modèle sert de fond aux bons de commande individuels des écoles.</p>
      </div>
    </div>
    <div className="campaign-jd-school-card">
      <div className="campaign-jd-school-title"><FileText size={23}/><div><strong>{meta ? meta.name : 'Aucun modèle Écoles importé'}</strong>
        <small>{meta ? `Version ${meta.version} · ${(meta.bytes / 1024).toFixed(0)} Ko · ${new Date(meta.uploadedAt).toLocaleDateString('fr-FR')}` : 'Le bon individuel standard est utilisé par défaut.'}</small></div></div>
      <div className="campaign-jd-school-actions">
        {canManage && <button type="button" disabled={loading} onClick={() => input.current?.click()}><Upload size={16}/>{meta ? 'Remplacer le modèle' : 'Importer un modèle PDF'}</button>}
        {meta && <button type="button" disabled={loading} onClick={() => void download()}><Download size={16}/> Télécharger le modèle</button>}
        {meta && canManage && <button type="button" disabled={loading} onClick={() => void remove()}><Trash2 size={16}/> Supprimer</button>}
      </div>
      <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={e => void upload(e)} />
    </div>
    <p className="campaign-jd-school-info"><Info size={16}/><span><strong>Zone verrouillée :</strong> les 107 mm inférieurs du verso sont automatiquement remplacés lors de l’export par le coupon officiel (identifiants école, classe et campagne ; nom, quantité, montant et règlement). Le reste du PDF est conservé à l’identique. Modèle requis : 2 pages A4 paysage, recto-verso. Le bandeau protégé ne doit pas contenir de contenu à conserver.</span></p>
    {error && <p className="campaign-jd-school-error" role="alert">{error}</p>}
    {notice && <p className="campaign-jd-school-success" role="status"><CheckCircle2 size={15}/>{notice}</p>}
    <small className="campaign-jd-school-note">Préproduction : le PDF est stocké localement dans le navigateur. Les modèles devront être transférés sur le serveur sécurisé de la DSI avant le déploiement.</small>
  </section>
}

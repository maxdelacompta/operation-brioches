import { useRef, useState, type ChangeEvent } from 'react'
import { CheckCircle2, Download, FileText, Info, Trash2, Upload } from 'lucide-react'
import {
  downloadConventionTemplate,
  getConventionTemplates,
  removeConventionTemplate,
  saveConventionTemplate,
  type ConventionType,
} from '../services/conventionDocuments'

const MODELS = [
  { type: 'mecenat', label: 'Convention de mécénat' },
  { type: 'sponsoring', label: 'Convention de sponsoring' },
] as const

export default function CampagneConventionSettings({ campaignId, canManage }: { campaignId: string; canManage: boolean }) {
  const [models, setModels] = useState(() => getConventionTemplates(campaignId))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inputs = useRef<Record<ConventionType, HTMLInputElement | null>>({ mecenat: null, sponsoring: null })

  async function upload(type: ConventionType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canManage) return
    try {
      await saveConventionTemplate(campaignId, type, file)
      setModels(getConventionTemplates(campaignId))
      setMessage('Modèle Word enregistré pour cette campagne.')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import impossible.')
    }
  }

  async function remove(type: ConventionType) {
    if (!canManage || !window.confirm('Supprimer ce modèle Word de la campagne ?')) return
    try {
      await removeConventionTemplate(campaignId, type)
      setModels(getConventionTemplates(campaignId))
      setMessage('Modèle supprimé.')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  async function download(type: ConventionType) {
    try {
      await downloadConventionTemplate(campaignId, type)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Téléchargement impossible.')
    }
  }

  return (
    <section className="campaign-conventions" aria-label="Modèles Word des conventions">
      <div className="campaign-jd-heading">
        <div>
          <span className="campaign-jd-eyebrow">MÉCÉNAT ET SPONSORING</span>
          <h3>Modèles Word des conventions</h3>
          <p>Associez un modèle officiel à {campaignId}, comme pour les justificatifs de dons. Chaque campagne conserve ses propres documents.</p>
        </div>
      </div>
      {message && <div className="campaign-jd-message success" role="status"><CheckCircle2 size={17} />{message}</div>}
      {error && <div className="campaign-jd-message error" role="alert"><Info size={17} />{error}</div>}
      <div className="campaign-jd-template-grid">
        {MODELS.map(({ type, label }) => {
          const model = models[type]
          return (
            <div className="campaign-jd-template-card" key={type}>
              <div className="campaign-jd-template-icon"><FileText size={24} /></div>
              <div className="campaign-jd-template-body">
                <span className="campaign-jd-template-type">{label.toUpperCase()}</span>
                <h4>{model?.name ?? 'Aucun modèle Word enregistré'}</h4>
                <p>{model ? `Version ${model.version} · ${(model.size / 1024).toFixed(0)} Ko` : 'Importer le modèle officiel .docx'}</p>
              </div>
              <div className="campaign-jd-template-actions">
                {model && <button type="button" className="secondary" onClick={() => void download(type)}><Download size={16} /> Télécharger</button>}
                {canManage && <button type="button" className="primary" onClick={() => inputs.current[type]?.click()}><Upload size={16} />{model ? 'Remplacer' : 'Importer'}</button>}
                {model && canManage && <button type="button" className="danger" title="Supprimer" aria-label={`Supprimer ${label}`} onClick={() => void remove(type)}><Trash2 size={16}/></button>}
              </div>
              <input hidden type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" ref={element => { inputs.current[type] = element }} onChange={event => void upload(type, event)}/>
            </div>
          )
        })}
      </div>
      <p className="campaign-conventions-help">
        Pour la génération automatique, placez dans le Word les champs <code>{'{entreprise}'}</code>, <code>{'{adresse}'}</code>, <code>{'{montant}'}</code>, <code>{'{campagne}'}</code>, <code>{'{date}'}</code> et <code>{'{contreparties}'}</code> (sponsoring).
        Les autres paragraphes du modèle sont conservés. La conversion du Word final en PDF n’est pas automatisée dans ce prototype.
      </p>
      <p className="campaign-conventions-local">Les fichiers restent dans ce navigateur tant que le service informatique n’a pas mis en place un stockage documentaire partagé.</p>
    </section>
  )
}

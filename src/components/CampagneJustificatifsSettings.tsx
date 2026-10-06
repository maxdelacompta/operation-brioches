import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Eye,
  FilePlus2,
  FileText,
  Info,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'

import {
  formatTemplateSize,
  getCampagneJustificatifsSettings,
  previewCampagneTemplatePdf,
  removeCampagneTemplatePdf,
  saveCampagneJustificatifsSettings,
  saveCampagneTemplatePdf,
  type CampagneJustificatifsSettings as Settings,
  type JustificatifTemplateType,
} from '../services/campagneJustificatifs'

import './CampagneJustificatifsSettings.css'

type Props = {
  campagneId: string
  annee: number | null
  canManage: boolean
}

function CampagneJustificatifsSettings({
  campagneId,
  annee,
  canManage,
}: Props) {
  const [settings, setSettings] = useState<Settings>(() =>
    getCampagneJustificatifsSettings(campagneId, annee),
  )

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [advanced, setAdvanced] = useState(false)

  const jdiInputRef = useRef<HTMLInputElement>(null)
  const jdpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSettings(
      getCampagneJustificatifsSettings(
        campagneId,
        annee,
      ),
    )
    setNotice('')
    setError('')
    setAdvanced(false)
  }, [campagneId, annee])

  function updateCheque(value: string) {
    setSettings((current) => ({
      ...current,
      cheque: {
        ...current.cheque,
        ordre: value,
      },
    }))
  }

  function updateVirement(
    key: keyof Settings['virement'],
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      virement: {
        ...current.virement,
        [key]: value,
      },
    }))
  }

  function updatePosition(
    type: JustificatifTemplateType,
    field: keyof Settings['fields']['JDI'],
    axis: 'x' | 'y',
    value: string,
  ) {
    const numeric = Number(value)

    setSettings((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [type]: {
          ...current.fields[type],
          [field]: {
            ...current.fields[type][field],
            [axis]: Number.isFinite(numeric) ? numeric : 0,
          },
        },
      },
    }))
  }

  function saveSettings() {
    if (!canManage) return

    if (!settings.cheque.ordre.trim()) {
      setError("L'ordre du chèque doit être renseigné.")
      return
    }

    if (
      !settings.virement.iban.trim() ||
      !settings.virement.bic.trim() ||
      !settings.virement.banque.trim()
    ) {
      setError(
        'Les informations de virement doivent être complètes.',
      )
      return
    }

    saveCampagneJustificatifsSettings(settings)
    setError('')
    setNotice('Paramètres des justificatifs enregistrés.')
  }

  async function handleUpload(
    type: JustificatifTemplateType,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !canManage) return

    try {
      const next = await saveCampagneTemplatePdf(
        campagneId,
        type,
        file,
        settings,
      )

      setSettings(next)
      setError('')
      setNotice(
        `Modèle ${type} enregistré — version ${next.templates[type]?.version}.`,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer le PDF.',
      )
    }
  }

  async function handlePreview(
    type: JustificatifTemplateType,
  ) {
    try {
      await previewCampagneTemplatePdf(
        campagneId,
        type,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’ouvrir le modèle PDF.',
      )
    }
  }

  async function handleRemove(
    type: JustificatifTemplateType,
  ) {
    if (!canManage) return

    if (
      !window.confirm(
        `Supprimer le modèle ${type} de ${campagneId} ?`,
      )
    ) {
      return
    }

    try {
      const next = await removeCampagneTemplatePdf(
        campagneId,
        type,
        settings,
      )

      setSettings(next)
      setError('')
      setNotice(`Modèle ${type} supprimé.`)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de supprimer le modèle.',
      )
    }
  }

  return (
    <div className="campaign-jd-settings">
      <div className="campaign-jd-heading">
        <div>
          <span className="campaign-jd-eyebrow">
            JUSTIFICATIFS DE DONS
          </span>

          <h3>Modèles PDF et règlements</h3>

          <p>
            Ces réglages sont propres à {campagneId}. Les données
            Chorus Pro ne sont pas stockées ici : elles appartiennent
            à chaque donateur.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            className="campaign-jd-save"
            onClick={saveSettings}
          >
            <Save size={17} />
            Enregistrer
          </button>
        )}
      </div>

      {notice && (
        <div className="campaign-jd-message success">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}

      {error && (
        <div className="campaign-jd-message error">
          <Info size={17} />
          {error}
        </div>
      )}

      <div className="campaign-jd-template-grid">
        <TemplateCard
          type="JDI"
          settings={settings}
          canManage={canManage}
          onUpload={() => jdiInputRef.current?.click()}
          onPreview={() => void handlePreview('JDI')}
          onRemove={() => void handleRemove('JDI')}
        />

        <TemplateCard
          type="JDP"
          settings={settings}
          canManage={canManage}
          onUpload={() => jdpInputRef.current?.click()}
          onPreview={() => void handlePreview('JDP')}
          onRemove={() => void handleRemove('JDP')}
        />
      </div>

      <input
        ref={jdiInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) =>
          void handleUpload('JDI', event)
        }
      />

      <input
        ref={jdpInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) =>
          void handleUpload('JDP', event)
        }
      />

      <div className="campaign-jd-payment-grid">
        <section className="campaign-jd-payment-card">
          <div className="campaign-jd-payment-title">
            <div className="campaign-jd-icon cheque">
              <Banknote size={20} />
            </div>

            <div>
              <h4>Chèque</h4>
              <p>
                Texte inséré lorsque le donateur a choisi le chèque.
              </p>
            </div>
          </div>

          <label>
            <span>Ordre du chèque</span>
            <input
              type="text"
              value={settings.cheque.ordre}
              disabled={!canManage}
              onChange={(event) =>
                updateCheque(event.target.value)
              }
            />
          </label>
        </section>

        <section className="campaign-jd-payment-card">
          <div className="campaign-jd-payment-title">
            <div className="campaign-jd-icon virement">
              <CreditCard size={20} />
            </div>

            <div>
              <h4>Virement</h4>
              <p>
                RIB de l’AEIM affiché uniquement pour les règlements
                par virement.
              </p>
            </div>
          </div>

          <div className="campaign-jd-fields">
            <label className="wide">
              <span>IBAN</span>
              <input
                type="text"
                value={settings.virement.iban}
                disabled={!canManage}
                onChange={(event) =>
                  updateVirement('iban', event.target.value)
                }
              />
            </label>

            <label>
              <span>BIC</span>
              <input
                type="text"
                value={settings.virement.bic}
                disabled={!canManage}
                onChange={(event) =>
                  updateVirement('bic', event.target.value)
                }
              />
            </label>

            <label>
              <span>Banque</span>
              <input
                type="text"
                value={settings.virement.banque}
                disabled={!canManage}
                onChange={(event) =>
                  updateVirement('banque', event.target.value)
                }
              />
            </label>
          </div>
        </section>
      </div>

      <section className="campaign-jd-chorus-note">
        <div className="campaign-jd-icon chorus">
          <FilePlus2 size={20} />
        </div>

        <div>
          <strong>Chorus Pro</strong>
          <p>
            Il n’y a aucune donnée Chorus de l’AEIM à configurer ici.
            Quand un donateur choisit Chorus, l’application utilise le
            SIRET, le numéro d’engagement et le code service enregistrés
            sur sa fiche. S’ils manquent, la génération du justificatif
            est bloquée et propose « Compléter la fiche donateur » ou
            « Envoyer un mail ».
          </p>
        </div>
      </section>

      <button
        type="button"
        className="campaign-jd-advanced-toggle"
        onClick={() => setAdvanced((value) => !value)}
      >
        {advanced
          ? 'Masquer les réglages PDF avancés'
          : 'Afficher les réglages PDF avancés'}
      </button>

      {advanced && (
        <div className="campaign-jd-advanced">
          <div className="campaign-jd-advanced-head">
            <div>
              <h4>Position des champs sur le PDF</h4>
              <p>
                À modifier uniquement si la maquette change d’une année
                à l’autre. Les coordonnées sont exprimées en points PDF.
              </p>
            </div>
          </div>

          {(['JDI', 'JDP'] as const).map((type) => (
            <div
              className="campaign-jd-coordinate-section"
              key={type}
            >
              <h5>{type}</h5>

              <div className="campaign-jd-coordinate-grid">
                {(
                  Object.keys(settings.fields[type]) as Array<
                    keyof Settings['fields']['JDI']
                  >
                ).map((field) => (
                  <div
                    className="campaign-jd-coordinate"
                    key={`${type}-${field}`}
                  >
                    <strong>{field}</strong>

                    <label>
                      X
                      <input
                        type="number"
                        value={settings.fields[type][field].x}
                        disabled={!canManage}
                        onChange={(event) =>
                          updatePosition(
                            type,
                            field,
                            'x',
                            event.target.value,
                          )
                        }
                      />
                    </label>

                    <label>
                      Y
                      <input
                        type="number"
                        value={settings.fields[type][field].y}
                        disabled={!canManage}
                        onChange={(event) =>
                          updatePosition(
                            type,
                            field,
                            'y',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  type,
  settings,
  canManage,
  onUpload,
  onPreview,
  onRemove,
}: {
  type: JustificatifTemplateType
  settings: Settings
  canManage: boolean
  onUpload: () => void
  onPreview: () => void
  onRemove: () => void
}) {
  const template = settings.templates[type]

  return (
    <section className="campaign-jd-template-card">
      <div className="campaign-jd-template-icon">
        <FileText size={24} />
      </div>

      <div className="campaign-jd-template-body">
        <span className="campaign-jd-template-type">
          MODÈLE {type}
        </span>

        <h4>
          {template
            ? template.fileName
            : `Aucun PDF ${type} configuré`}
        </h4>

        {template ? (
          <p>
            Version {template.version} ·{' '}
            {formatTemplateSize(template.size)}
          </p>
        ) : (
          <p>
            Importez le PDF officiel de cette campagne.
          </p>
        )}
      </div>

      <div className="campaign-jd-template-actions">
        {template && (
          <button
            type="button"
            className="secondary"
            onClick={onPreview}
          >
            <Eye size={16} />
            Voir
          </button>
        )}

        {canManage && (
          <button
            type="button"
            className="primary"
            onClick={onUpload}
          >
            <Upload size={16} />
            {template ? 'Remplacer' : 'Importer'}
          </button>
        )}

        {template && canManage && (
          <button
            type="button"
            className="danger"
            onClick={onRemove}
            aria-label={`Supprimer le modèle ${type}`}
            title={`Supprimer le modèle ${type}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </section>
  )
}

export default CampagneJustificatifsSettings

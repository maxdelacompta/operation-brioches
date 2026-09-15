import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Download,
  Eye,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  User,
} from 'lucide-react'

type Donateur = {
  id: number
  code: string
  type: string
  nom: string
  numeroVoie?: string
  adresse?: string
  cp?: string
  ville?: string
  informations?: string
  contactNom?: string
  contactPrenom?: string
  email?: string
  telephone?: string
  conditionReglement?: string
  modeReglement?: string
  prixUnitaire?: number
  nombreBrioches?: number
  jdi?: string
  jdp?: string
  rf?: string
  remarque?: string
}

const donateurs: Donateur[] = [
  {
    id: 222,
    code: '222',
    type: '',
    nom: 'MEUBLE FOISSEY',
    adresse: 'BP13',
    cp: '54302',
    ville: 'LUNEVILLE CEDEX',
    email: 'BATISCAL@GMAIL.COM',
    prixUnitaire: 5,
    nombreBrioches: 10,
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
  },
  {
    id: 221,
    code: '221',
    type: '',
    nom: 'LUNEDENT',
    numeroVoie: '72',
    adresse: "RUE D'ALSACE",
    cp: '54300',
    ville: 'LUNEVILLE',
    email: 'BATISCAL@GMAIL.COM',
    prixUnitaire: 5,
    nombreBrioches: 15,
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
  },
  {
    id: 220,
    code: '220',
    type: '',
    nom: 'RITH SARL',
    numeroVoie: '18',
    adresse: 'RUE DE POLOGNE',
    cp: '54300',
    ville: 'LUNEVILLE',
    email: 'BATISCAL@GMAIL.COM',
    prixUnitaire: 5,
    nombreBrioches: 18,
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
  },
  {
    id: 219,
    code: '219',
    type: '',
    nom: 'OPTIC CHIC',
    numeroVoie: '6',
    adresse: 'RUE CARNOT',
    cp: '54300',
    ville: 'LUNEVILLE',
    email: 'BATISCAL@GMAIL.COM',
    prixUnitaire: 5,
    nombreBrioches: 10,
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
  },
  {
    id: 218,
    code: '218',
    type: '',
    nom: 'MAIRIE DE BRULEY',
    numeroVoie: '36',
    adresse: 'RUE VICTOR HUGO',
    cp: '54200',
    ville: 'BRULEY',
    contactNom: 'BUGNET',
    contactPrenom: 'MIREILLE',
    email: 'COMMUNE.DE.BRULEY@ORANGE.FR',
    conditionReglement: 'JUSTIFICATIF',
    modeReglement: 'VIREMENT',
    prixUnitaire: 5,
    nombreBrioches: 150,
    jdi: 'OUI',
    jdp: 'NON',
    rf: 'NON',
  },
  {
    id: 139,
    code: '139',
    type: 'ENTREPRISE',
    nom: 'SCEA HARAUX',
    numeroVoie: '34',
    adresse: 'VAYRINGE',
    cp: '54000',
    ville: 'NANCY',
    informations: '8-12H ET 14H-17H',
    contactNom: 'HARAUX',
    contactPrenom: 'FRANCIS',
    email: 'FRANCIS.HARAUX@WANADOO.FR',
    telephone: '06 87 89 95 74',
    conditionReglement: 'COMMANDE',
    modeReglement: 'VIREMENT',
    prixUnitaire: 5,
    nombreBrioches: 6,
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },
  {
    id: 136,
    code: '136',
    type: 'ENTREPRISE',
    nom: 'OPCO SANTE',
    numeroVoie: '2',
    adresse: 'RUE JACQUES VILLERMAUX',
    cp: '54000',
    ville: 'NANCY',
    informations: '9H-12H ET 14H-16H45',
    contactNom: 'FELLRATH',
    contactPrenom: 'FREDERIC',
    email: 'LAURENCE.GIRARD@OPCO-SANTE.FR',
    telephone: '03 90 22 22 39',
    conditionReglement: 'JUSTIFICATIF',
    modeReglement: 'VIREMENT',
    prixUnitaire: 5,
    nombreBrioches: 5,
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },
  {
    id: 124,
    code: '124',
    type: 'ENTREPRISE',
    nom: 'HOTEL IBIS STYLES NANCY CENTRE GARE',
    numeroVoie: '3',
    adresse: "RUE DE L'ARMEE PATTON",
    cp: '54000',
    ville: 'NANCY',
    informations: '24/24h',
    contactNom: 'GIRARD',
    contactPrenom: 'CHARLES',
    email: 'charles.girard@groupesphb.fr',
    telephone: '06 60 44 93 36',
    conditionReglement: 'SUR JUSTIFICATIF',
    modeReglement: 'VIREMENT',
    prixUnitaire: 5,
    nombreBrioches: 35,
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },
]

function Donateurs() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('Tous')
  const [selectedDonateur, setSelectedDonateur] =
    useState<Donateur | null>(null)

  const types = useMemo(() => {
    const values = donateurs
      .map((donateur) => donateur.type)
      .filter(Boolean)

    return ['Tous', ...Array.from(new Set(values))]
  }, [])

  const filteredDonateurs = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim()

    return donateurs.filter((donateur) => {
      const searchableText = [
        donateur.code,
        donateur.nom,
        donateur.type,
        donateur.ville,
        donateur.contactNom,
        donateur.contactPrenom,
        donateur.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        normalizedSearch === '' ||
        searchableText.includes(normalizedSearch)

      const matchesType =
        typeFilter === 'Tous' ||
        donateur.type === typeFilter

      return matchesSearch && matchesType
    })
  }, [search, typeFilter])

  if (selectedDonateur) {
    return (
      <DonateurDetail
        donateur={selectedDonateur}
        onBack={() => setSelectedDonateur(null)}
      />
    )
  }

  return (
    <div className="donateurs-page">
      <header className="donateurs-header">
        <div>
          <span className="donateurs-eyebrow">
            Base de données
          </span>

          <h1>Donateurs</h1>

          <p>
            Base des entreprises, organismes, associations et
            partenaires liés à l'Opération Brioches.
          </p>
        </div>

        <button className="donateurs-primary-button">
          <Plus size={18} />
          Nouveau donateur
        </button>
      </header>

      <section className="donateurs-card">
        <div className="donateurs-toolbar">
          <div className="donateurs-search">
            <Search size={19} />

            <input
              type="text"
              placeholder="Rechercher un donateur, une ville, un contact..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            className="donateurs-select"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            {types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>

          <button className="donateurs-secondary-button">
            <Download size={17} />
            Exporter
          </button>
        </div>

        <div className="donateurs-results">
          <strong>
            {filteredDonateurs.length} donateur
            {filteredDonateurs.length > 1 ? 's' : ''}
          </strong>

          <span>
            Double-cliquez sur une ligne pour ouvrir la fiche
          </span>
        </div>

        <div className="donateurs-table-wrapper">
          <table className="donateurs-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom / Raison sociale</th>
                <th>Type</th>
                <th>Ville</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Brioches</th>
                <th>PU</th>
                <th>JDI</th>
                <th>JDP</th>
                <th>RF</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredDonateurs.map((donateur) => (
                <tr
                  key={donateur.id}
                  onDoubleClick={() =>
                    setSelectedDonateur(donateur)
                  }
                >
                  <td className="donateur-code">
                    {donateur.code}
                  </td>

                  <td>
                    <strong>{donateur.nom}</strong>
                  </td>

                  <td>
                    {donateur.type ? (
                      <span className="donateur-type">
                        {donateur.type}
                      </span>
                    ) : (
                      <span className="donateur-empty">
                        Non renseigné
                      </span>
                    )}
                  </td>

                  <td>{donateur.ville || '-'}</td>

                  <td>
                    {[
                      donateur.contactPrenom,
                      donateur.contactNom,
                    ]
                      .filter(Boolean)
                      .join(' ') || '-'}
                  </td>

                  <td>{donateur.email || '-'}</td>

                  <td>{donateur.nombreBrioches ?? '-'}</td>

                  <td>
                    {donateur.prixUnitaire
                      ? `${donateur.prixUnitaire} €`
                      : '-'}
                  </td>

                  <td>
                    <BooleanBadge value={donateur.jdi} />
                  </td>

                  <td>
                    <BooleanBadge value={donateur.jdp} />
                  </td>

                  <td>
                    <BooleanBadge value={donateur.rf} />
                  </td>

                  <td>
                    <div className="donateurs-actions">
                      <button
                        title="Voir la fiche"
                        onClick={() =>
                          setSelectedDonateur(donateur)
                        }
                      >
                        <Eye size={17} />
                      </button>

                      <button title="Modifier">
                        <Pencil size={17} />
                      </button>

                      <button title="Plus">
                        <MoreVertical size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function DonateurDetail({
  donateur,
  onBack,
}: {
  donateur: Donateur
  onBack: () => void
}) {
  const [tab, setTab] = useState('general')

  const montant =
    (donateur.prixUnitaire ?? 0) *
    (donateur.nombreBrioches ?? 0)

  return (
    <div className="donateurs-page">
      <button
        className="donateurs-back-button"
        onClick={onBack}
      >
        <ArrowLeft size={18} />
        Retour à la liste
      </button>

      <section className="donateur-profile">
        <div className="donateur-avatar">
          {getInitials(donateur.nom)}
        </div>

        <div className="donateur-profile-info">
          <span className="donateurs-eyebrow">
            Donateur #{donateur.code}
          </span>

          <h1>{donateur.nom}</h1>

          <div className="donateur-profile-badges">
            {donateur.type && (
              <span>{donateur.type}</span>
            )}

            <span className="active">
              Actif
            </span>
          </div>
        </div>

        <button className="donateurs-primary-button">
          <Pencil size={17} />
          Modifier la fiche
        </button>
      </section>

      <nav className="donateur-tabs">
        {[
          ['general', 'Vue générale'],
          ['coordonnees', 'Coordonnées'],
          ['contacts', 'Contacts'],
          ['participations', 'Participations OB'],
          ['documents', 'Documents'],
          ['historique', 'Historique'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'general' && (
        <>
          <div className="donateur-kpi-grid">
            <div className="donateur-kpi">
              <ShoppingCart size={22} />

              <div>
                <strong>
                  {donateur.nombreBrioches ?? 0}
                </strong>
                <span>Brioches</span>
              </div>
            </div>

            <div className="donateur-kpi">
              <strong>{donateur.prixUnitaire ?? 0} €</strong>
              <span>Prix unitaire</span>
            </div>

            <div className="donateur-kpi">
              <strong>{montant.toFixed(2)} €</strong>
              <span>Montant estimé</span>
            </div>

            <div className="donateur-kpi">
              <strong>
                {donateur.modeReglement || '-'}
              </strong>
              <span>Mode de règlement</span>
            </div>
          </div>

          <div className="donateur-detail-grid">
            <section className="donateur-detail-card">
              <h2>
                <Building2 size={19} />
                Identité
              </h2>

              <InfoRow
                label="Code donateur"
                value={donateur.code}
              />

              <InfoRow
                label="Type"
                value={
                  donateur.type || 'Non renseigné'
                }
              />

              <InfoRow
                label="Nom"
                value={donateur.nom}
              />
            </section>

            <section className="donateur-detail-card">
              <h2>
                <MapPin size={19} />
                Adresse
              </h2>

              <InfoRow
                label="N° de voie"
                value={donateur.numeroVoie || '-'}
              />

              <InfoRow
                label="Adresse"
                value={donateur.adresse || '-'}
              />

              <InfoRow
                label="Code postal"
                value={donateur.cp || '-'}
              />

              <InfoRow
                label="Ville"
                value={donateur.ville || '-'}
              />

              <InfoRow
                label="Informations"
                value={donateur.informations || '-'}
              />
            </section>

            <section className="donateur-detail-card">
              <h2>
                <User size={19} />
                Contact
              </h2>

              <InfoRow
                label="Nom"
                value={donateur.contactNom || '-'}
              />

              <InfoRow
                label="Prénom"
                value={donateur.contactPrenom || '-'}
              />

              <InfoRow
                label="Email"
                value={donateur.email || '-'}
                icon={<Mail size={15} />}
              />

              <InfoRow
                label="Téléphone"
                value={donateur.telephone || '-'}
                icon={<Phone size={15} />}
              />
            </section>

            <section className="donateur-detail-card">
              <h2>
                <ShoppingCart size={19} />
                Opération Brioches
              </h2>

              <InfoRow
                label="Condition de règlement"
                value={
                  donateur.conditionReglement || '-'
                }
              />

              <InfoRow
                label="Mode de règlement"
                value={donateur.modeReglement || '-'}
              />

              <InfoRow
                label="Prix unitaire"
                value={
                  donateur.prixUnitaire
                    ? `${donateur.prixUnitaire} €`
                    : '-'
                }
              />

              <InfoRow
                label="Nombre de brioches"
                value={String(
                  donateur.nombreBrioches ?? '-',
                )}
              />
            </section>
          </div>

          <section className="donateur-detail-card donateur-documents-card">
            <h2>Suivi documentaire</h2>

            <div className="donateur-document-grid">
              <DocumentStatus
                label="JDI"
                value={donateur.jdi}
              />

              <DocumentStatus
                label="JDP"
                value={donateur.jdp}
              />

              <DocumentStatus
                label="RF"
                value={donateur.rf}
              />
            </div>
          </section>

          {donateur.remarque && (
            <section className="donateur-detail-card">
              <h2>Remarque</h2>
              <p>{donateur.remarque}</p>
            </section>
          )}
        </>
      )}

      {tab !== 'general' && (
        <section className="donateur-empty-section">
          <h2>
            {getTabLabel(tab)}
          </h2>

          <p>
            Cette section sera alimentée par la base de données
            lorsque nous créerons les relations entre les
            différents modules.
          </p>
        </section>
      )}
    </div>
  )
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="donateur-info-row">
      <span>{label}</span>

      <strong>
        {icon}
        {value}
      </strong>
    </div>
  )
}

function BooleanBadge({
  value,
}: {
  value?: string
}) {
  const yes = value?.toUpperCase() === 'OUI'

  return (
    <span
      className={`donateur-boolean ${
        yes ? 'yes' : 'no'
      }`}
    >
      {value || '-'}
    </span>
  )
}

function DocumentStatus({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  const yes = value?.toUpperCase() === 'OUI'

  return (
    <div className="donateur-document">
      <span>{label}</span>

      <strong className={yes ? 'yes' : 'no'}>
        {value || 'NON'}
      </strong>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
}

function getTabLabel(tab: string) {
  switch (tab) {
    case 'coordonnees':
      return 'Coordonnées'
    case 'contacts':
      return 'Contacts'
    case 'participations':
      return 'Participations Opération Brioches'
    case 'documents':
      return 'Documents'
    case 'historique':
      return 'Historique'
    default:
      return ''
  }
}

export default Donateurs
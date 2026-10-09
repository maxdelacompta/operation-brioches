import CompactStatCard from '../components/ui/CompactStatCard'
import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Euro,
  Package,
  Search,
  Store,
} from 'lucide-react'

import { useArtisans } from '../contexts/ArtisansContext'
import type {
  CommandeArtisan,
  StatutCommandeArtisan,
} from '../types/artisans'
import {
  argent,
  dateLisible,
  montantCommande,
} from '../types/artisans'

import './CommandesArtisans.css'

type StatutFiltre = 'TOUS' | StatutCommandeArtisan

const STATUT_LABELS: Record<StatutCommandeArtisan, string> = {
  A_VERIFIER: 'À vérifier',
  BROUILLON: 'Brouillon',
  CONFIRMEE: 'Confirmée',
  RETRAIT_PREVU: 'Retrait prévu',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

function nomArtisan(
  artisanId: string,
  fournisseurs: Array<{ id: string; nom: string }>,
) {
  return (
    fournisseurs.find((item) => item.id === artisanId)?.nom ||
    artisanId ||
    '—'
  )
}

export default function CommandesArtisans() {
  const { commandesArtisans, fournisseurs } = useArtisans()

  const [recherche, setRecherche] = useState('')
  const [campagne, setCampagne] = useState('TOUTES')
  const [statut, setStatut] = useState<StatutFiltre>('TOUS')

  const campagnes = useMemo(
    () =>
      [...new Set(commandesArtisans.map((item) => item.campagne))]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a, 'fr', { numeric: true })),
    [commandesArtisans],
  )

  const resultats = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase('fr')

    return commandesArtisans.filter((commande) => {
      const artisan = nomArtisan(commande.artisanId, fournisseurs)

      const correspondRecherche =
        !motif ||
        [
          commande.numero,
          artisan,
          commande.secteur,
          commande.responsableSecteur,
          commande.personneRetrait,
          commande.campagne,
        ]
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(motif)

      const correspondCampagne =
        campagne === 'TOUTES' || commande.campagne === campagne

      const correspondStatut =
        statut === 'TOUS' || commande.statut === statut

      return (
        correspondRecherche &&
        correspondCampagne &&
        correspondStatut
      )
    })
  }, [
    commandesArtisans,
    fournisseurs,
    recherche,
    campagne,
    statut,
  ])

  const totalQuantite = useMemo(
    () =>
      resultats.reduce(
        (total, commande) => total + commande.quantiteCommandee,
        0,
      ),
    [resultats],
  )

  const totalMontant = useMemo(
    () =>
      resultats.reduce(
        (total, commande) => total + montantCommande(commande),
        0,
      ),
    [resultats],
  )

  return (
    <main className="art-page">
      <header className="art-header">
        <div>
          <span className="art-eyebrow">COMMANDES ACHATS</span>
          <h1>Artisans</h1>
          <p>
            Suivi des commandes de brioches auprès des artisans.
          </p>
        </div>
      </header>

      <section className="art-stats">
        <CompactStatCard className="art-stat"
          icon={<Package size={21} />}
          label="Commandes"
          value={String(resultats.length)}
        />
        <CompactStatCard className="art-stat"
          icon={<Store size={21} />}
          label="Brioches commandées"
          value={new Intl.NumberFormat('fr-FR').format(totalQuantite)}
        />
        <CompactStatCard className="art-stat"
          icon={<Euro size={21} />}
          label="Montant estimé"
          value={argent(totalMontant)}
        />
      </section>

      <section className="art-card">
        <div className="art-toolbar">
          <label className="art-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Rechercher une commande, un artisan, un secteur…"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
            />
          </label>

          <select
            value={campagne}
            onChange={(event) => setCampagne(event.target.value)}
            aria-label="Filtrer par campagne"
          >
            <option value="TOUTES">Toutes les campagnes</option>
            {campagnes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            value={statut}
            onChange={(event) =>
              setStatut(event.target.value as StatutFiltre)
            }
            aria-label="Filtrer par statut"
          >
            <option value="TOUS">Tous les statuts</option>
            {(Object.keys(STATUT_LABELS) as StatutCommandeArtisan[]).map(
              (value) => (
                <option key={value} value={value}>
                  {STATUT_LABELS[value]}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="art-results">
          <strong>
            {resultats.length} commande
            {resultats.length > 1 ? 's' : ''}
          </strong>
        </div>

        <div className="art-table-wrap">
          <table className="art-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>Artisan</th>
                <th>Campagne</th>
                <th>Date commande</th>
                <th>Date retrait</th>
                <th>Secteur</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>

            <tbody>
              {resultats.map((commande: CommandeArtisan) => (
                <tr key={commande.id}>
                  <td className="art-code">{commande.numero || '—'}</td>
                  <td>
                    {nomArtisan(
                      commande.artisanId,
                      fournisseurs,
                    )}
                  </td>
                  <td>{commande.campagne || '—'}</td>
                  <td>
                    <span className="art-date">
                      <CalendarDays size={14} />
                      {dateLisible(commande.dateCommande)}
                    </span>
                  </td>
                  <td>{dateLisible(commande.dateRetrait)}</td>
                  <td>{commande.secteur || '—'}</td>
                  <td>
                    {new Intl.NumberFormat('fr-FR').format(
                      commande.quantiteCommandee,
                    )}
                  </td>
                  <td>{argent(commande.prixUnitaire)}</td>
                  <td>{argent(montantCommande(commande))}</td>
                  <td>
                    <span
                      className={`art-status art-status--${commande.statut.toLowerCase()}`}
                    >
                      {STATUT_LABELS[commande.statut]}
                    </span>
                  </td>
                </tr>
              ))}

              {!resultats.length && (
                <tr>
                  <td className="art-empty" colSpan={10}>
                    Aucune commande artisan ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}


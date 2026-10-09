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
  Fournisseur,
  StatutCommandeArtisan,
} from '../types/artisans'
import {
  argent,
  categoriesFournisseur,
  dateLisible,
  montantCommande,
} from '../types/artisans'

import './CommandesGms.css'

type StatutFiltre = 'TOUS' | StatutCommandeArtisan

const STATUT_LABELS: Record<StatutCommandeArtisan, string> = {
  A_VERIFIER: 'À vérifier',
  BROUILLON: 'Brouillon',
  CONFIRMEE: 'Confirmée',
  RETRAIT_PREVU: 'Retrait prévu',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
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
  const { commandesArtisans, fournisseurs } = useArtisans()

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
      const gms = nomGms(
        commande.artisanId,
        fournisseursGms,
      )

      const correspondRecherche =
        !motif ||
        [
          commande.numero,
          gms,
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

      const correspondStatut =
        statut === 'TOUS' ||
        commande.statut === statut

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
    <main className="gms-page">
      <header className="gms-header">
        <div>
          <span className="gms-eyebrow">
            COMMANDES ACHATS
          </span>

          <h1>GMS</h1>

          <p>
            Suivi des commandes de brioches auprès des
            grandes et moyennes surfaces.
          </p>
        </div>
      </header>

      <section className="gms-stats">
        <CompactStatCard className="gms-stat"
          icon={<Package size={21} />}
          label="Commandes"
          value={String(resultats.length)}
        />

        <CompactStatCard className="gms-stat"
          icon={<Store size={21} />}
          label="Brioches commandées"
          value={new Intl.NumberFormat('fr-FR').format(
            totalQuantite,
          )}
        />

        <CompactStatCard className="gms-stat"
          icon={<Euro size={21} />}
          label="Montant estimé"
          value={argent(totalMontant)}
        />
      </section>

      <section className="gms-card">
        <div className="gms-toolbar">
          <label className="gms-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Rechercher une commande, une GMS, un secteur…"
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
            <option value="TOUS">
              Tous les statuts
            </option>

            {(
              Object.keys(
                STATUT_LABELS,
              ) as StatutCommandeArtisan[]
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {STATUT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="gms-results">
          <strong>
            {resultats.length} commande
            {resultats.length > 1 ? 's' : ''}
          </strong>

          <span>
            {fournisseursGms.length} fournisseur
            {fournisseursGms.length > 1 ? 's' : ''} GMS
            dans la base fournisseurs
          </span>
        </div>

        <div className="gms-table-wrap">
          <table className="gms-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>GMS</th>
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
              {resultats.map(
                (commande: CommandeArtisan) => (
                  <tr key={commande.id}>
                    <td className="gms-code">
                      {commande.numero || '—'}
                    </td>

                    <td>
                      {nomGms(
                        commande.artisanId,
                        fournisseursGms,
                      )}
                    </td>

                    <td>
                      {commande.campagne || '—'}
                    </td>

                    <td>
                      <span className="gms-date">
                        <CalendarDays size={14} />
                        {dateLisible(
                          commande.dateCommande,
                        )}
                      </span>
                    </td>

                    <td>
                      {dateLisible(
                        commande.dateRetrait,
                      )}
                    </td>

                    <td>
                      {commande.secteur || '—'}
                    </td>

                    <td>
                      {new Intl.NumberFormat(
                        'fr-FR',
                      ).format(
                        commande.quantiteCommandee,
                      )}
                    </td>

                    <td>
                      {argent(
                        commande.prixUnitaire,
                      )}
                    </td>

                    <td>
                      {argent(
                        montantCommande(
                          commande,
                        ),
                      )}
                    </td>

                    <td>
                      <span
                        className={`gms-status gms-status--${commande.statut.toLowerCase()}`}
                      >
                        {
                          STATUT_LABELS[
                            commande.statut
                          ]
                        }
                      </span>
                    </td>
                  </tr>
                ),
              )}

              {!resultats.length && (
                <tr>
                  <td
                    className="gms-empty"
                    colSpan={10}
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
    </main>
  )
}


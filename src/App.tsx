import { lazy } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import './App.css'
import './styles/index.css'

import { UsersProvider } from './contexts/UsersProvider'
import { ObDataProvider } from './contexts/ObDataProvider'
import { PermissionsProvider } from './contexts/PermissionsProvider'
import { GeneralSettingsProvider } from './contexts/GeneralSettingsProvider'
import { ArtisansProvider } from "./contexts/ArtisansProvider"
import { JustificatifsProvider } from "./contexts/JustificatifsProvider"
import { EtablissementsProvider } from "./contexts/EtablissementsProvider"
import { MairiesProvider } from "./contexts/MairiesProvider"
import { CommandesMairiesRsProvider } from "./contexts/CommandesMairiesRsProvider"

import AppLayout from './layouts/AppLayout'
import { AuthProvider } from "./contexts/AuthProvider"
import Connexion from './pages/Connexion'

// Chaque page est chargée à la première ouverture de sa route.
// Les providers, l'authentification et le layout restent disponibles dès le démarrage.
const AccesConnexion = lazy(() => import('./pages/AccesConnexion'))
const ResetOB2026 = lazy(() => import('./pages/ResetOB2026'))
const ThemeShowcase = lazy(() => import('./pages/ThemeShowcase'))

const Accueil = lazy(() => import('./pages/Accueil'))
const VuesEnsembleRubriques = lazy(() => import('./pages/VuesEnsembleRubriques'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const SuiviCaisseTpe = lazy(() => import('./pages/SuiviCaisseTpe'))
const Communication = lazy(() => import('./pages/Communication'))
const Comptabilite = lazy(() => import('./pages/Comptabilite'))
const Etablissement = lazy(() => import('./pages/Etablissement'))
const SuiviBrioches = lazy(() => import('./pages/SuiviBrioches'))
const StockBrioches = lazy(() => import('./pages/StockBrioches'))
const RecapBrioches = lazy(() => import('./pages/RecapBrioches'))

const Recherche = lazy(() => import('./pages/Recherche'))
const Bdd = lazy(() => import('./pages/Bdd'))
const StandsBrioches = lazy(() => import('./pages/StandsBrioches'))
const CompteurStand = lazy(() => import('./pages/CompteurStand'))
const Donateurs = lazy(() => import('./pages/Donateurs'))
const Mairies = lazy(() => import('./pages/Mairies'))
const Benevoles = lazy(() => import('./pages/Benevoles'))

const Commandes = lazy(() => import('./pages/Commandes'))
const LivraisonsRetraits = lazy(() => import('./pages/LivraisonsRetraits'))
const SuiviGlobalEntreprises = lazy(() => import('./pages/SuiviGlobalEntreprises'))
const CommandesMairiesRs = lazy(() => import('./pages/CommandesMairiesRs'))
const CommandesArtisans = lazy(() => import('./pages/CommandesArtisans'))
const Fournisseurs = lazy(() => import('./pages/Fournisseurs'))
const CommandesGms = lazy(() => import('./pages/CommandesGms'))
const CommandesIndustriels = lazy(() => import('./pages/CommandesIndustriels'))
const SuiviCommandesAchats = lazy(() => import('./pages/SuiviCommandesAchats'))
const Geographie = lazy(() => import('./pages/Geographie'))

const FichesCaisse = lazy(() => import('./pages/FichesCaisse'))
const Coffre = lazy(() => import('./pages/Coffre'))
const SuiviBanque = lazy(() => import('./pages/Suivibanque'))
const GestionCheques = lazy(() => import('./pages/GestionCheques'))
const RecapitulatifGlobal = lazy(() => import('./pages/RecapitulatifGlobal'))

const JustificatifsDons = lazy(() => import('./pages/JustificatifsDons'))
const FacturesPaiements = lazy(() => import('./pages/FacturesPaiements'))
const Mecenat = lazy(() => import('./pages/Mecenat'))
const PertesEcarts = lazy(() => import('./pages/PertesEcarts'))

const Administration = lazy(() => import('./pages/Administration'))
const Utilisateurs = lazy(() => import('./pages/Utilisateurs'))
const GestionMonCompte = lazy(() => import('./pages/GestionMonCompte'))
const RolesPermissions = lazy(() => import('./pages/RolesPermissions'))
const Campagnes = lazy(() => import('./pages/Campagnes'))
const ParametresGeneraux = lazy(() => import('./pages/ParametresGeneraux'))
const JournalActivite = lazy(() => import('./pages/JournalActivite'))
const MesAlertes = lazy(() => import('./pages/MesAlertes'))
const AdminEtablissements = lazy(() => import('./pages/AdminEtablissements'))

function App() {
  return (
    <UsersProvider>
      <AuthProvider>
      <BrowserRouter>
      <ObDataProvider>
      <PermissionsProvider>
        <GeneralSettingsProvider>
          <ArtisansProvider>
            <EtablissementsProvider>
              <MairiesProvider>
                <CommandesMairiesRsProvider>
                <JustificatifsProvider>
                <Routes>
                  <Route path="/connexion" element={<Connexion />} />
                  <Route element={<AppLayout />}>
                    <Route path="/administration/acces-connexion" element={<AccesConnexion />} />
                    <Route path="/" element={<Accueil />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/rubriques/:rubrique" element={<VuesEnsembleRubriques />} />
                    <Route path="/mon-compte" element={<GestionMonCompte />} />
                    <Route path="/mes-alertes" element={<MesAlertes />} />
                    <Route path="/recherche" element={<Recherche />} />
                    <Route
                      path="/gestion/suivi-caisse-tpe"
                      element={<SuiviCaisseTpe />}
                    />
                    <Route path="/communication" element={<Communication />} />
                    <Route path="/comptabilite" element={<Comptabilite />} />
                    <Route path="/etablissement" element={<Etablissement />} />
                    <Route path="/etablissements/suivi-brioches" element={<SuiviBrioches />} />
                    <Route path="/etablissements/stock-brioches" element={<StockBrioches />} />
                    <Route path="/etablissements/recap-global" element={<RecapBrioches />} />

                    <Route path="/gestion/stands-brioches" element={<StandsBrioches />} />
                    <Route path="/gestion/stands-brioches/:id/compteur" element={<CompteurStand />} />
                    <Route path="/bdd" element={<Bdd />} />
                    <Route path="/bdd/donateurs" element={<Donateurs />} />
                    <Route path="/bdd/mairies" element={<Mairies />} />
                     <Route path="/bdd/benevoles" element={<Benevoles />} />

                    <Route path="/commandes" element={<Commandes />} />
                    <Route
                      path="/commandes/livraisons-retraits"
                      element={<LivraisonsRetraits />}
                    />
                    <Route
                      path="/commandes/suivi-global-entreprises"
                      element={<SuiviGlobalEntreprises />}
                    />
                    <Route
                      path="/commandes/mairies-rs"
                      element={<CommandesMairiesRs />}
                    />

                    <Route path="/commandes-achats/suivi-global" element={<SuiviCommandesAchats />} />
                    <Route
                      path="/commandes-achats/artisans"
                      element={<CommandesArtisans />}
                    />
                    <Route
                      path="/commandes-achats/fournisseurs"
                      element={<Fournisseurs />}
                    />
                    <Route
                      path="/commandes-achats/gms"
                      element={<CommandesGms />}
                    />
                    <Route
                      path="/commandes-achats/industriels"
                      element={<CommandesIndustriels />}
                    />
                    <Route
                      path="/commandes-achats/artisans/fournisseurs"
                      element={
                        <Navigate
                          to="/commandes-achats/fournisseurs"
                          replace
                        />
                      }
                    />

                    <Route
                      path="/theme-preview"
                      element={<ThemeShowcase />}
                    />

                    <Route
                      path="/encaissements/fiches-caisse"
                      element={<FichesCaisse />}
                    />
                    <Route
                      path="/encaissements/coffre"
                      element={<Coffre />}
                    />
                    <Route
                      path="/encaissements/suivi-banque"
                      element={<SuiviBanque />}
                    />
                    <Route
                      path="/encaissements/gestion-cheques"
                      element={<GestionCheques />}
                    />
                    <Route
                      path="/encaissements/recapitulatif-global"
                      element={<RecapitulatifGlobal />}
                    />

                    <Route path="/finance/factures-paiements" element={<FacturesPaiements />} />
                    <Route path="/finance/mecenat" element={<Mecenat />} />
                    <Route path="/finance/pertes-ecarts" element={<PertesEcarts />} />
                    <Route
                      path="/finance/justificatifs-dons"
                      element={<JustificatifsDons />}
                    />

                    <Route
                      path="/geographie"
                      element={
                        <Navigate
                          to="/geographie/carte"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/geographie/carte"
                      element={<Geographie />}
                    />
                    <Route
                      path="/geographie/secteurs"
                      element={<Geographie />}
                    />
                    <Route
                      path="/geographie/comparaison"
                      element={<Geographie />}
                    />
                    <Route
                      path="/geographie/couverture"
                      element={<Geographie />}
                    />

                    <Route path="/administration/reset-ob2026" element={<ResetOB2026 />} />
                    <Route
                      path="/administration"
                      element={<Administration />}
                    />
                    <Route
                      path="/administration/utilisateurs"
                      element={<Utilisateurs />}
                    />
                    <Route
                      path="/administration/roles"
                      element={<RolesPermissions />}
                    />
                    <Route
                      path="/administration/campagnes"
                      element={<Campagnes />}
                    />
                    <Route
                      path="/administration/etablissements"
                      element={<AdminEtablissements />}
                    />
                    <Route
                      path="/administration/parametres"
                      element={<ParametresGeneraux />}
                    />
                    <Route
                      path="/administration/journal"
                      element={<JournalActivite />}
                    />
                    <Route
                      path="/administration/:section"
                      element={<Administration />}
                    />
                  </Route>
                </Routes>
              </JustificatifsProvider>
                </CommandesMairiesRsProvider>
              </MairiesProvider>
            </EtablissementsProvider>
          </ArtisansProvider>
        </GeneralSettingsProvider>
      </PermissionsProvider>
      </ObDataProvider>
      </BrowserRouter>
      </AuthProvider>
    </UsersProvider>
  )
}

export default App

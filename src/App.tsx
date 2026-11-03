import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import './App.css'
import './styles/index.css'

import { UsersProvider } from './contexts/UsersProvider'
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
import AccesConnexion from './pages/AccesConnexion'
import ResetOB2026 from './pages/ResetOB2026'

import ThemeShowcase from './pages/ThemeShowcase'

import Accueil from './pages/Accueil'
import Dashboard from './pages/Dashboard'
import SuiviCaisseTpe from './pages/SuiviCaisseTpe'
import Communication from './pages/Communication'
import Comptabilite from './pages/Comptabilite'
import Etablissement from './pages/Etablissement'
import SuiviBrioches from './pages/SuiviBrioches'
import StockBrioches from './pages/StockBrioches'
import RecapBrioches from './pages/RecapBrioches'

import Recherche from './pages/Recherche'
import Bdd from './pages/Bdd'
import StandsBrioches from './pages/StandsBrioches'
import Donateurs from './pages/Donateurs'
import Mairies from './pages/Mairies'
import Benevoles from './pages/Benevoles'

import Commandes from './pages/Commandes'
import LivraisonsRetraits from './pages/LivraisonsRetraits'
import SuiviGlobalEntreprises from './pages/SuiviGlobalEntreprises'
import CommandesMairiesRs from './pages/CommandesMairiesRs'
import CommandesArtisans from './pages/CommandesArtisans'
import Fournisseurs from './pages/Fournisseurs'
import CommandesGms from './pages/CommandesGms'
import CommandesIndustriels from './pages/CommandesIndustriels'
import SuiviCommandesAchats from './pages/SuiviCommandesAchats'
import Geographie from './pages/Geographie'

import FichesCaisse from './pages/FichesCaisse'
import Coffre from './pages/Coffre'
import SuiviBanque from './pages/Suivibanque'
import GestionCheques from './pages/GestionCheques'
import RecapitulatifGlobal from './pages/RecapitulatifGlobal'

import JustificatifsDons from './pages/JustificatifsDons'
import FacturesPaiements from './pages/FacturesPaiements'

import Administration from './pages/Administration'
import Utilisateurs from './pages/Utilisateurs'
import GestionMonCompte from './pages/GestionMonCompte'
import RolesPermissions from './pages/RolesPermissions'
import Campagnes from './pages/Campagnes'
import ParametresGeneraux from './pages/ParametresGeneraux'
import JournalActivite from './pages/JournalActivite'
import AdminEtablissements from './pages/AdminEtablissements'

function App() {
  return (
    <UsersProvider>
      <AuthProvider>
      <PermissionsProvider>
        <GeneralSettingsProvider>
          <ArtisansProvider>
            <EtablissementsProvider>
              <MairiesProvider>
                <CommandesMairiesRsProvider>
                <JustificatifsProvider>
                <BrowserRouter>
                <Routes>
                  <Route path="/connexion" element={<Connexion />} />
                  <Route element={<AppLayout />}>
                    <Route path="/administration/acces-connexion" element={<AccesConnexion />} />
                    <Route path="/" element={<Accueil />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/mon-compte" element={<GestionMonCompte />} />
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
                </BrowserRouter>
              </JustificatifsProvider>
                </CommandesMairiesRsProvider>
              </MairiesProvider>
            </EtablissementsProvider>
          </ArtisansProvider>
        </GeneralSettingsProvider>
      </PermissionsProvider>
      </AuthProvider>
    </UsersProvider>
  )
}

export default App

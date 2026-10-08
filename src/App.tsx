import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import './App.css'

import { UsersProvider } from './contexts/UsersContext'
import { PermissionsProvider } from './contexts/PermissionsContext'
import { GeneralSettingsProvider } from './contexts/GeneralSettingsContext'
import { ArtisansProvider } from './contexts/ArtisansContext'
import { JustificatifsProvider } from './contexts/JustificatifsContext'
import { EtablissementsProvider } from './contexts/EtablissementsContext'
import { MairiesProvider } from './contexts/MairiesContext'
import { CommandesMairiesRsProvider } from './contexts/CommandesMairiesRsContext'

import AppLayout from './layouts/AppLayout'

import Accueil from './pages/Accueil'
import Dashboard from './pages/Dashboard'
import SuiviCaisseTpe from './pages/SuiviCaisseTpe'
import Communication from './pages/Communication'
import Comptabilite from './pages/Comptabilite'
import Etablissement from './pages/Etablissement'

import Bdd from './pages/Bdd'
import Donateurs from './pages/Donateurs'
import Mairies from './pages/Mairies'

import Commandes from './pages/Commandes'
import LivraisonsRetraits from './pages/LivraisonsRetraits'
import SuiviGlobalEntreprises from './pages/SuiviGlobalEntreprises'
import CommandesMairiesRs from './pages/CommandesMairiesRs'
import CommandesArtisans from './pages/CommandesArtisans'
import Fournisseurs from './pages/Fournisseurs'
import CommandesGms from './pages/CommandesGms'
import Geographie from './pages/Geographie'

import FichesCaisse from './pages/FichesCaisse'
import Coffre from './pages/Coffre'
import SuiviBanque from './pages/Suivibanque'
import RecapitulatifGlobal from './pages/RecapitulatifGlobal'

import JustificatifsDons from './pages/JustificatifsDons'

import Administration from './pages/Administration'
import Utilisateurs from './pages/Utilisateurs'
import RolesPermissions from './pages/RolesPermissions'
import Campagnes from './pages/Campagnes'
import ParametresGeneraux from './pages/ParametresGeneraux'
import JournalActivite from './pages/JournalActivite'
import AdminEtablissements from './pages/AdminEtablissements'

function App() {
  return (
    <UsersProvider>
      <PermissionsProvider>
        <GeneralSettingsProvider>
          <ArtisansProvider>
            <EtablissementsProvider>
              <MairiesProvider>
                <CommandesMairiesRsProvider>
                <JustificatifsProvider>
                <BrowserRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Accueil />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route
                      path="/gestion/suivi-caisse-tpe"
                      element={<SuiviCaisseTpe />}
                    />
                    <Route path="/communication" element={<Communication />} />
                    <Route path="/comptabilite" element={<Comptabilite />} />
                    <Route path="/etablissement" element={<Etablissement />} />

                    <Route path="/bdd" element={<Bdd />} />
                    <Route path="/bdd/donateurs" element={<Donateurs />} />
                    <Route path="/bdd/mairies" element={<Mairies />} />

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
                      path="/commandes-achats/artisans/fournisseurs"
                      element={
                        <Navigate
                          to="/commandes-achats/fournisseurs"
                          replace
                        />
                      }
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
                      path="/encaissements/recapitulatif-global"
                      element={<RecapitulatifGlobal />}
                    />

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
    </UsersProvider>
  )
}

export default App

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

import AppLayout from './layouts/AppLayout'

import Accueil from './pages/Accueil'
import Dashboard from './pages/Dashboard'
import Communication from './pages/Communication'
import Comptabilite from './pages/Comptabilite'
import Etablissement from './pages/Etablissement'

import Bdd from './pages/Bdd'
import Donateurs from './pages/Donateurs'

import Commandes from './pages/Commandes'
import CommandesArtisans from './pages/CommandesArtisans'
import Fournisseurs from './pages/Fournisseurs'

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

function App() {
  return (
    <UsersProvider>
      <PermissionsProvider>
        <GeneralSettingsProvider>
          <ArtisansProvider>
            <JustificatifsProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Accueil />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/communication" element={<Communication />} />
                    <Route path="/comptabilite" element={<Comptabilite />} />
                    <Route path="/etablissement" element={<Etablissement />} />

                    <Route path="/bdd" element={<Bdd />} />
                    <Route path="/bdd/donateurs" element={<Donateurs />} />

                    <Route path="/commandes" element={<Commandes />} />

                    <Route
                      path="/commandes-achats/artisans"
                      element={<CommandesArtisans />}
                    />
                    <Route
                      path="/commandes-achats/fournisseurs"
                      element={<Fournisseurs />}
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
          </ArtisansProvider>
        </GeneralSettingsProvider>
      </PermissionsProvider>
    </UsersProvider>
  )
}

export default App

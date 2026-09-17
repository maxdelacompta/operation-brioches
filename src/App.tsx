import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom'

import './App.css'

/* =========================================================
   CONTEXTES
   ========================================================= */

import {
  UsersProvider,
} from './contexts/UsersContext'

import {
  PermissionsProvider,
} from './contexts/PermissionsContext'

import {
  GeneralSettingsProvider,
} from './contexts/GeneralSettingsContext'

/* =========================================================
   LAYOUT PRINCIPAL

   Sidebar + Topbar + Chat + Outlet
   ========================================================= */

import AppLayout from './layouts/AppLayout'

/* =========================================================
   PAGES PRINCIPALES
   ========================================================= */

import Accueil from './pages/Accueil'
import Dashboard from './pages/Dashboard'
import Communication from './pages/Communication'
import Comptabilite from './pages/Comptabilite'
import Etablissement from './pages/Etablissement'

/* =========================================================
   BASE DE DONNÉES
   ========================================================= */

import Bdd from './pages/Bdd'
import Donateurs from './pages/Donateurs'

/* =========================================================
   COMMANDES ET ENCAISSEMENTS
   ========================================================= */

import Commandes from './pages/Commandes'
import FichesCaisse from './pages/FichesCaisse'

/* =========================================================
   ADMINISTRATION
   ========================================================= */

import Administration from './pages/Administration'

import Utilisateurs from './pages/Utilisateurs'

import RolesPermissions from './pages/RolesPermissions'

import Campagnes from './pages/Campagnes'

import ParametresGeneraux from './pages/ParametresGeneraux'

import JournalActivite from './pages/JournalActivite'

/* =========================================================
   APPLICATION
   ========================================================= */

function App() {
  return (
    <UsersProvider>

      <PermissionsProvider>

        <GeneralSettingsProvider>

          <BrowserRouter>

            <Routes>

              {/* ==========================================
                  LAYOUT COMMUN
              ========================================== */}

              <Route element={<AppLayout />}>

                {/* ========================================
                    ACCUEIL
                ======================================== */}

                <Route
                  path="/"
                  element={<Accueil />}
                />

                {/* ========================================
                    TABLEAU DE BORD
                ======================================== */}

                <Route
                  path="/dashboard"
                  element={<Dashboard />}
                />

                {/* ========================================
                    COMMUNICATION
                ======================================== */}

                <Route
                  path="/communication"
                  element={<Communication />}
                />

                {/* ========================================
                    COMPTABILITÉ
                ======================================== */}

                <Route
                  path="/comptabilite"
                  element={<Comptabilite />}
                />

                {/* ========================================
                    ÉTABLISSEMENT
                ======================================== */}

                <Route
                  path="/etablissement"
                  element={<Etablissement />}
                />

                {/* ========================================
                    BASE DE DONNÉES
                ======================================== */}

                <Route
                  path="/bdd"
                  element={<Bdd />}
                />

                {/* ========================================
                    DONATEURS
                ======================================== */}

                <Route
                  path="/bdd/donateurs"
                  element={<Donateurs />}
                />

                {/* ========================================
                    COMMANDES
                ======================================== */}

                <Route
                  path="/commandes"
                  element={<Commandes />}
                />

                {/* ========================================
                    FICHES DE CAISSE
                ======================================== */}

                <Route
                  path="/encaissements/fiches-caisse"
                  element={<FichesCaisse />}
                />

                {/* ========================================
                    ADMINISTRATION
                    VUE D'ENSEMBLE
                ======================================== */}

                <Route
                  path="/administration"
                  element={<Administration />}
                />

                {/* ========================================
                    ADMINISTRATION
                    UTILISATEURS
                ======================================== */}

                <Route
                  path="/administration/utilisateurs"
                  element={<Utilisateurs />}
                />

                {/* ========================================
                    ADMINISTRATION
                    RÔLES ET PERMISSIONS
                ======================================== */}

                <Route
                  path="/administration/roles"
                  element={<RolesPermissions />}
                />

                {/* ========================================
                    ADMINISTRATION
                    CAMPAGNES
                ======================================== */}

                <Route
                  path="/administration/campagnes"
                  element={<Campagnes />}
                />

                {/* ========================================
                    ADMINISTRATION
                    PARAMÈTRES GÉNÉRAUX
                ======================================== */}

                <Route
                  path="/administration/parametres"
                  element={<ParametresGeneraux />}
                />

                {/* ========================================
                    ADMINISTRATION
                    JOURNAL D'ACTIVITÉ — NOUVEAU
                ======================================== */}

                <Route
                  path="/administration/journal"
                  element={<JournalActivite />}
                />

                {/* ========================================
                    AUTRES RUBRIQUES ADMINISTRATION

                    Route provisoire pour les sections
                    qui n'ont pas encore de page dédiée.
                ======================================== */}

                <Route
                  path="/administration/:section"
                  element={<Administration />}
                />

              </Route>

            </Routes>

          </BrowserRouter>

        </GeneralSettingsProvider>

      </PermissionsProvider>

    </UsersProvider>
  )
}

export default App

{/* ==========================================
                  Attention ObDataProvider : je ne l'ai pas ajouté ici, car il doit rester à son emplacement actuel, là où il fournit déjà les données à Commandes et Donateurs. Il faut une seule instance qui englobe aussi la nouvelle page Campagnes.
              ========================================== */}
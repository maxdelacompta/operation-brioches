import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './App.css'

import Accueil from './pages/Accueil'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Communication from './pages/Communication'
import Comptabilite from './pages/Comptabilite'
import Etablissement from './pages/Etablissement'
import Bdd from './pages/Bdd'
import Donateurs from './pages/Donateurs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
      <Route element={<AppLayout />}>
      <Route path="/" element={<Accueil />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/communication" element={<Communication />} />
      <Route path="/comptabilite" element={<Comptabilite />} />
      <Route path="/etablissement" element={<Etablissement />} />
      <Route path="/bdd" element={<Bdd />} />
      <Route path="/donateurs" element={<Donateurs />} />
      </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App 

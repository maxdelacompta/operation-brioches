import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installAutomaticAudit } from './services/automaticAudit'

// Démarre la collecte avant le rendu et les sauvegardes des providers.
installAutomaticAudit()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

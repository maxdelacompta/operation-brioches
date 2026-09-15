import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'

import './index.css'

import {
  ObDataProvider,
} from './context/ObDataContext'

ReactDOM.createRoot(
  document.getElementById('root')!,
).render(
  <React.StrictMode>

    <ObDataProvider>

      <App />

    </ObDataProvider>

  </React.StrictMode>,
)

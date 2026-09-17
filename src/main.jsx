import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { registerGenesisServiceWorker } from './services/pushNotifications.js'

registerGenesisServiceWorker().catch((error) => {
  console.error(
    'Genesis service worker registration error:',
    error
  )
})

import { GenesisModeProvider } from './contexts/GenesisModeContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GenesisModeProvider>
      <App />
    </GenesisModeProvider>
  </React.StrictMode>,
)
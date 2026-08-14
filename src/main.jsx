import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { loadConfig } from './config'
import { loadGuidelines } from './data/guidelineFallback'
import App from './App'
import './styles/global.css'

// config.json decides which data source the adapters use, so it must land
// before anything renders. The guideline fallback rides along — it never
// fails the app, so a missing file just means no fallback text.
Promise.all([loadConfig(), loadGuidelines()]).then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
})

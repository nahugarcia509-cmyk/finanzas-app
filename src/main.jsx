import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PWAUpdatePrompt from './components/PWAUpdatePrompt.jsx'
import './styles.css'
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/><PWAUpdatePrompt/></ErrorBoundary></React.StrictMode>)

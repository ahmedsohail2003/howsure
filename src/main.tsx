import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { App } from './ui/App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('HowSure: #root is missing from index.html')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

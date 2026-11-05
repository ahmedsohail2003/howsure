import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { loadLook } from './store/look'
import { App } from './ui/App'
import { applyLook, BUILT_LOOKS } from './ui/looks'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('HowSure: #root is missing from index.html')

// The saved look is read and applied before the first render, so a reload never flashes the
// wrong look (build-out item 1.5.2).
const look = loadLook(BUILT_LOOKS)
applyLook(look)

createRoot(rootEl).render(
  <StrictMode>
    <App initialLook={look} />
  </StrictMode>,
)

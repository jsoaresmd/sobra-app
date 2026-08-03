import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { DadosProvider } from './contexts/DadosContext'
import { instalarTravasZoom } from './lib/viewportLock'
import './index.css'

instalarTravasZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DadosProvider>
        <App />
      </DadosProvider>
    </BrowserRouter>
  </StrictMode>,
)

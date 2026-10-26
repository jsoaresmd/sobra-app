import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { InstallPrompt } from './components/InstallPrompt'
import { useDados } from './contexts/DadosContext'
import { SemanaPage } from './pages/SemanaPage'
import { RevisarPage } from './pages/RevisarPage'
import { MesPage } from './pages/MesPage'
import { AjustesPage } from './pages/AjustesPage'

export function App() {
  const { pronto } = useDados()

  if (!pronto) {
    return (
      <div className="boot">
        <p>Carregando…</p>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<SemanaPage />} />
          <Route path="revisar" element={<RevisarPage />} />
          <Route path="mes" element={<MesPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </>
  )
}

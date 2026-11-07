import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { InstallPrompt } from './components/InstallPrompt'
import { useAuth } from './contexts/AuthContext'
import { useDados } from './contexts/DadosContext'
import { SemanaPage } from './pages/SemanaPage'
import { RevisarPage } from './pages/RevisarPage'
import { MesPage } from './pages/MesPage'
import { AjustesPage } from './pages/AjustesPage'
import { LoginPage } from './pages/LoginPage'

export function App() {
  const { pronto: authPronto, session } = useAuth()
  const { pronto } = useDados()

  if (!authPronto) {
    return (
      <div className="boot">
        <p>Carregando…</p>
      </div>
    )
  }

  if (!session) return <LoginPage />

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

import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppShell } from './components/AppShell'
import { InstallPrompt } from './components/InstallPrompt'
import { useDados } from './contexts/DadosContext'
import { HojePage } from './pages/HojePage'
import { MesPage } from './pages/MesPage'
import { EnvelopesPage } from './pages/EnvelopesPage'
import { ExtratoPage } from './pages/ExtratoPage'
import { LancarPage } from './pages/LancarPage'
import { AjustesPage } from './pages/AjustesPage'
import { OrcamentoPage } from './pages/OrcamentoPage'
import { ContasPage } from './pages/ContasPage'
import { FixosPage } from './pages/FixosPage'
import { BancosPage } from './pages/BancosPage'
import { EtiquetarPage } from './pages/EtiquetarPage'
import { OnboardingPage } from './pages/OnboardingPage'

const ImportarNubankPage = lazy(() =>
  import('./pages/ImportarNubankPage').then((m) => ({ default: m.ImportarNubankPage })),
)

export function App() {
  const { pronto, config } = useDados()

  if (!pronto) {
    return (
      <div className="boot">
        <p>Carregando…</p>
      </div>
    )
  }

  if (!config?.onboardingFeito) {
    return <OnboardingPage />
  }

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HojePage />} />
          <Route path="envelopes" element={<EnvelopesPage />} />
          <Route path="mes" element={<MesPage />} />
          <Route path="extrato" element={<ExtratoPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="ajustes/orcamento" element={<OrcamentoPage />} />
          <Route path="ajustes/contas" element={<ContasPage />} />
          <Route path="ajustes/fixos" element={<FixosPage />} />
          <Route path="ajustes/bancos" element={<BancosPage />} />
          <Route path="ajustes/etiquetar" element={<EtiquetarPage />} />
          <Route
            path="ajustes/importar-nubank"
            element={
              <Suspense fallback={<p className="muted small">Carregando importação…</p>}>
                <ImportarNubankPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="/lancar" element={<LancarPage />} />
        <Route path="/lancar/:id" element={<LancarPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </>
  )
}

import { useEffect, useMemo, type ReactElement } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

type TabDef = {
  to: string
  label: string
  icon: ReactElement
  end?: boolean
}

const HojeIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 21a8 8 0 1 0-8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const EnvelopeIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path d="M4 8l8 5 8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ExtratoIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 5h14M5 12h14M5 19h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const AjustesIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

const TABS: TabDef[] = [
  { to: '/', label: 'Hoje', icon: HojeIcon, end: true },
  { to: '/envelopes', label: 'Envelopes', icon: EnvelopeIcon },
  { to: '/extrato', label: 'Extrato', icon: ExtratoIcon },
  { to: '/ajustes', label: 'Ajustes', icon: AjustesIcon },
]

function pageFromPath(pathname: string) {
  if (pathname.startsWith('/envelopes') || pathname.startsWith('/mes')) return 'envelopes'
  if (pathname.startsWith('/extrato')) return 'extrato'
  if (pathname.startsWith('/ajustes')) return 'ajustes'
  return 'hoje'
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const page = useMemo(() => pageFromPath(location.pathname), [location.pathname])

  useEffect(() => {
    document.documentElement.dataset.page = page
    return () => {
      delete document.documentElement.dataset.page
    }
  }, [page])

  return (
    <div className="app-shell" data-page={page}>
      <main className="page">
        <Outlet />
      </main>

      <button
        type="button"
        className="fab"
        onClick={() => navigate('/lancar')}
        aria-label="Corrigir ou lançar manualmente"
        title="Correção manual"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <nav className="tabbar" aria-label="Navegação principal">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { diagnosticoPluggy } from '../lib/pluggyClient'

/** Mostra, cru, o que a Pluggy devolve — para conferir os números do app contra a fonte. */
export function DiagnosticoPage() {
  const navigate = useNavigate()
  const { config } = useDados()
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [json, setJson] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const itemIds = config?.pluggyItemIds ?? []

  const rodar = async () => {
    setBusy(true)
    setErro(null)
    setJson(null)
    try {
      const dados = await diagnosticoPluggy(itemIds, 45)
      setJson(JSON.stringify(dados, null, 2))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou.')
    } finally {
      setBusy(false)
    }
  }

  const copiar = async () => {
    if (!json) return
    await navigator.clipboard.writeText(json)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ bancos
        </button>
        <h1>Diagnóstico</h1>
      </header>

      <section className="panel stack">
        {itemIds.length === 0 ? (
          <p className="muted small">Nenhum banco conectado.</p>
        ) : (
          <button type="button" className="primary-btn" disabled={busy} onClick={() => void rodar()}>
            {busy ? 'Consultando…' : 'Ver o que o banco envia'}
          </button>
        )}
        {erro && <p className="error">{erro}</p>}
        {json && (
          <button type="button" className="mini-btn" onClick={() => void copiar()}>
            {copiado ? 'copiado' : 'copiar tudo'}
          </button>
        )}
      </section>

      {json && (
        <section className="panel">
          <pre className="diagnostico">{json}</pre>
        </section>
      )}
    </div>
  )
}

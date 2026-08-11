import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { db } from '../lib/db'
import { diagnosticoPluggy, itensInexistentes, removerItensPluggy } from '../lib/pluggyClient'

/** Mostra, cru, o que a Pluggy devolve — para conferir os números do app contra a fonte. */
export function DiagnosticoPage() {
  const navigate = useNavigate()
  const { config } = useDados()
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [json, setJson] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [mortos, setMortos] = useState<string[]>([])

  const itemIds = config?.pluggyItemIds ?? []

  const rodar = async () => {
    setBusy(true)
    setErro(null)
    setJson(null)
    setMortos([])
    try {
      const dados = await diagnosticoPluggy(itemIds, 45)
      setJson(JSON.stringify(dados, null, 2))

      const falhos = Array.isArray((dados as { itens?: unknown }).itens)
        ? ((dados as { itens: Array<{ itemId?: string; falhou?: string }> }).itens
            .filter((i) => i.falhou && /ITEM_NOT_FOUND|404/i.test(i.falhou))
            .map((i) => i.itemId)
            .filter((id): id is string => Boolean(id)))
        : []
      if (falhos.length > 0) {
        setMortos(falhos)
        setErro('Há conexão que a Pluggy não reconhece nesta aplicação.')
      }
    } catch (e) {
      const semItem = itensInexistentes(e, itemIds)
      setMortos(semItem)
      setErro(
        semItem.length > 0
          ? 'Essa conexão não existe mais na Pluggy.'
          : e instanceof Error
            ? e.message
            : 'Falhou.',
      )
    } finally {
      setBusy(false)
    }
  }

  const limparMortos = async () => {
    try {
      await removerItensPluggy(mortos)
    } catch {
      // Sair daqui já basta para reconectar.
    }
    await db.config.update('app', {
      pluggyItemIds: itemIds.filter((id) => !mortos.includes(id)),
      pluggyUltimaSync: '',
    })
    setMortos([])
    setErro(null)
    setJson(null)
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
          <p className="muted small">Nenhum banco conectado. Em Bancos, toque em Conectar banco.</p>
        ) : (
          <>
            <p className="muted small id-conexao">{itemIds.join(' · ')}</p>
            <button type="button" className="primary-btn" disabled={busy} onClick={() => void rodar()}>
              {busy ? 'Consultando…' : 'Ver o que o banco envia'}
            </button>
          </>
        )}
        {erro && <p className="error">{erro}</p>}
        {mortos.length > 0 && (
          <>
            <button type="button" className="primary-btn" onClick={() => void limparMortos()}>
              Remover conexão quebrada
            </button>
            <Link to="/ajustes/bancos" className="cta">
              depois, Conectar de novo →
            </Link>
          </>
        )}
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

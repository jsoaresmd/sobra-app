import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { atualizarLancamento } from '../lib/acoes'
import { formatBRL, formatBRLCurto } from '../lib/money'
import { chaveEstabelecimento, nomeSemParcela } from '../lib/merchant'
import { salvarRegraImportacao } from '../lib/regrasImportacao'
import type { Lancamento } from '../lib/types'

type GrupoEtiqueta = {
  chave: string
  nome: string
  lancamentos: Lancamento[]
  total: number
}

function ehSemEtiqueta(l: Lancamento) {
  return l.origem === 'importado' && l.tipo === 'despesa' && !l.envelopeId
}

export function EtiquetarPage() {
  const navigate = useNavigate()
  const { lancamentos, envelopes, hoje } = useDados()
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [busyChave, setBusyChave] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const envelopesAtivos = useMemo(
    () => envelopes.filter((e) => !e.arquivado && e.tipo !== 'investimento'),
    [envelopes],
  )

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoEtiqueta>()
    for (const l of lancamentos) {
      if (!ehSemEtiqueta(l)) continue
      const nome = nomeSemParcela(l.descricao || 'Sem descrição')
      const chave = chaveEstabelecimento(nome) || `id:${l.id}`
      const grupo = mapa.get(chave)
      if (grupo) {
        grupo.lancamentos.push(l)
        grupo.total += l.valor
      } else {
        mapa.set(chave, { chave, nome, lancamentos: [l], total: l.valor })
      }
    }
    return [...mapa.values()].sort((a, b) => b.lancamentos.length - a.lancamentos.length || b.total - a.total)
  }, [lancamentos])

  const totalItens = grupos.reduce((s, g) => s + g.lancamentos.length, 0)

  const aplicarGrupo = async (grupo: GrupoEtiqueta) => {
    const envelopeId = escolhas[grupo.chave]
    if (!envelopeId) {
      setErro('Escolha um envelope antes de aplicar.')
      return
    }
    const envelope = envelopesAtivos.find((e) => e.id === envelopeId)
    if (!envelope) return

    setBusyChave(grupo.chave)
    setErro(null)
    setMsg(null)
    try {
      for (const l of grupo.lancamentos) {
        await atualizarLancamento(
          l.id,
          {
            envelopeId: envelope.id,
            categoriaId: envelope.categoriaId ?? l.categoriaId,
          },
          hoje,
        )
      }
      await salvarRegraImportacao(
        grupo.chave,
        grupo.nome,
        envelope.id,
        envelope.categoriaId,
      )
      setMsg(
        `${grupo.nome}: ${grupo.lancamentos.length} lançamento${grupo.lancamentos.length === 1 ? '' : 's'} → ${envelope.nome}. Próximas syncs já caem sozinhas.`,
      )
      setEscolhas((prev) => {
        const next = { ...prev }
        delete next[grupo.chave]
        return next
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui aplicar a etiqueta.')
    } finally {
      setBusyChave(null)
    }
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ voltar
        </button>
        <h1>Etiquetar gastos</h1>
        <p className="muted small">
          Escolha o envelope uma vez por estabelecimento. Todos os lançamentos iguais recebem a etiqueta e o app
          lembra nas próximas sincronizações.
        </p>
      </header>

      <section className="stat-grid">
        <div className="stat">
          <span className="stat-num">{grupos.length}</span>
          <span className="stat-lbl">estabelecimentos</span>
        </div>
        <div className="stat">
          <span className="stat-num">{totalItens}</span>
          <span className="stat-lbl">sem etiqueta</span>
        </div>
      </section>

      {msg && <p className="ok">{msg}</p>}
      {erro && <p className="error">{erro}</p>}

      {grupos.length === 0 ? (
        <section className="panel">
          <p className="muted small">Nada pendente. Todos os gastos importados já têm envelope.</p>
          <Link to="/ajustes/bancos" className="cta">
            voltar aos bancos
          </Link>
        </section>
      ) : (
        <ul className="lista-import">
          {grupos.map((grupo) => {
            const envelopeId = escolhas[grupo.chave] ?? ''
            const ocupado = busyChave === grupo.chave
            return (
              <li key={grupo.chave} className="import-card">
                <div className="row-between">
                  <strong>{grupo.nome}</strong>
                  <span className="muted small">{formatBRL(grupo.total)}</span>
                </div>
                <p className="muted small">
                  {grupo.lancamentos.length} lançamento{grupo.lancamentos.length === 1 ? '' : 's'} · ex.:{' '}
                  {formatBRLCurto(grupo.lancamentos[0]?.valor ?? 0)}
                </p>
                <div className="import-acoes etiquetar-acoes">
                  <select
                    value={envelopeId}
                    disabled={ocupado}
                    onChange={(e) =>
                      setEscolhas((prev) => ({ ...prev, [grupo.chave]: e.target.value }))
                    }
                  >
                    <option value="">Escolher envelope…</option>
                    {envelopesAtivos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={!envelopeId || ocupado}
                    onClick={() => void aplicarGrupo(grupo)}
                  >
                    {ocupado ? 'aplicando…' : `aplicar nos ${grupo.lancamentos.length}`}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

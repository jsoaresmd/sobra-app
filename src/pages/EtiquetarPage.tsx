import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { atualizarLancamento } from '../lib/acoes'
import { formatBRL, formatBRLCurto } from '../lib/money'
import { chaveEstabelecimento, nomeSemParcela } from '../lib/merchant'
import { salvarRegraImportacao } from '../lib/regrasImportacao'
import { formatarDiaCurto } from '../lib/dates'
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

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

export function EtiquetarPage() {
  const navigate = useNavigate()
  const { lancamentos, envelopes, contas, hoje } = useDados()
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [busyChave, setBusyChave] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const envelopesAtivos = useMemo(
    () => envelopes.filter((e) => !e.arquivado && e.tipo !== 'investimento'),
    [envelopes],
  )

  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)

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
    for (const g of mapa.values()) {
      g.lancamentos.sort((a, b) =>
        b.data === a.data ? (b.hora ?? '').localeCompare(a.hora ?? '') : b.data.localeCompare(a.data),
      )
    }
    return [...mapa.values()].sort((a, b) => b.lancamentos.length - a.lancamentos.length || b.total - a.total)
  }, [lancamentos])

  const totalItens = grupos.reduce((s, g) => s + g.lancamentos.length, 0)
  const totalValor = grupos.reduce((s, g) => s + g.total, 0)

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
      await salvarRegraImportacao(grupo.chave, grupo.nome, envelope.id, envelope.categoriaId)
      setMsg(
        `${grupo.nome}: ${grupo.lancamentos.length} → ${envelope.nome}. Próximas syncs já caem sozinhas.`,
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
      </header>

      <section className="stat-grid tres">
        <div className="stat">
          <span className="stat-num">{grupos.length}</span>
          <span className="stat-lbl">lugares</span>
        </div>
        <div className="stat">
          <span className="stat-num">{totalItens}</span>
          <span className="stat-lbl">sem etiqueta</span>
        </div>
        <div className="stat">
          <span className="stat-num">{formatBRLCurto(totalValor)}</span>
          <span className="stat-lbl">no total</span>
        </div>
      </section>

      {msg && <p className="ok">{msg}</p>}
      {erro && <p className="error">{erro}</p>}

      {grupos.length === 0 ? (
        <section className="panel">
          <p className="muted small">Nada pendente.</p>
          <Link to="/ajustes/bancos" className="cta">
            voltar aos bancos
          </Link>
        </section>
      ) : (
        <ul className="lista-etiquetar">
          {grupos.map((grupo) => {
            const envelopeId = escolhas[grupo.chave] ?? ''
            const envelope = envelopesAtivos.find((e) => e.id === envelopeId)
            const ocupado = busyChave === grupo.chave
            const expandido = abertos[grupo.chave] ?? grupo.lancamentos.length <= 3
            const visiveis = expandido ? grupo.lancamentos : grupo.lancamentos.slice(0, 3)
            const primeiro = grupo.lancamentos[0]
            const ultimo = grupo.lancamentos[grupo.lancamentos.length - 1]

            return (
              <li key={grupo.chave} className="etiqueta-card">
                <div className="etiqueta-topo">
                  <span className="etiqueta-avatar" aria-hidden="true">
                    {iniciais(grupo.nome)}
                  </span>
                  <div className="etiqueta-titulo">
                    <strong>{grupo.nome}</strong>
                    <span className="etiqueta-meta">
                      {grupo.lancamentos.length}× · {formatarDiaCurto(ultimo.data)}
                      {grupo.lancamentos.length > 1 ? ` → ${formatarDiaCurto(primeiro.data)}` : ''}
                    </span>
                  </div>
                  <div className="etiqueta-total">
                    <span className="etiqueta-total-valor">{formatBRL(grupo.total)}</span>
                    <span className="etiqueta-total-lbl">soma</span>
                  </div>
                </div>

                <ul className="etiqueta-ocorrencias">
                  {visiveis.map((l) => {
                    const conta = nomeConta(l.contaId)
                    return (
                      <li key={l.id}>
                        <span className="etiqueta-quando">
                          <strong>{formatarDiaCurto(l.data)}</strong>
                          {l.hora ? <em>{l.hora}</em> : null}
                        </span>
                        <span className="etiqueta-onde">
                          {conta ? (
                            <>
                              <span className="conta-bolinha" style={{ background: conta.cor }} aria-hidden="true" />
                              {conta.nome}
                              <em>· {conta.tipo === 'credito' ? 'crédito' : conta.tipo === 'debito' ? 'débito' : conta.tipo}</em>
                            </>
                          ) : (
                            <em>sem conta</em>
                          )}
                          {l.totalParcelas ? (
                            <em>
                              · {l.parcela}/{l.totalParcelas}
                            </em>
                          ) : null}
                        </span>
                        <span className="etiqueta-valor">− {formatBRL(l.valor)}</span>
                      </li>
                    )
                  })}
                </ul>

                {grupo.lancamentos.length > 3 && (
                  <button
                    type="button"
                    className="link-btn etiqueta-mais"
                    onClick={() => setAbertos((prev) => ({ ...prev, [grupo.chave]: !expandido }))}
                  >
                    {expandido
                      ? 'mostrar menos'
                      : `ver mais ${grupo.lancamentos.length - 3} ocorrência${grupo.lancamentos.length - 3 === 1 ? '' : 's'}`}
                  </button>
                )}

                <div className="etiqueta-rodape">
                  <label className="etiqueta-campo">
                    <span>Etiqueta (envelope)</span>
                    <select
                      value={envelopeId}
                      disabled={ocupado}
                      onChange={(e) => setEscolhas((prev) => ({ ...prev, [grupo.chave]: e.target.value }))}
                    >
                      <option value="">Escolher…</option>
                      {envelopesAtivos.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  {envelope && (
                    <p className="etiqueta-preview">
                      Vai para <strong>{envelope.nome}</strong>
                      {grupo.lancamentos.length > 1
                        ? ` · ${grupo.lancamentos.length} gastos iguais`
                        : ' · 1 gasto'}
                    </p>
                  )}

                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!envelopeId || ocupado}
                    onClick={() => void aplicarGrupo(grupo)}
                  >
                    {ocupado
                      ? 'Aplicando…'
                      : `Aplicar etiqueta${grupo.lancamentos.length > 1 ? ` nos ${grupo.lancamentos.length}` : ''}`}
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

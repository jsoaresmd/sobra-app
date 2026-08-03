import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { SeletorCiclo } from '../components/SeletorCiclo'
import { SaldoReal } from '../components/SaldoReal'
import { TermometroCartao } from '../components/TermometroCartao'
import { formatBRL, formatBRLCurto } from '../lib/money'
import { formatarCurto, formatarDia } from '../lib/dates'
import { ROTULO_STATUS } from '../lib/budget'
import { confirmarRecorrente } from '../lib/acoes'
import { db } from '../lib/db'
import { sincronizarBancosAbertos } from '../lib/sincronizarBancos'

export function HojePage() {
  const { resumo, config, categorias, contas, lancamentos, termometros, recorrentes, envelopes, hoje } =
    useDados()
  const regras = useLiveQuery(() => db.regrasImportacao.toArray(), [], [])
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncErro, setSyncErro] = useState<string | null>(null)

  if (!resumo) return null

  const conectado = (config?.pluggyItemIds?.length ?? 0) > 0
  const usado = resumo.teto > 0 ? Math.min(1, resumo.comprometido / resumo.teto) : 0
  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)
  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)

  const ultimos = [...lancamentos]
    .filter((l) => l.data <= hoje)
    .sort((a, b) => (b.data === a.data ? b.criadoEm.localeCompare(a.criadoEm) : b.data.localeCompare(a.data)))
    .slice(0, 5)

  const sincronizar = async () => {
    if (!config) return
    setSyncBusy(true)
    setSyncMsg(null)
    setSyncErro(null)
    try {
      const r = await sincronizarBancosAbertos(config, envelopes, regras, hoje, categorias)
      setSyncMsg(`${r.contas} contas · ${r.novas} novo${r.novas === 1 ? '' : 's'}`)
    } catch (e) {
      setSyncErro(e instanceof Error ? e.message : 'Falha ao sincronizar.')
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Controle em tempo real</p>
        <SeletorCiclo />
      </header>

      <section className="panel stack sync-panel">
        {conectado ? (
          <button type="button" className="primary-btn" disabled={syncBusy} onClick={() => void sincronizar()}>
            {syncBusy ? 'Sincronizando…' : 'Sincronizar bancos'}
          </button>
        ) : (
          <Link to="/ajustes/bancos" className="primary-btn sync-link">
            Conectar bancos
          </Link>
        )}
        {syncMsg && <p className="ok">{syncMsg}</p>}
        {syncErro && <p className="error">{syncErro}</p>}
        {lancamentos.some((l) => l.origem === 'importado' && l.tipo === 'despesa' && !l.envelopeId) && (
          <Link to="/ajustes/etiquetar" className="cta">
            Etiquetar gastos sem envelope →
          </Link>
        )}
      </section>

      <SaldoReal />

      {termometros.map((t) => (
        <TermometroCartao key={t.fatura.conta.id} termometro={t} />
      ))}

      <section className="panel">
        <div className="row-between">
          <h2>Orçamento do período</h2>
          <Link to="/envelopes" className="cta">
            envelopes
          </Link>
        </div>
        <div className="row-between">
          <span className="muted small">
            {resumo.disponivel >= 0 ? 'ainda dá para gastar' : 'acima do orçamento em'}
          </span>
          <strong className={`orcamento-num ${resumo.disponivel < 0 ? 'negativo' : ''}`}>
            {formatBRL(Math.abs(resumo.disponivel))}
          </strong>
        </div>
        <div className="cat-track" aria-hidden="true">
          <span className={`cat-fill status-${resumo.status}`} style={{ width: `${usado * 100}%` }} />
        </div>
        <div className="row-between small muted">
          <span>{formatBRLCurto(resumo.comprometido)} comprometido</span>
          <span>de {formatBRLCurto(resumo.teto)}</span>
        </div>
        <p className="muted small">
          {ROTULO_STATUS[resumo.status]} · projeção de {formatBRL(resumo.projecao)} até {formatarCurto(resumo.ciclo.fim)}
        </p>
      </section>

      <section className="stat-grid tres">
        <div className="stat">
          <span className="stat-num">{formatBRLCurto(resumo.gastoRealizado)}</span>
          <span className="stat-lbl">já saiu</span>
        </div>
        <div className="stat">
          <span className="stat-num">{formatBRLCurto(resumo.aindaVaiCair)}</span>
          <span className="stat-lbl">ainda vai cair</span>
        </div>
        <div className="stat">
          <span className="stat-num">{formatBRLCurto(resumo.fixos)}</span>
          <span className="stat-lbl">contas fixas</span>
        </div>
      </section>

      {resumo.previstos.length > 0 && (
        <section className="panel">
          <div className="row-between">
            <h2>Ainda vai cair</h2>
            <span className="muted small">{formatBRL(resumo.aindaVaiCair)}</span>
          </div>
          <ul className="lista-previstos">
            {resumo.previstos.slice(0, 6).map((previsto) => {
              const categoria = nomeCategoria(previsto.categoriaId)
              const recorrente = recorrentes.find((r) => r.id === previsto.id)
              return (
                <li key={`${previsto.origem}-${previsto.id}`} className={previsto.atrasado ? 'atrasado' : ''}>
                  <span className="previsto-emoji">{categoria?.emoji ?? '📌'}</span>
                  <span className="previsto-info">
                    <strong>{previsto.descricao}</strong>
                    <span className="muted small">
                      {previsto.atrasado ? 'previsto para ' : ''}
                      {formatarDia(previsto.data)}
                      {previsto.origem === 'recorrente' ? ' · fixo' : ' · agendado'}
                    </span>
                  </span>
                  <span className="previsto-valor">{formatBRL(previsto.valor)}</span>
                  {recorrente && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => void confirmarRecorrente(recorrente, previsto.data, envelopes)}
                    >
                      caiu
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="row-between">
          <h2>Últimos lançamentos</h2>
          <Link to="/extrato" className="cta">
            ver tudo
          </Link>
        </div>
        {ultimos.length === 0 ? (
          <p className="muted small">Nenhum lançamento.</p>
        ) : (
          <ul className="lista-lancamentos">
            {ultimos.map((l) => {
              const categoria = nomeCategoria(l.categoriaId)
              const conta = nomeConta(l.contaId)
              return (
                <li key={l.id}>
                  <span className="previsto-emoji">{categoria?.emoji ?? '💸'}</span>
                  <span className="previsto-info">
                    <strong>{l.descricao || categoria?.nome || 'Lançamento'}</strong>
                    <span className="muted small">
                      {formatarCurto(l.data)}
                      {conta ? ` · ${conta.nome}` : ''}
                      {l.totalParcelas ? ` · ${l.parcela}/${l.totalParcelas}` : ''}
                    </span>
                  </span>
                  <span className={`previsto-valor ${l.tipo === 'receita' ? 'receita' : ''}`}>
                    {l.tipo === 'receita' ? '+' : '−'} {formatBRL(l.valor)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { CartaoResumo } from '../components/CartaoResumo'
import { formatBRL } from '../lib/money'
import { dentroDo, formatarCurto } from '../lib/dates'
import { db } from '../lib/db'
import { sincronizarBancosAbertos } from '../lib/sincronizarBancos'
import { ROTULO_TIPO_ENVELOPE } from '../lib/envelopes'

export function HojePage() {
  const { resumo, config, lancamentos, faturas, envelopes, hoje, categorias, caixa } = useDados()
  const regras = useLiveQuery(() => db.regrasImportacao.toArray(), [], [])
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncErro, setSyncErro] = useState<string | null>(null)

  const gastoPorEnvelope = useMemo(() => {
    const mapa = new Map<string, number>()
    if (!resumo) return mapa
    for (const l of lancamentos) {
      if (l.tipo !== 'despesa' || !l.envelopeId) continue
      if (l.data > hoje) continue
      if (!dentroDo(resumo.ciclo, l.data)) continue
      mapa.set(l.envelopeId, (mapa.get(l.envelopeId) ?? 0) + l.valor)
    }
    return mapa
  }, [lancamentos, resumo, hoje])

  if (!resumo) return null

  const conectado = (config?.pluggyItemIds?.length ?? 0) > 0
  const ativos = envelopes.filter((e) => !e.arquivado && e.tipo !== 'investimento')
  const planejamento = ativos.filter((e) => e.tipo === 'variavel')
  const fixos = ativos.filter((e) => e.tipo === 'fixo')
  const semEtiqueta = lancamentos.some(
    (l) => l.origem === 'importado' && l.tipo === 'despesa' && !l.envelopeId && l.data <= hoje,
  )

  const card = (envelope: (typeof ativos)[0]) => {
    const gasto = gastoPorEnvelope.get(envelope.id) ?? 0
    const orcamento = envelope.valorMensal
    const sobra = orcamento - gasto
    const estourado = orcamento > 0 ? sobra < 0 : false
    if (orcamento <= 0 && gasto <= 0) return null
    return (
      <li key={envelope.id}>
        <Link to={`/envelopes/${envelope.id}`} className="lancamento-link">
          <span className="previsto-emoji">{envelope.emoji}</span>
          <span className="previsto-info">
            <strong>{envelope.nome}</strong>
            <span className="muted small">
              {orcamento > 0
                ? estourado
                  ? `passou ${formatBRL(Math.abs(sobra))}`
                  : `sobra ${formatBRL(sobra)}`
                : `gasto ${formatBRL(gasto)}`}
            </span>
          </span>
          <span className={`previsto-valor ${estourado ? '' : 'receita'}`}>{formatBRL(gasto)}</span>
        </Link>
      </li>
    )
  }

  const sincronizar = async () => {
    if (!config) return
    setSyncBusy(true)
    setSyncMsg(null)
    setSyncErro(null)
    try {
      const r = await sincronizarBancosAbertos(config, envelopes, regras, hoje, categorias, {
        forcarCompleto: true,
      })
      const partes = [`${r.novas} novo${r.novas === 1 ? '' : 's'}`]
      if (r.corrigidas) partes.push(`${r.corrigidas} corrigido${r.corrigidas === 1 ? '' : 's'}`)
      if (r.semEtiqueta) partes.push(`${r.semEtiqueta} sem área`)
      setSyncMsg(partes.join(' · '))
    } catch (e) {
      setSyncErro(e instanceof Error ? e.message : 'Falha ao sincronizar.')
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Sobra</p>
        <h1>Quanto posso gastar</h1>
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
        {semEtiqueta && (
          <Link to="/ajustes/etiquetar" className="cta">
            Etiquetar gastos sem área →
          </Link>
        )}
      </section>

      {caixa && (
        <section className="panel stack resumo-panel">
          <div className="row-between">
            <h2>Sobra até {formatarCurto(caixa.proximoSalario)}</h2>
            <span className="muted small">{caixa.diasAteSalario} dias</span>
          </div>
          <p className={`hero-num ${caixa.sobraReal < 0 ? '' : 'poupanca'}`}>{formatBRL(caixa.sobraReal)}</p>
          <hr />
          <p className="linha-resumo">
            <span>Dinheiro nas contas</span>
            <strong>{formatBRL(caixa.saldoBanco)}</strong>
          </p>
          {caixa.compromissos.map((c) => (
            <p className="linha-resumo" key={c.id}>
              <span>{c.descricao}</span>
              <strong>−{formatBRL(c.valor)}</strong>
            </p>
          ))}
          {caixa.parcelasFuturas > 0 && (
            <p className="muted small">
              Parcelas de faturas seguintes: {formatBRL(caixa.parcelasFuturas)} — não entram nesta conta.
            </p>
          )}
        </section>
      )}

      {faturas.map((f) => (
        <CartaoResumo key={f.conta.id} fatura={f} />
      ))}

      <section className="panel">
        <div className="row-between">
          <h2>Planejamento</h2>
          <Link to="/envelopes" className="cta">
            ver tudo
          </Link>
        </div>
        <ul className="lista-lancamentos">{planejamento.map(card).filter(Boolean)}</ul>
        {planejamento.every((e) => (gastoPorEnvelope.get(e.id) ?? 0) === 0 && e.valorMensal <= 0) && (
          <p className="muted small">
            Defina orçamentos em{' '}
            <Link to="/envelopes" className="cta">
              Envelopes
            </Link>
            .
          </p>
        )}
      </section>

      <section className="panel">
        <div className="row-between">
          <h2>Contas fixas</h2>
          <span className="muted small">{ROTULO_TIPO_ENVELOPE.fixo}</span>
        </div>
        <ul className="lista-lancamentos">{fixos.map(card).filter(Boolean)}</ul>
        {fixos.every((e) => (gastoPorEnvelope.get(e.id) ?? 0) === 0 && e.valorMensal <= 0) && (
          <p className="muted small">Nenhuma conta fixa com movimento neste período.</p>
        )}
      </section>
    </div>
  )
}

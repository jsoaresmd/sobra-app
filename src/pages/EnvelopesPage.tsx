import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db, novoId } from '../lib/db'
import { ROTULO_TIPO_ENVELOPE } from '../lib/envelopes'
import { formatBRL } from '../lib/money'
import { dentroDo } from '../lib/dates'
import type { Envelope, TipoEnvelope } from '../lib/types'

const CORES = ['#2f9e6e', '#e8734a', '#3f7ec4', '#8a6cc4', '#d4557f', '#c9821f', '#6f7ce0', '#14855f']

export function EnvelopesPage() {
  const { envelopes, resumo, categorias, recorrentes, lancamentos, hoje } = useDados()
  const [editandoValores, setEditandoValores] = useState(false)

  const ativos = useMemo(() => envelopes.filter((e) => !e.arquivado), [envelopes])
  const fixos = ativos.filter((e) => e.tipo === 'fixo')
  const variaveis = ativos.filter((e) => e.tipo === 'variavel')
  const investimentos = ativos.filter((e) => e.tipo === 'investimento')

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

  const totalOrcamento = ativos.filter((e) => e.tipo !== 'investimento').reduce((s, e) => s + e.valorMensal, 0)
  const totalGasto = ativos
    .filter((e) => e.tipo !== 'investimento')
    .reduce((s, e) => s + (gastoPorEnvelope.get(e.id) ?? 0), 0)

  const atualizar = (id: string, mudancas: Partial<Envelope>) => {
    void db.envelopes.update(id, mudancas)
  }

  const novoEnvelope = (tipo: TipoEnvelope) => {
    const nome = prompt(tipo === 'investimento' ? 'Nome do envelope de investimento' : 'Nome do envelope')?.trim()
    if (!nome) return
    const emoji = prompt('Emoji', tipo === 'investimento' ? '📈' : tipo === 'fixo' ? '📌' : '✉️')?.trim() || '✉️'
    const envelope: Envelope = {
      id: novoId(),
      nome,
      emoji,
      cor: CORES[ativos.length % CORES.length],
      tipo,
      valorMensal: 0,
      saldo: 0,
      cicloAlocado: resumo?.ciclo.inicio ?? null,
      categoriaId: null,
      recorrenteId: null,
      ordem: ativos.length,
    }
    void db.envelopes.put(envelope)
  }

  const renderCard = (envelope: Envelope) => {
    if (envelope.tipo === 'investimento') {
      return (
        <li key={envelope.id} className="envelope-card tipo-investimento">
          <Link to={`/envelopes/${envelope.id}`} className="envelope-link">
            <div className="envelope-topo">
              <span className="envelope-emoji" aria-hidden="true">
                {envelope.emoji}
              </span>
              <div className="envelope-info">
                <strong>{envelope.nome}</strong>
                <span className="muted small">{ROTULO_TIPO_ENVELOPE.investimento}</span>
              </div>
              <div className="envelope-saldo">
                <strong>{formatBRL(envelope.saldo)}</strong>
                <span className="muted small">acumulado</span>
              </div>
            </div>
          </Link>
          {editandoValores && (
            <div className="envelope-edicao">
              <button type="button" className="mini-btn" onClick={() => atualizar(envelope.id, { arquivado: true })}>
                ocultar
              </button>
            </div>
          )}
        </li>
      )
    }

    const gasto = gastoPorEnvelope.get(envelope.id) ?? 0
    const orcamento = envelope.valorMensal
    const sobra = orcamento - gasto
    const estourado = orcamento > 0 ? sobra < 0 : gasto > 0
    const percentual = orcamento > 0 ? Math.min(1, gasto / orcamento) : gasto > 0 ? 1 : 0

    return (
      <li key={envelope.id} className={`envelope-card ${estourado ? 'estourado' : ''} tipo-${envelope.tipo}`}>
        <Link to={`/envelopes/${envelope.id}`} className="envelope-link">
          <div className="envelope-topo">
            <span className="envelope-emoji" aria-hidden="true">
              {envelope.emoji}
            </span>
            <div className="envelope-info">
              <strong>{envelope.nome}</strong>
              <span className="muted small">{ROTULO_TIPO_ENVELOPE[envelope.tipo]}</span>
            </div>
            <div className="envelope-saldo">
              <strong className={estourado ? 'negativo' : ''}>{formatBRL(gasto)}</strong>
              <span className="muted small">gasto</span>
            </div>
          </div>

          {orcamento > 0 ? (
            <>
              <div className="cat-track" aria-hidden="true">
                <span
                  className="cat-fill"
                  style={{
                    width: `${percentual * 100}%`,
                    background: estourado ? 'var(--danger)' : envelope.cor,
                  }}
                />
              </div>
              <div className="row-between small">
                <span className={`muted small ${estourado ? 'negativo' : ''}`}>
                  {estourado ? `passou ${formatBRL(Math.abs(sobra))}` : `sobra ${formatBRL(sobra)}`}
                </span>
                <span className="muted small">orçamento {formatBRL(orcamento)}</span>
              </div>
            </>
          ) : (
            gasto > 0 && <p className="muted small">Sem orçamento definido.</p>
          )}
        </Link>

        {editandoValores && (
          <div className="envelope-edicao">
            <label>
              Orçamento do mês
              <CampoMoeda valor={envelope.valorMensal} onChange={(v) => atualizar(envelope.id, { valorMensal: v })} />
            </label>
            <label>
              Ligado à categoria
              <select
                value={envelope.categoriaId ?? ''}
                onChange={(e) => atualizar(envelope.id, { categoriaId: e.target.value || null })}
              >
                <option value="">Nenhuma</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.nome}
                  </option>
                ))}
              </select>
            </label>
            {envelope.tipo === 'fixo' && (
              <label>
                Ligado à conta fixa
                <select
                  value={envelope.recorrenteId ?? ''}
                  onChange={(e) => atualizar(envelope.id, { recorrenteId: e.target.value || null })}
                >
                  <option value="">Nenhuma</option>
                  {recorrentes
                    .filter((r) => r.ativo && r.tipo === 'despesa')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.descricao}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button type="button" className="mini-btn" onClick={() => atualizar(envelope.id, { arquivado: true })}>
              ocultar
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Envelopes</p>
        <h1>Envelopes</h1>
      </header>

      <section className="panel resumo-panel">
        <div className="linha-resumo destaque">
          <span>Gasto</span>
          <strong>{formatBRL(totalGasto)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Orçamento</span>
          <strong>{formatBRL(totalOrcamento)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Sobra</span>
          <strong className={totalOrcamento - totalGasto < 0 ? 'negativo' : ''}>
            {formatBRL(totalOrcamento - totalGasto)}
          </strong>
        </div>
      </section>

      <button type="button" className="secondary-btn" onClick={() => setEditandoValores((v) => !v)}>
        {editandoValores ? 'Fechar' : 'Definir orçamentos'}
      </button>

      {fixos.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Contas fixas</h2>
          <ul className="lista-envelopes">{fixos.map(renderCard)}</ul>
        </section>
      )}

      {variaveis.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Planejamento</h2>
          <ul className="lista-envelopes">{variaveis.map(renderCard)}</ul>
        </section>
      )}

      {investimentos.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Investimentos</h2>
          <ul className="lista-envelopes">{investimentos.map(renderCard)}</ul>
        </section>
      )}

      <div className="envelope-acoes">
        <button type="button" className="secondary-btn" onClick={() => novoEnvelope('fixo')}>
          + envelope fixo
        </button>
        <button type="button" className="secondary-btn" onClick={() => novoEnvelope('variavel')}>
          + envelope variável
        </button>
      </div>
    </div>
  )
}

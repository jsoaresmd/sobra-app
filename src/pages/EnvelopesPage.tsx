import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db, novoId } from '../lib/db'
import { depositarCiclo, transferirEntreEnvelopes, ROTULO_TIPO_ENVELOPE } from '../lib/envelopes'
import { formatBRL } from '../lib/money'
import type { Envelope, TipoEnvelope } from '../lib/types'

const CORES = ['#2f9e6e', '#e8734a', '#3f7ec4', '#8a6cc4', '#d4557f', '#c9821f', '#6f7ce0', '#14855f']

export function EnvelopesPage() {
  const { envelopes, resumo, hoje, categorias, recorrentes } = useDados()
  const [transferindo, setTransferindo] = useState<string | null>(null)
  const [paraId, setParaId] = useState<string>('')
  const [valorTransferencia, setValorTransferencia] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editandoValores, setEditandoValores] = useState(false)

  const ativos = useMemo(() => envelopes.filter((e) => !e.arquivado), [envelopes])
  const fixos = ativos.filter((e) => e.tipo === 'fixo')
  const variaveis = ativos.filter((e) => e.tipo === 'variavel')
  const investimentos = ativos.filter((e) => e.tipo === 'investimento')

  const totalNosEnvelopes = ativos.reduce((s, e) => s + e.saldo, 0)
  const totalMensal = ativos.filter((e) => e.tipo !== 'investimento').reduce((s, e) => s + e.valorMensal, 0)
  const semDeposito = Boolean(
    resumo && ativos.some((e) => e.tipo !== 'investimento' && e.valorMensal > 0 && e.cicloAlocado === resumo.ciclo.inicio && e.saldo === 0),
  )

  const atualizar = (id: string, mudancas: Partial<Envelope>) => {
    void db.envelopes.update(id, mudancas)
  }

  const separarDinheiro = async () => {
    if (!resumo) return
    setErro(null)
    const ok = await depositarCiclo(resumo.ciclo)
    setAviso(ok ? 'Dinheiro separado nos envelopes.' : 'Todos os envelopes deste ciclo já receberam depósito.')
  }

  const confirmarTransferencia = async () => {
    if (!transferindo || !paraId) return
    setErro(null)
    try {
      await transferirEntreEnvelopes(transferindo, paraId, valorTransferencia, hoje)
      setTransferindo(null)
      setValorTransferencia(0)
      setParaId('')
      setAviso('Transferência feita.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui transferir.')
    }
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
    const estourado = envelope.saldo < 0
    const percentual =
      envelope.valorMensal > 0 ? Math.min(1, Math.max(0, envelope.saldo / envelope.valorMensal)) : envelope.saldo > 0 ? 1 : 0

    return (
      <li key={envelope.id} className={`envelope-card ${estourado ? 'estourado' : ''} tipo-${envelope.tipo}`}>
        <Link to={`/envelopes/${envelope.id}`} className="envelope-link">
          <div className="envelope-topo">
            <span className="envelope-emoji" aria-hidden="true">
              {envelope.emoji}
            </span>
            <div className="envelope-info">
              <strong>{envelope.nome}</strong>
              <span className="muted small">
                {ROTULO_TIPO_ENVELOPE[envelope.tipo]}
                {envelope.tipo !== 'investimento' && envelope.valorMensal > 0
                  ? ` · ${formatBRL(envelope.valorMensal)}/mês`
                  : ''}
              </span>
            </div>
            <div className="envelope-saldo">
              <strong className={estourado ? 'negativo' : ''}>{formatBRL(envelope.saldo)}</strong>
              <span className="muted small">saldo</span>
            </div>
          </div>

          {envelope.tipo !== 'investimento' && envelope.valorMensal > 0 && (
            <div className="cat-track" aria-hidden="true">
              <span className="cat-fill" style={{ width: `${percentual * 100}%`, background: envelope.cor }} />
            </div>
          )}
        </Link>

        {editandoValores && (
          <div className="envelope-edicao">
            {envelope.tipo !== 'investimento' && (
              <label>
                Valor do mês
                <CampoMoeda valor={envelope.valorMensal} onChange={(v) => atualizar(envelope.id, { valorMensal: v })} />
              </label>
            )}
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

        {envelope.tipo !== 'investimento' && (
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              setTransferindo(envelope.id)
              setParaId(ativos.find((e) => e.id !== envelope.id)?.id ?? '')
              setValorTransferencia(0)
              setErro(null)
            }}
          >
            transferir
          </button>
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
          <span>Dentro dos envelopes</span>
          <strong>{formatBRL(totalNosEnvelopes)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Soma dos valores do mês</span>
          <strong>{formatBRL(totalMensal)}</strong>
        </div>
        {resumo && resumo.teto > 0 && totalMensal > resumo.teto && (
          <p className="alerta-inline">A soma dos envelopes passa do que sobra depois da renda. Reveja algum valor.</p>
        )}
      </section>

      <div className="envelope-acoes">
        <button type="button" className="primary-btn" onClick={() => void separarDinheiro()}>
          Separar o dinheiro do mês
        </button>
        <button type="button" className="secondary-btn" onClick={() => setEditandoValores((v) => !v)}>
          {editandoValores ? 'Fechar edição' : 'Ajustar valores'}
        </button>
      </div>

      {semDeposito && <p className="ritmo-msg">Há envelopes sem depósito neste ciclo.</p>}
      {aviso && <p className="ok">{aviso}</p>}
      {erro && !transferindo && <p className="error">{erro}</p>}

      {transferindo && (
        <section className="panel stack">
          <h2>Transferir entre envelopes</h2>
          <p className="muted small">
            De <strong>{ativos.find((e) => e.id === transferindo)?.nome}</strong>
          </p>
          <label>
            Para
            <select value={paraId} onChange={(e) => setParaId(e.target.value)}>
              {ativos
                .filter((e) => e.id !== transferindo)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emoji} {e.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Valor
            <CampoMoeda valor={valorTransferencia} onChange={setValorTransferencia} />
          </label>
          {erro && <p className="error">{erro}</p>}
          <div className="dupla">
            <button type="button" className="secondary-btn" onClick={() => setTransferindo(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={valorTransferencia <= 0 || !paraId}
              onClick={() => void confirmarTransferencia()}
            >
              Transferir
            </button>
          </div>
        </section>
      )}

      {fixos.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Fixos</h2>
          <ul className="lista-envelopes">{fixos.map(renderCard)}</ul>
        </section>
      )}

      {variaveis.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Variáveis</h2>
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

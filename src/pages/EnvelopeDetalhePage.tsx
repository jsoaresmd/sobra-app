import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { SeletorCiclo } from '../components/SeletorCiclo'
import { TrocarArea } from '../components/TrocarArea'
import { formatBRL } from '../lib/money'
import { dentroDo, formatarDiaSemana } from '../lib/dates'
import { jaAconteceu } from '../lib/competencia'
import { ROTULO_TIPO_ENVELOPE } from '../lib/envelopes'
import type { Lancamento } from '../lib/types'

export function EnvelopeDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { envelopes, lancamentos, resumo, contas, categorias, hoje } = useDados()
  const [corrigindo, setCorrigindo] = useState<Lancamento | null>(null)

  const envelope = envelopes.find((e) => e.id === id && !e.arquivado)

  const gastos = useMemo(() => {
    if (!resumo || !envelope) return []
    return lancamentos
      .filter(
        (l) =>
          l.envelopeId === envelope.id &&
          l.tipo === 'despesa' &&
          jaAconteceu(l, hoje) &&
          dentroDo(resumo.ciclo, l.data <= hoje ? l.data : hoje),
      )
      .sort((a, b) => (b.data === a.data ? b.criadoEm.localeCompare(a.criadoEm) : b.data.localeCompare(a.data)))
  }, [lancamentos, resumo, envelope, hoje])

  const porDia = useMemo(() => {
    const mapa = new Map<string, typeof gastos>()
    for (const l of gastos) {
      const lista = mapa.get(l.data) ?? []
      lista.push(l)
      mapa.set(l.data, lista)
    }
    return [...mapa.entries()]
  }, [gastos])

  if (!envelope) {
    return (
      <div className="stack gap-lg">
        <p className="muted small">Envelope não encontrado.</p>
        <button type="button" className="secondary-btn" onClick={() => navigate('/envelopes')}>
          Voltar
        </button>
      </div>
    )
  }

  if (!resumo) return null

  const totalGasto = gastos.reduce((s, l) => s + l.valor, 0)
  const orcamento = envelope.valorMensal
  const sobra = orcamento - totalGasto
  const estourado = orcamento > 0 ? sobra < 0 : totalGasto > 0

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('/envelopes')}>
          ‹ envelopes
        </button>
        <p className="eyebrow">{ROTULO_TIPO_ENVELOPE[envelope.tipo]}</p>
        <h1>
          <span aria-hidden="true">{envelope.emoji}</span> {envelope.nome}
        </h1>
        <SeletorCiclo />
      </header>

      <section className="panel resumo-panel">
        <div className="linha-resumo destaque">
          <span>Gasto no período</span>
          <strong className={estourado ? 'negativo' : ''}>{formatBRL(totalGasto)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Orçamento</span>
          <strong>{formatBRL(orcamento)}</strong>
        </div>
        {orcamento > 0 && (
          <div className="linha-resumo">
            <span>{estourado ? 'Passou' : 'Sobra'}</span>
            <strong className={estourado ? 'negativo' : ''}>{formatBRL(Math.abs(sobra))}</strong>
          </div>
        )}
        <p className="muted small">
          {gastos.length} gasto{gastos.length === 1 ? '' : 's'}
        </p>
      </section>

      {porDia.length === 0 ? (
        <p className="muted small">Nenhum gasto neste envelope no período.</p>
      ) : (
        porDia.map(([dia, itens]) => (
          <section key={dia} className="panel dia-panel">
            <div className="row-between">
              <h2 className="capitalize dia-titulo">{formatarDiaSemana(dia)}</h2>
              <span className="muted small">{formatBRL(itens.reduce((s, l) => s + l.valor, 0))}</span>
            </div>
            <ul className="lista-lancamentos">
              {itens.map((l) => {
                const categoria = categorias.find((c) => c.id === l.categoriaId)
                const conta = contas.find((c) => c.id === l.contaId)
                return (
                  <li key={l.id}>
                    <button type="button" className="lancamento-link" onClick={() => setCorrigindo(l)}>
                      <span className="previsto-emoji">{categoria?.emoji ?? envelope.emoji}</span>
                      <span className="previsto-info">
                        <strong>{l.descricao || categoria?.nome || 'Gasto'}</strong>
                        <span className="muted small">
                          {[conta?.nome, categoria?.nome, l.hora, l.totalParcelas ? `${l.parcela}/${l.totalParcelas}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="previsto-valor">− {formatBRL(l.valor)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <Link to="/extrato" className="cta">
        ver extrato completo
      </Link>

      {corrigindo && <TrocarArea lancamento={corrigindo} onFechar={() => setCorrigindo(null)} />}
    </div>
  )
}

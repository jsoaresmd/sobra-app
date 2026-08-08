import { useMemo, useState } from 'react'
import { useDados } from '../contexts/DadosContext'
import { SeletorCiclo } from '../components/SeletorCiclo'
import { formatBRL } from '../lib/money'
import { dentroDo, formatarDiaSemana } from '../lib/dates'

export function ExtratoPage() {
  const { resumo, lancamentos, categorias, contas, config, hoje } = useDados()
  const [filtroPessoa, setFiltroPessoa] = useState<string | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)

  const doCiclo = useMemo(() => {
    if (!resumo) return []
    return lancamentos
      .filter((l) => l.data <= hoje)
      .filter((l) => dentroDo(resumo.ciclo, l.data))
      .filter((l) => !filtroPessoa || l.pessoaId === filtroPessoa)
      .filter((l) => !filtroCategoria || l.categoriaId === filtroCategoria)
      .sort((a, b) => (b.data === a.data ? b.criadoEm.localeCompare(a.criadoEm) : b.data.localeCompare(a.data)))
  }, [lancamentos, resumo, filtroPessoa, filtroCategoria, hoje])

  const porDia = useMemo(() => {
    const mapa = new Map<string, typeof doCiclo>()
    for (const l of doCiclo) {
      const lista = mapa.get(l.data) ?? []
      lista.push(l)
      mapa.set(l.data, lista)
    }
    return [...mapa.entries()]
  }, [doCiclo])

  if (!resumo) return null

  const total = doCiclo.reduce((soma, l) => soma + (l.tipo === 'despesa' ? l.valor : -l.valor), 0)

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Extrato do período</p>
        <SeletorCiclo />
      </header>

      <div className="filtros">
        {(config?.pessoas.length ?? 0) > 1 && (
          <div className="chips">
            <button type="button" className={`chip ${!filtroPessoa ? 'on' : ''}`} onClick={() => setFiltroPessoa(null)}>
              Todos
            </button>
            {config?.pessoas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${filtroPessoa === p.id ? 'on' : ''}`}
                onClick={() => setFiltroPessoa(filtroPessoa === p.id ? null : p.id)}
              >
                {p.nome}
              </button>
            ))}
          </div>
        )}
        <div className="chips">
          {categorias
            .filter((c) => !c.arquivada)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${filtroCategoria === c.id ? 'on' : ''}`}
                onClick={() => setFiltroCategoria(filtroCategoria === c.id ? null : c.id)}
              >
                {c.emoji} {c.nome}
              </button>
            ))}
        </div>
      </div>

      <p className="muted small">
        {doCiclo.length} lançamento{doCiclo.length === 1 ? '' : 's'} · saldo {formatBRL(total)}
      </p>

      {porDia.length === 0 && <p className="muted small">Nenhum lançamento com esses filtros.</p>}

      {porDia.map(([dia, itens]) => (
        <section key={dia} className="panel dia-panel">
          <div className="row-between">
            <h2 className="capitalize dia-titulo">{formatarDiaSemana(dia)}</h2>
            <span className="muted small">
              {formatBRL(itens.reduce((s, l) => s + (l.tipo === 'despesa' ? l.valor : -l.valor), 0))}
            </span>
          </div>
          <ul className="lista-lancamentos">
            {itens.map((l) => {
              const categoria = categorias.find((c) => c.id === l.categoriaId)
              const conta = contas.find((c) => c.id === l.contaId)
              const pessoa = config?.pessoas.find((p) => p.id === l.pessoaId)
              return (
                <li key={l.id}>
                  <div className="lancamento-link">
                    <span className="previsto-emoji">{categoria?.emoji ?? '💸'}</span>
                    <span className="previsto-info">
                      <strong>{l.descricao || categoria?.nome || 'Lançamento'}</strong>
                      <span className="muted small">
                        {[conta?.nome, pessoa?.nome, l.totalParcelas ? `${l.parcela}/${l.totalParcelas}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className={`previsto-valor ${l.tipo === 'receita' ? 'receita' : ''}`}>
                      {l.tipo === 'receita' ? '+' : '−'} {formatBRL(l.valor)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

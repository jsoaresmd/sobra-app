import { useState } from 'react'
import { filhasDe } from '../lib/categorias'
import { formatBRL } from '../lib/money'
import { fimDaSemana } from '../lib/semana'
import { detalheFilhas, tom, type LinhaPlacar } from '../lib/tetos'
import type { Categoria, Lancamento } from '../lib/types'

export function BarraGasto({ gasto, teto }: { gasto: number; teto: number }) {
  const estado = tom(gasto, teto)
  const pct = teto > 0 ? Math.min(100, Math.max(0, (gasto / teto) * 100)) : gasto > 0 ? 100 : 0
  return (
    <div className="trilha" aria-hidden="true">
      <span className={`tom-${estado}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Placar({
  linhas,
  categorias,
  lancamentos,
  semana,
  onAbrir,
}: {
  linhas: readonly LinhaPlacar[]
  categorias: readonly Categoria[]
  lancamentos?: readonly Lancamento[]
  semana?: string
  onAbrir?: (categoriaId: string) => void
}) {
  const [abertas, setAbertas] = useState<string[]>([])
  if (linhas.length === 0) return <p className="muted">Nenhuma categoria semanal.</p>

  const toggle = (id: string) => {
    setAbertas((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]))
  }

  return (
    <ul className="lista-simples placar">
      {linhas.map((linha) => {
        const categoria = categorias.find((item) => item.id === linha.categoriaId)
        const estado = tom(linha.gasto, linha.teto)
        const temFilhas = filhasDe(categorias, linha.categoriaId).length > 0
        const expandida = abertas.includes(linha.categoriaId)
        const detalhes =
          expandida && lancamentos && semana
            ? detalheFilhas(categorias, lancamentos, linha.categoriaId, semana, fimDaSemana(semana))
            : []

        const miolo = (
          <>
            <span className="placar-emoji" aria-hidden="true">
              {categoria?.emoji}
            </span>
            <span className="placar-miolo">
              <span className="row-between">
                <strong>
                  {categoria?.nome}
                  {temFilhas ? (expandida ? ' ▾' : ' ▸') : ''}
                </strong>
                <span className={`valor-${estado}`}>{formatBRL(linha.sobra)}</span>
              </span>
              <BarraGasto gasto={linha.gasto} teto={linha.teto} />
              <span className="muted small">
                {formatBRL(linha.gasto)} de {formatBRL(linha.teto)}
                {linha.sobra >= 0 ? ' · sobrou' : ' · passou'}
              </span>
              {linha.desconto > 0 && (
                <span className="valor-estouro small">−{formatBRL(linha.desconto)} da semana passada</span>
              )}
            </span>
          </>
        )

        return (
          <li key={linha.categoriaId} className="stack gap-sm">
            {temFilhas ? (
              <button type="button" className="placar-item" onClick={() => toggle(linha.categoriaId)}>
                {miolo}
              </button>
            ) : onAbrir ? (
              <button type="button" className="placar-item" onClick={() => onAbrir(linha.categoriaId)}>
                {miolo}
              </button>
            ) : (
              <div className="placar-item">{miolo}</div>
            )}
            {expandida && (
              <ul className="lista-simples placar-filhas">
                {detalhes.map((item) => {
                  const cat = categorias.find((c) => c.id === item.categoriaId)
                  const rotulo =
                    item.categoriaId === linha.categoriaId
                      ? `Sem subcategoria`
                      : `${cat?.emoji ?? ''} ${cat?.nome ?? item.categoriaId}`
                  return (
                    <li key={item.categoriaId}>
                      <button
                        type="button"
                        className="placar-filha"
                        onClick={() => onAbrir?.(item.categoriaId)}
                        disabled={!onAbrir}
                      >
                        <span>{rotulo}</span>
                        <strong>{formatBRL(item.gasto)}</strong>
                      </button>
                    </li>
                  )
                })}
                {detalhes.length === 0 && <li className="muted small">Nenhum gasto nesta semana.</li>}
                {onAbrir && (
                  <li>
                    <button type="button" className="link-btn" onClick={() => onAbrir(linha.categoriaId)}>
                      Ver todos os lançamentos
                    </button>
                  </li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

import { formatBRL } from '../lib/money'
import { tom, type LinhaPlacar } from '../lib/tetos'
import type { Categoria } from '../lib/types'

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
  onAbrir,
}: {
  linhas: readonly LinhaPlacar[]
  categorias: readonly Categoria[]
  onAbrir?: (categoriaId: string) => void
}) {
  if (linhas.length === 0) return <p className="muted">Nenhuma categoria semanal.</p>
  return (
    <ul className="lista-simples placar">
      {linhas.map((linha) => {
        const categoria = categorias.find((item) => item.id === linha.categoriaId)
        const estado = tom(linha.gasto, linha.teto)
        const miolo = (
          <>
            <span className="placar-emoji" aria-hidden="true">
              {categoria?.emoji}
            </span>
            <span className="placar-miolo">
              <span className="row-between">
                <strong>{categoria?.nome}</strong>
                <span className={`valor-${estado}`}>{linha.sobra >= 0 ? formatBRL(linha.sobra) : formatBRL(linha.sobra)}</span>
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
          <li key={linha.categoriaId}>
            {onAbrir ? (
              <button type="button" className="placar-item" onClick={() => onAbrir(linha.categoriaId)}>
                {miolo}
              </button>
            ) : (
              <div className="placar-item">{miolo}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

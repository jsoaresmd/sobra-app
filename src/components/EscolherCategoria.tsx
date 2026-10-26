import type { Categoria } from '../lib/types'

export function EscolherCategoria({
  categorias,
  onEscolher,
  desabilitado = false,
}: {
  categorias: readonly Categoria[]
  onEscolher: (categoriaId: string) => void
  desabilitado?: boolean
}) {
  return (
    <div className="cat-grid">
      {categorias
        .filter((categoria) => !categoria.arquivada)
        .map((categoria) => (
          <button
            key={categoria.id}
            type="button"
            className="secondary-btn cat-btn"
            disabled={desabilitado}
            onClick={() => onEscolher(categoria.id)}
          >
            <span aria-hidden="true">{categoria.emoji}</span> {categoria.nome}
          </button>
        ))}
    </div>
  )
}

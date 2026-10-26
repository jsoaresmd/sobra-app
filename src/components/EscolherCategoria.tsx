import type { Categoria } from '../lib/types'

export function EscolherCategoria({
  categorias,
  onEscolher,
}: {
  categorias: readonly Categoria[]
  onEscolher: (categoriaId: string) => void
}) {
  return (
    <div className="cat-grid">
      {categorias
        .filter((categoria) => !categoria.arquivada)
        .map((categoria) => (
          <button key={categoria.id} type="button" className="secondary-btn cat-btn" onClick={() => onEscolher(categoria.id)}>
            <span aria-hidden="true">{categoria.emoji}</span> {categoria.nome}
          </button>
        ))}
    </div>
  )
}

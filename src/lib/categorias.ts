import type { Categoria } from './types'

export function ehRaiz(categoria: Pick<Categoria, 'paiId'>) {
  return !categoria.paiId
}

export function filhasDe(categorias: readonly Categoria[], paiId: string) {
  return categorias
    .filter((categoria) => categoria.paiId === paiId && !categoria.arquivada)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'))
}

export function raizes(categorias: readonly Categoria[]) {
  return categorias
    .filter((categoria) => ehRaiz(categoria) && !categoria.arquivada)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'))
}

/** Id do pai + ids das filhas (gasto do placar agrega tudo). */
export function idsDoGrupo(categoriaId: string, categorias: readonly Categoria[]) {
  const propria = categorias.find((categoria) => categoria.id === categoriaId)
  const raizId = propria?.paiId || categoriaId
  return [raizId, ...filhasDe(categorias, raizId).map((categoria) => categoria.id)]
}

export function raizDe(categoriaId: string | null | undefined, categorias: readonly Categoria[]) {
  if (!categoriaId) return null
  const propria = categorias.find((categoria) => categoria.id === categoriaId)
  if (!propria) return categoriaId
  return propria.paiId || propria.id
}

export function paisSemanais(categorias: readonly Categoria[]) {
  return raizes(categorias).filter((categoria) => categoria.tipo === 'semanal')
}

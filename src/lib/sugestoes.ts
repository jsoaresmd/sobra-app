import { naSemana } from './semana'
import type { LinhaPlacar } from './tetos'
import type { Categoria, Lancamento } from './types'

export function sugestoesDaSemana(
  semana: string,
  atual: readonly LinhaPlacar[],
  anterior: readonly LinhaPlacar[],
  lancamentos: readonly Lancamento[],
  categorias: readonly Categoria[],
) {
  const nome = (id: string) => categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria'
  const textos: string[] = []
  const antes = new Map(anterior.map((linha) => [linha.categoriaId, linha]))

  for (const linha of atual) {
    if (linha.sobra < 0 && (antes.get(linha.categoriaId)?.sobra ?? 0) < 0) {
      textos.push(`${nome(linha.categoriaId)} passou do teto pela segunda semana.`)
    }
  }

  const porLugar = new Map<string, { nome: string; vezes: number }>()
  for (const linha of lancamentos) {
    if (!naSemana(linha.data, semana) || linha.sinal !== 'saida' || linha.categoriaId === 'cat-ignorar') continue
    const item = porLugar.get(linha.estabelecimentoChave) ?? { nome: linha.descricaoOriginal, vezes: 0 }
    item.vezes += 1
    porLugar.set(linha.estabelecimentoChave, item)
    if (linha.categoriaId === 'cat-assinaturas' && item.vezes === 2) {
      textos.push(`${linha.descricaoOriginal} apareceu mais de uma vez.`)
    }
    if (linha.parcelaAtual === 1) textos.push(`Parcelamento novo: ${linha.descricaoOriginal}.`)
  }
  for (const item of porLugar.values()) {
    if (item.vezes >= 4) textos.push(`${item.vezes} compras em ${item.nome}.`)
  }
  return textos
}

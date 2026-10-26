import type { Estabelecimento, Lancamento } from './types'

export function nomeVisivel(linha: Pick<Lancamento, 'estabelecimentoChave' | 'descricaoOriginal'>, estabelecimentos: readonly Estabelecimento[]) {
  const estab = estabelecimentos.find((item) => item.chaveNormalizada === linha.estabelecimentoChave)
  return estab?.apelido || estab?.textoOriginal || linha.descricaoOriginal
}

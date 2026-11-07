import type { Categoria, TipoCategoria } from './types'

function cat(
  id: string,
  nome: string,
  emoji: string,
  cor: string,
  tipo: TipoCategoria,
  ordem: number,
): Categoria {
  return { id, nome, emoji, cor, tipo, tetoMensal: 0, arquivada: false, ordem, paiId: null }
}

export const CATEGORIAS_SEED: Categoria[] = [
  cat('cat-mercado', 'Mercado', '🛒', '#2f9e6e', 'semanal', 1),
  cat('cat-restaurante', 'Restaurante e lanche', '🍔', '#e8734a', 'semanal', 2),
  cat('cat-transporte', 'Carro e transporte', '⛽', '#3f7ec4', 'semanal', 3),
  cat('cat-saude', 'Farmácia e saúde', '💊', '#d4557f', 'semanal', 4),
  cat('cat-lazer', 'Lazer', '🎉', '#c9821f', 'semanal', 5),
  cat('cat-compras', 'Compras', '🛍️', '#b4529c', 'semanal', 6),
  cat('cat-moradia', 'Moradia', '🏠', '#8a6cc4', 'mensal', 7),
  cat('cat-financiamento', 'Financiamento carro', '🚗', '#3f7ec4', 'mensal', 8),
  cat('cat-dizimo', 'Dízimo e ofertas', '⛪', '#6f7ce0', 'mensal', 9),
  cat('cat-educacao', 'Educação', '🎓', '#2c8fa6', 'mensal', 10),
  cat('cat-assinaturas', 'Assinaturas', '📺', '#5a6b8c', 'mensal', 11),
  cat('cat-pets', 'Pets', '🐾', '#7a9b3d', 'mensal', 12),
  cat('cat-casa', 'Casa e serviços', '🧺', '#8a6cc4', 'mensal', 13),
  cat('cat-investimento', 'Investimento/guardado', '💰', '#14855f', 'investimento', 14),
  cat('cat-ignorar', 'Ignorar', '·', '#7b8794', 'ignorar', 15),
  cat('cat-renda', 'Renda', '↑', '#2f9e6e', 'renda', 16),
]

const APELIDOS: Array<[RegExp, string]> = [
  [/aluguel|luz|agua|internet|moradia|\bcasa\b/, 'cat-moradia'],
  [/financiamento/, 'cat-financiamento'],
  [/dizimo|doac|oferta/, 'cat-dizimo'],
  [/matricula|educa|seminario/, 'cat-educacao'],
  [/assinatura|streaming|servico/, 'cat-assinaturas'],
  [/pet|dog/, 'cat-pets'],
  [/lavanderia/, 'cat-casa'],
  [/supermercado|mercado/, 'cat-mercado'],
  [/restaurante|lanche|delivery/, 'cat-restaurante'],
  [/transporte|carro|combust/, 'cat-transporte'],
  [/saude|farmac/, 'cat-saude'],
  [/lazer|passeio/, 'cat-lazer'],
  [/compra|vestuario|eletron|roupa/, 'cat-compras'],
  [/invest/, 'cat-investimento'],
]

export function normalizarNome(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Liga um nome antigo de envelope ou categoria à categoria nova. */
export function categoriaIdPorNomeAntigo(nome: string | null | undefined) {
  if (!nome?.trim()) return null
  const chave = normalizarNome(nome)
  for (const [teste, id] of APELIDOS) {
    if (teste.test(chave)) return id
  }
  return null
}

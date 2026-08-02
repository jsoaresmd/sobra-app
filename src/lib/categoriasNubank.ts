import type { GrupoCategoria } from './types'

/**
 * Categorias no mesmo espírito do app Nubank (controle de gastos do cartão),
 * mais Pets e Doações — necessários para dízimo e o envelope de pets da família.
 */
export type CategoriaNubankDef = {
  nome: string
  emoji: string
  cor: string
  grupo: GrupoCategoria
  /** Nomes antigos no Sobra / sinônimos para migrar e mapear Pluggy. */
  aliases?: string[]
}

export const CATEGORIAS_NUBANK: CategoriaNubankDef[] = [
  { nome: 'Supermercado', emoji: '🛒', cor: '#2f9e6e', grupo: 'essencial', aliases: ['mercado', 'alimentação', 'food and drink', 'groceries'] },
  { nome: 'Restaurante', emoji: '🍔', cor: '#e8734a', grupo: 'variavel', aliases: ['restaurante e delivery', 'restaurantes', 'delivery', 'eating out'] },
  { nome: 'Transporte', emoji: '⛽', cor: '#3f7ec4', grupo: 'essencial', aliases: ['transport', 'mobility'] },
  { nome: 'Casa', emoji: '🏠', cor: '#8a6cc4', grupo: 'essencial', aliases: ['moradia', 'home', 'utilities'] },
  { nome: 'Saúde', emoji: '💊', cor: '#d4557f', grupo: 'essencial', aliases: ['health', 'wellness'] },
  { nome: 'Educação', emoji: '🎓', cor: '#2c8fa6', grupo: 'essencial', aliases: ['education'] },
  { nome: 'Serviços', emoji: '🧾', cor: '#6f7ce0', grupo: 'essencial', aliases: ['assinaturas', 'services', 'streaming', 'telecom'] },
  { nome: 'Lazer', emoji: '🎬', cor: '#c9821f', grupo: 'variavel', aliases: ['lazer e hobbies', 'entertainment', 'hobby'] },
  { nome: 'Vestuário', emoji: '👕', cor: '#b4529c', grupo: 'variavel', aliases: ['compras', 'roupas', 'clothing', 'apparel'] },
  { nome: 'Eletrônicos', emoji: '📱', cor: '#5a6b8c', grupo: 'variavel', aliases: ['electronics', 'tecnologia'] },
  { nome: 'Viagens', emoji: '✈️', cor: '#2a9dad', grupo: 'variavel', aliases: ['viagem', 'travel'] },
  { nome: 'Pets', emoji: '🐾', cor: '#7a9b3d', grupo: 'variavel', aliases: ['pet', 'animais'] },
  { nome: 'Doações', emoji: '🙏', cor: '#6f7ce0', grupo: 'essencial', aliases: ['dízimo', 'presentes', 'donations', 'charity'] },
  { nome: 'Outros', emoji: '✨', cor: '#7b8794', grupo: 'variavel', aliases: ['other', 'uncategorized', 'transfer'] },
]

/** Envelope padrão ligado a cada categoria (e os fixos da casa). */
export type EnvelopeNubankDef = {
  nome: string
  emoji: string
  cor: string
  tipo: 'fixo' | 'variavel' | 'investimento'
  categoriaNome?: string
  /** Nomes antigos para renomear na migração. */
  aliases?: string[]
}

export const ENVELOPES_NUBANK: EnvelopeNubankDef[] = [
  { nome: 'Dízimo', emoji: '🙏', cor: '#6f7ce0', tipo: 'fixo', categoriaNome: 'Doações', aliases: ['dizimo'] },
  { nome: 'Casa', emoji: '🏠', cor: '#8a6cc4', tipo: 'fixo', categoriaNome: 'Casa' },
  { nome: 'Financiamento', emoji: '🚗', cor: '#3f7ec4', tipo: 'fixo' },
  { nome: 'Internet', emoji: '📶', cor: '#2c8fa6', tipo: 'fixo', categoriaNome: 'Serviços' },
  { nome: 'Supermercado', emoji: '🛒', cor: '#2f9e6e', tipo: 'variavel', categoriaNome: 'Supermercado', aliases: ['mercado'] },
  { nome: 'Restaurante', emoji: '🍔', cor: '#e8734a', tipo: 'variavel', categoriaNome: 'Restaurante' },
  { nome: 'Transporte', emoji: '⛽', cor: '#3f7ec4', tipo: 'variavel', categoriaNome: 'Transporte' },
  { nome: 'Saúde', emoji: '💊', cor: '#d4557f', tipo: 'variavel', categoriaNome: 'Saúde' },
  { nome: 'Educação', emoji: '🎓', cor: '#2c8fa6', tipo: 'variavel', categoriaNome: 'Educação' },
  { nome: 'Serviços', emoji: '🧾', cor: '#6f7ce0', tipo: 'variavel', categoriaNome: 'Serviços', aliases: ['assinaturas'] },
  { nome: 'Lazer', emoji: '🎬', cor: '#c9821f', tipo: 'variavel', categoriaNome: 'Lazer' },
  { nome: 'Vestuário', emoji: '👕', cor: '#b4529c', tipo: 'variavel', categoriaNome: 'Vestuário' },
  { nome: 'Eletrônicos', emoji: '📱', cor: '#5a6b8c', tipo: 'variavel', categoriaNome: 'Eletrônicos' },
  { nome: 'Viagens', emoji: '✈️', cor: '#2a9dad', tipo: 'variavel', categoriaNome: 'Viagens' },
  { nome: 'Pets', emoji: '🐾', cor: '#7a9b3d', tipo: 'variavel', categoriaNome: 'Pets' },
  { nome: 'Outros', emoji: '✨', cor: '#7b8794', tipo: 'variavel', categoriaNome: 'Outros' },
  { nome: 'Investimentos', emoji: '📈', cor: '#14855f', tipo: 'investimento' },
]

export function normalizarNomeCategoria(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Resolve nome de categoria Nubank a partir de um rótulo do banco/Pluggy/legado. */
export function resolverNomeCategoriaNubank(rotulo: string | null | undefined): string | null {
  if (!rotulo?.trim()) return null
  const chave = normalizarNomeCategoria(rotulo)
  for (const cat of CATEGORIAS_NUBANK) {
    if (normalizarNomeCategoria(cat.nome) === chave) return cat.nome
    if (cat.aliases?.some((a) => normalizarNomeCategoria(a) === chave)) return cat.nome
  }
  // Match parcial: "Food & Drink · Restaurants" etc.
  for (const cat of CATEGORIAS_NUBANK) {
    const alvos = [cat.nome, ...(cat.aliases ?? [])].map(normalizarNomeCategoria)
    if (alvos.some((a) => chave.includes(a) || a.includes(chave))) return cat.nome
  }
  return null
}

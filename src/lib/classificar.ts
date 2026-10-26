import { chaveEstabelecimento } from './merchant'

export type RegraConhecida = {
  chaveNormalizada: string
  categoriaId: string | null
}

const HEURISTICA: Array<[RegExp, string]> = [
  [/farmacia|unipreco|medica/, 'cat-saude'],
  [/gigante|klechewsk|premium market|comercio de carnes/, 'cat-mercado'],
  [/99food/, 'cat-restaurante'],
  [/posto|forca do oleo|uber|\b99\b|nutag/, 'cat-transporte'],
  [/burger king|duffbeer|bier hoff|apollo|patyy|mario romualdo|sandra aparec/, 'cat-restaurante'],
  [/prime aluguel|crunchyroll|cinema|passeio/, 'cat-lazer'],
  [/havan|shein|natura|andaraki|papelaria/, 'cat-compras'],
  [/sacara|\bwifi\b|internet|\baluguel\b/, 'cat-moradia'],
  [/aymore|financiamento/, 'cat-financiamento'],
  [/seminario/, 'cat-educacao'],
  [/dog center/, 'cat-pets'],
  [/lavanderia/, 'cat-casa'],
  [/igreja batista|dizimo/, 'cat-dizimo'],
  [/youtube|google|nucel|ankihub|amazon\s*prime/, 'cat-assinaturas'],
]

function heuristica(textoOriginal: string, chave: string) {
  for (const [teste, categoriaId] of HEURISTICA) {
    if (teste.test(chave)) return categoriaId
  }
  const cru = textoOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\*/g, ' ')
  if (/^ifd\b/.test(cru)) return 'cat-restaurante'
  return null
}

/** Regra aprendida primeiro; se não houver, palavra-chave; senão fica sem categoria. */
export function classificar(texto: string, regras: readonly RegraConhecida[] = []) {
  const chave = chaveEstabelecimento(texto)
  const regra = regras.find((item) => item.chaveNormalizada === chave && item.categoriaId)
  if (regra?.categoriaId) return { chave, categoriaId: regra.categoriaId }
  return { chave, categoriaId: heuristica(texto, chave) }
}

import { chaveEstabelecimento, extrairParcela, nomeSemParcela } from './merchant'

export type TxNubank = {
  /** Identificador estável para deduplicar entre importações (PDF e CSV). */
  fingerprint: string
  data: string
  descricao: string
  /** Nome limpo sem "Parcela X/Y", usado na etiqueta. */
  estabelecimento: string
  chave: string
  valor: number
  tipo: 'despesa' | 'receita'
  parcela?: number
  totalParcelas?: number
  cartaoFinal?: string
  origem: 'compra' | 'pagamento' | 'iof' | 'boleto' | 'outro'
}

export type FaturaNubank = {
  vencimento: string | null
  periodoInicio: string | null
  periodoFim: string | null
  total: number | null
  transacoes: TxNubank[]
  formato: 'pdf' | 'csv'
}

export function parseValorBR(texto: string) {
  const negativo = /−|-/.test(texto)
  const limpo = texto.replace(/[^\d,]/g, '').replace(',', '.')
  const n = Number(limpo)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

export function classificarOrigem(descricao: string): TxNubank['origem'] {
  if (/pagamento/i.test(descricao)) return 'pagamento'
  if (/^IOF\b/i.test(descricao)) return 'iof'
  if (/PARTICIPACOES|CREDITO, FINANCIAMENTO|FINANCIAMENTO E INVESTIM/i.test(descricao)) return 'boleto'
  return 'compra'
}

/**
 * Mesma chave para PDF e CSV do mesmo gasto: data + valor absoluto +
 * estabelecimento normalizado + parcela. Sem final do cartão (o CSV não traz).
 */
export function fingerprintNubank(params: {
  data: string
  valorAbs: number
  estabelecimento: string
  parcela?: number
  totalParcelas?: number
  tipo: 'despesa' | 'receita'
}) {
  return [
    params.data,
    params.valorAbs.toFixed(2),
    chaveEstabelecimento(params.estabelecimento),
    params.parcela ?? 1,
    params.totalParcelas ?? 1,
    params.tipo,
  ].join('|')
}

export function montarTxNubank(params: {
  data: string
  titulo: string
  valorAssinado: number
  cartaoFinal?: string
}): TxNubank | null {
  const titulo = params.titulo.trim()
  if (!titulo || !params.data) return null
  if (params.valorAssinado === 0) return null

  const origem = classificarOrigem(titulo)
  const valor = Math.abs(params.valorAssinado)
  const tipo: TxNubank['tipo'] = params.valorAssinado < 0 || origem === 'pagamento' ? 'receita' : 'despesa'
  const { parcela, totalParcelas } = extrairParcela(titulo)
  const estabelecimento = nomeSemParcela(titulo)
  const chave = chaveEstabelecimento(estabelecimento)

  return {
    fingerprint: fingerprintNubank({
      data: params.data,
      valorAbs: valor,
      estabelecimento,
      parcela,
      totalParcelas,
      tipo,
    }),
    data: params.data,
    descricao: parcela ? `${estabelecimento} (${parcela}/${totalParcelas})` : estabelecimento,
    estabelecimento,
    chave,
    valor,
    tipo,
    parcela,
    totalParcelas,
    cartaoFinal: params.cartaoFinal,
    origem,
  }
}

export function deduplicarTxs(transacoes: TxNubank[]) {
  const vistos = new Set<string>()
  const unicas: TxNubank[] = []
  // Contagem para compras idênticas no mesmo dia (ex.: duas lavanderias 15,90).
  const contagem = new Map<string, number>()

  for (const t of transacoes) {
    const n = (contagem.get(t.fingerprint) ?? 0) + 1
    contagem.set(t.fingerprint, n)
    const fp = n === 1 ? t.fingerprint : `${t.fingerprint}#${n}`
    if (vistos.has(fp)) continue
    vistos.add(fp)
    unicas.push(n === 1 ? t : { ...t, fingerprint: fp })
  }
  return unicas
}

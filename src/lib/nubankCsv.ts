import { deduplicarTxs, montarTxNubank, parseValorBR, type FaturaNubank } from './nubankShared'

/** Divide uma linha CSV respeitando aspas (incluindo "" escapado). */
function parseCsvLine(linha: string): string[] {
  const campos: string[] = []
  let atual = ''
  let emAspas = false

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (emAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"'
          i += 1
        } else {
          emAspas = false
        }
      } else {
        atual += c
      }
      continue
    }
    if (c === '"') {
      emAspas = true
      continue
    }
    if (c === ',') {
      campos.push(atual)
      atual = ''
      continue
    }
    atual += c
  }
  campos.push(atual)
  return campos.map((c) => c.trim())
}

/**
 * CSV oficial da fatura Nubank:
 * date,title,amount
 * 2026-07-03,Gigante Atacadista,"49,81"
 * 2026-07-03,Pagamento recebido,"- 14.500,00"
 */
export function parseFaturaNubankCsv(texto: string): FaturaNubank {
  const linhas = texto
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (linhas.length === 0) {
    return { vencimento: null, periodoInicio: null, periodoFim: null, total: null, transacoes: [], formato: 'csv' }
  }

  const cabecalho = parseCsvLine(linhas[0]).map((c) => c.toLowerCase())
  const idxData = cabecalho.findIndex((c) => c === 'date' || c === 'data')
  const idxTitulo = cabecalho.findIndex((c) => c === 'title' || c === 'titulo' || c === 'descrição' || c === 'descricao')
  const idxValor = cabecalho.findIndex((c) => c === 'amount' || c === 'valor')

  if (idxData < 0 || idxTitulo < 0 || idxValor < 0) {
    throw new Error('CSV não parece ser da fatura Nubank (esperado: date, title, amount).')
  }

  const transacoes = []
  const datas: string[] = []

  for (const linha of linhas.slice(1)) {
    const cols = parseCsvLine(linha)
    const data = cols[idxData]?.slice(0, 10)
    const titulo = cols[idxTitulo]
    const valorRaw = parseValorBR(cols[idxValor] ?? '')
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data) || valorRaw === null || !titulo) continue

    const tx = montarTxNubank({ data, titulo, valorAssinado: valorRaw })
    if (!tx) continue
    transacoes.push(tx)
    if (tx.origem === 'compra') datas.push(data)
  }

  datas.sort()
  const periodoInicio = datas[0] ?? null
  const periodoFim = datas[datas.length - 1] ?? null
  const totalCompras = transacoes
    .filter((t) => t.tipo === 'despesa' && t.origem === 'compra')
    .reduce((s, t) => s + t.valor, 0)

  return {
    vencimento: null,
    periodoInicio,
    periodoFim,
    total: totalCompras || null,
    transacoes: deduplicarTxs(transacoes),
    formato: 'csv',
  }
}

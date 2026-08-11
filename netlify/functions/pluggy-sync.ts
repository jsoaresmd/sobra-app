import { cors, metodo, parseBody, pluggyApiKey, pluggyFetch, type Handler } from './_pluggy'

type ContaPluggy = {
  id: string
  type: string
  subtype: string | null
  name: string
  marketingName: string | null
  balance: number
  currencyCode: string
  number: string | null
  creditData?: {
    balanceCloseDate?: string | null
    balanceDueDate?: string | null
    availableCreditLimit?: number | null
    creditLimit?: number | null
    minimumPayment?: number | null
  } | null
}

type BillPluggy = {
  id: string
  dueDate: string
  billClosingDate: string | null
  totalAmount: number
  minimumPaymentAmount?: number | null
  financeCharges?: Array<{ type: string; amount: number }> | null
  payments?: Array<{ valueType: string; paymentDate: string; paymentMode: string | null; amount: number }> | null
}

type TxPluggy = {
  id: string
  description: string
  descriptionRaw: string | null
  amount: number
  date: string
  category: string | null
  categoryId: string | null
  type: 'DEBIT' | 'CREDIT' | string
  status: string
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
    totalAmount?: number | null
    purchaseDate?: string | null
    billId?: string | null
    billMonth?: string | null
  } | null
}

async function todasTransacoes(apiKey: string, accountId: string, dateFrom: string) {
  const resultados: TxPluggy[] = []
  const primeiro = new URLSearchParams({
    accountId,
    dateFrom,
  })
  let path: string | null = `/v2/transactions?${primeiro}`

  // Cursor pagination: a resposta traz `next` (ex.: "?accountId=...&after=...") até acabar.
  for (let i = 0; i < 100 && path; i++) {
    const data = (await pluggyFetch(path, apiKey)) as {
      results: TxPluggy[]
      next?: string | null
    }
    resultados.push(...(data.results ?? []))

    const next = data.next
    if (!next) {
      path = null
      break
    }
    if (next.startsWith('http')) {
      const url = new URL(next)
      path = `${url.pathname}${url.search}`
    } else if (next.startsWith('/v2/')) {
      path = next
    } else {
      path = `/v2/transactions${next.startsWith('?') ? next : `?${next}`}`
    }
  }

  return resultados
}

/**
 * Busca contas e transações dos itemIds conectados.
 * Body: { itemIds: string[], dateFrom?: 'YYYY-MM-DD' }
 */
export const handler: Handler = async (event) => {
  if (metodo(event) === 'OPTIONS') return cors(204, {})
  if (metodo(event) !== 'POST') return cors(405, { error: 'Use POST' })

  try {
    const body = parseBody<{ itemIds?: string[]; dateFrom?: string }>(event)
    const itemIds = (body.itemIds ?? []).filter(Boolean)
    if (itemIds.length === 0) return cors(400, { error: 'Informe ao menos um itemId.' })

    const dateFrom =
      body.dateFrom ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10)

    const apiKey = await pluggyApiKey()
    const contas: Array<ContaPluggy & { itemId: string }> = []
    const transacoes: Array<TxPluggy & { accountId: string; itemId: string }> = []
    const faturas: Array<BillPluggy & { accountId: string }> = []

    const mortos: string[] = []

    for (const itemId of itemIds) {
      try {
        const accounts = (await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`, apiKey)) as {
          results: ContaPluggy[]
        }
        for (const conta of accounts.results ?? []) {
          contas.push({ ...conta, itemId })
          const txs = await todasTransacoes(apiKey, conta.id, dateFrom)
          for (const tx of txs) transacoes.push({ ...tx, accountId: conta.id, itemId })

          if (conta.type === 'CREDIT') {
            // Nem todo conector entrega faturas; sem elas o app cai no cálculo por período.
            try {
              const bills = (await pluggyFetch(`/bills?accountId=${encodeURIComponent(conta.id)}`, apiKey)) as {
                results: BillPluggy[]
              }
              for (const bill of bills.results ?? []) faturas.push({ ...bill, accountId: conta.id })
            } catch {
              // segue sem faturas
            }
          }
        }
      } catch (erro) {
        const texto = erro instanceof Error ? erro.message : String(erro)
        if (/404|ITEM_NOT_FOUND/i.test(texto)) {
          mortos.push(itemId)
          continue
        }
        throw erro
      }
    }

    return cors(200, {
      sincronizadoEm: new Date().toISOString(),
      dateFrom,
      contas,
      transacoes,
      faturas,
      mortos,
    })
  } catch (erro) {
    return cors(500, { error: erro instanceof Error ? erro.message : 'Erro desconhecido' })
  }
}

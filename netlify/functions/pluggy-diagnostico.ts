import { cors, metodo, parseBody, pluggyApiKey, pluggyFetch, type Handler } from './_pluggy'

type ContaPluggy = {
  id: string
  type: string
  subtype: string | null
  name: string
  marketingName: string | null
  number: string | null
  balance: number
  creditData?: Record<string, unknown> | null
  bankData?: Record<string, unknown> | null
}

type TxPluggy = {
  id: string
  description: string
  descriptionRaw: string | null
  amount: number
  date: string
  category: string | null
  categoryId: string | null
  type: string
  status?: string | null
  creditCardMetadata?: Record<string, unknown> | null
}

type Bill = {
  id: string
  dueDate: string
  billClosingDate: string | null
  totalAmount: number
  minimumPaymentAmount?: number | null
  financeCharges?: Array<{ type: string; amount: number }>
  payments?: Array<{ valueType: string; paymentDate: string; paymentMode: string | null; amount: number }>
}

function contar<T>(lista: T[], chave: (item: T) => string) {
  const mapa: Record<string, number> = {}
  for (const item of lista) {
    const k = chave(item) || '(vazio)'
    mapa[k] = (mapa[k] ?? 0) + 1
  }
  return mapa
}

/**
 * Retrato do que a Pluggy realmente devolve para esta conexão: serve para
 * conferir os números do app contra a fonte, sem adivinhação.
 */
export const handler: Handler = async (event) => {
  if (metodo(event) === 'OPTIONS') return cors(204, {})
  if (metodo(event) !== 'POST') return cors(405, { error: 'Use POST' })

  try {
    const body = parseBody<{ itemIds?: string[]; dias?: number }>(event)
    const itemIds = (body.itemIds ?? []).filter(Boolean)
    if (itemIds.length === 0) return cors(400, { error: 'Informe ao menos um itemId.' })

    const dias = Math.min(Math.max(body.dias ?? 45, 7), 120)
    const dateFrom = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
    const apiKey = await pluggyApiKey()

    const itens: unknown[] = []
    const contasSaida: unknown[] = []

    for (const itemId of itemIds) {
      let item: {
        id: string
        status: string
        executionStatus: string
        lastUpdatedAt: string | null
        connector?: { name?: string; type?: string } | null
        error?: unknown
      }
      try {
        item = (await pluggyFetch(`/items/${encodeURIComponent(itemId)}`, apiKey)) as typeof item
      } catch (erro) {
        // Uma conexão quebrada não pode esconder o resto do diagnóstico.
        itens.push({ itemId, falhou: erro instanceof Error ? erro.message : 'erro' })
        continue
      }

      itens.push({
        itemId: item.id,
        conector: item.connector?.name ?? null,
        tipoConector: item.connector?.type ?? null,
        status: item.status,
        executionStatus: item.executionStatus,
        lastUpdatedAt: item.lastUpdatedAt,
        error: item.error ?? null,
      })

      const contas = (await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`, apiKey)) as {
        results: ContaPluggy[]
      }

      for (const conta of contas.results ?? []) {
        const txs = (await pluggyFetch(
          `/v2/transactions?accountId=${encodeURIComponent(conta.id)}&dateFrom=${dateFrom}`,
          apiKey,
        )) as { results: TxPluggy[] }
        const lista = txs.results ?? []

        let faturas: Bill[] = []
        let erroFaturas: string | null = null
        if (conta.type === 'CREDIT') {
          try {
            const bills = (await pluggyFetch(`/bills?accountId=${encodeURIComponent(conta.id)}`, apiKey)) as {
              results: Bill[]
            }
            faturas = bills.results ?? []
          } catch (erro) {
            erroFaturas = erro instanceof Error ? erro.message : 'falhou'
          }
        }

        contasSaida.push({
          id: conta.id,
          tipo: conta.type,
          subtipo: conta.subtype,
          nome: conta.marketingName || conta.name,
          numero: conta.number,
          balance: conta.balance,
          creditData: conta.creditData ?? null,
          bankData: conta.bankData ?? null,
          faturas: faturas.map((b) => ({
            id: b.id,
            dueDate: b.dueDate,
            billClosingDate: b.billClosingDate,
            totalAmount: b.totalAmount,
            minimumPaymentAmount: b.minimumPaymentAmount ?? null,
            encargos: (b.financeCharges ?? []).map((c) => ({ type: c.type, amount: c.amount })),
            pagamentos: (b.payments ?? []).map((p) => ({
              valueType: p.valueType,
              paymentDate: p.paymentDate,
              paymentMode: p.paymentMode,
              amount: p.amount,
            })),
          })),
          erroFaturas,
          transacoes: {
            desde: dateFrom,
            total: lista.length,
            porStatus: contar(lista, (t) => String(t.status ?? 'sem status')),
            porMesDaData: contar(lista, (t) => String(t.date).slice(0, 7)),
            porBillMonth: contar(lista, (t) =>
              String((t.creditCardMetadata as { billMonth?: string } | null)?.billMonth ?? 'sem billMonth'),
            ),
            recentes: lista
              .slice()
              .sort((a, b) => String(b.date).localeCompare(String(a.date)))
              .slice(0, 20)
              .map((t) => ({
                date: t.date,
                description: t.descriptionRaw || t.description,
                amount: t.amount,
                type: t.type,
                status: t.status ?? null,
                category: t.category,
                creditCardMetadata: t.creditCardMetadata ?? null,
              })),
          },
        })
      }
    }

    return cors(200, { geradoEm: new Date().toISOString(), itens, contas: contasSaida })
  } catch (erro) {
    return cors(500, { error: erro instanceof Error ? erro.message : 'Erro desconhecido' })
  }
}

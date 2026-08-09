import { cors, metodo, parseBody, pluggyApiKey, pluggyFetch, type Handler } from './_pluggy'

type ItemPluggy = {
  id: string
  status: string
  executionStatus: string
  lastUpdatedAt: string | null
  error?: { code?: string; message?: string } | null
  connector?: { name?: string } | null
}

type Resposta = {
  itemId: string
  status: string
  executionStatus: string
  lastUpdatedAt: string | null
  conector: string | null
  erro: string | null
  /** Preenchido quando a Pluggy recusa atualizar de novo tão cedo. */
  aguardando: string | null
}

async function ler(itemId: string, apiKey: string): Promise<ItemPluggy> {
  return (await pluggyFetch(`/items/${encodeURIComponent(itemId)}`, apiKey)) as ItemPluggy
}

/**
 * A Pluggy só busca dados novos no banco quando o item é atualizado; sem isso
 * a leitura devolve sempre a última coleta. Body: { itemIds, acao }.
 */
export const handler: Handler = async (event) => {
  if (metodo(event) === 'OPTIONS') return cors(204, {})
  if (metodo(event) !== 'POST') return cors(405, { error: 'Use POST' })

  try {
    const body = parseBody<{ itemIds?: string[]; acao?: 'status' | 'atualizar' }>(event)
    const itemIds = (body.itemIds ?? []).filter(Boolean)
    if (itemIds.length === 0) return cors(400, { error: 'Informe ao menos um itemId.' })

    const apiKey = await pluggyApiKey()
    const itens: Resposta[] = []

    for (const itemId of itemIds) {
      let aguardando: string | null = null

      if (body.acao === 'atualizar') {
        try {
          await pluggyFetch(`/items/${encodeURIComponent(itemId)}`, apiKey, {
            method: 'PATCH',
            body: JSON.stringify({}),
          })
        } catch (erro) {
          const texto = erro instanceof Error ? erro.message : String(erro)
          // 409: atualização pedida antes da frequência mínima. Seguimos com o que já existe.
          if (!/409|BEFORE_ALLOWED_FREQUENCY/i.test(texto)) throw erro
          aguardando = texto
        }
      }

      const item = await ler(itemId, apiKey)
      itens.push({
        itemId,
        status: item.status,
        executionStatus: item.executionStatus,
        lastUpdatedAt: item.lastUpdatedAt ?? null,
        conector: item.connector?.name ?? null,
        erro: item.error?.message ?? null,
        aguardando,
      })
    }

    return cors(200, { itens })
  } catch (erro) {
    return cors(500, { error: erro instanceof Error ? erro.message : 'Erro desconhecido' })
  }
}

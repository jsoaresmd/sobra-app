import { cors, metodo, pluggyApiKey, pluggyFetch, type Handler } from './_pluggy'

export const CLIENT_USER_ID = 'sobra-pessoal'

type ItemPluggy = {
  id: string
  connector?: { name?: string; imageUrl?: string }
  status?: string
  clientUserId?: string | null
  createdAt?: string
}

/**
 * Lista conexões (items) já criadas para este app — útil no celular
 * quando o itemId ficou só no IndexedDB do PC.
 */
export const handler: Handler = async (event) => {
  if (metodo(event) === 'OPTIONS') return cors(204, {})
  if (metodo(event) !== 'GET' && metodo(event) !== 'POST') return cors(405, { error: 'Use GET ou POST' })

  try {
    const apiKey = await pluggyApiKey()
    const resultados: ItemPluggy[] = []

    for (let page = 1; page <= 20; page++) {
      const params = new URLSearchParams({
        pageSize: '50',
        page: String(page),
        clientUserId: CLIENT_USER_ID,
      })
      const data = (await pluggyFetch(`/items?${params}`, apiKey)) as {
        results?: ItemPluggy[]
        totalPages?: number
      }
      resultados.push(...(data.results ?? []))
      if (page >= (data.totalPages ?? 1)) break
    }

    // Fallback: se o filtro por clientUserId não trouxer nada, lista geral (dev).
    if (resultados.length === 0) {
      for (let page = 1; page <= 5; page++) {
        const params = new URLSearchParams({ pageSize: '50', page: String(page) })
        const data = (await pluggyFetch(`/items?${params}`, apiKey)) as {
          results?: ItemPluggy[]
          totalPages?: number
        }
        for (const item of data.results ?? []) {
          if (!item.clientUserId || item.clientUserId === CLIENT_USER_ID) resultados.push(item)
        }
        if (page >= (data.totalPages ?? 1)) break
      }
    }

    return cors(200, {
      itemIds: [...new Set(resultados.map((i) => i.id))],
      items: resultados.map((i) => ({
        id: i.id,
        nome: i.connector?.name ?? 'Banco',
        status: i.status ?? null,
      })),
    })
  } catch (erro) {
    return cors(500, { error: erro instanceof Error ? erro.message : 'Erro desconhecido' })
  }
}

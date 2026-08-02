import { cors, metodo, pluggyApiKey, pluggyFetch, type Handler } from './_pluggy'

/** Gera um connect token para o widget (Meu Pluggy / bancos). */
export const handler: Handler = async (event) => {
  if (metodo(event) === 'OPTIONS') return cors(204, {})
  if (metodo(event) !== 'POST') return cors(405, { error: 'Use POST' })

  try {
    const apiKey = await pluggyApiKey()
    const data = (await pluggyFetch('/connect_token', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        options: {
          clientUserId: 'sobra-pessoal',
          avoidDuplicates: true,
        },
      }),
    })) as { accessToken: string }

    return cors(200, { accessToken: data.accessToken })
  } catch (erro) {
    return cors(500, { error: erro instanceof Error ? erro.message : 'Erro desconhecido' })
  }
}

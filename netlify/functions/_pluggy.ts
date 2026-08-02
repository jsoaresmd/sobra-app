import type { Handler, HandlerEvent } from '@netlify/functions'

const PLUGGY_API = 'https://api.pluggy.ai'

function cors(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

export async function pluggyApiKey() {
  const clientId = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET não configurados no Netlify. Veja Ajustes → Bancos.',
    )
  }

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`Falha ao autenticar na Pluggy (${res.status}): ${texto}`)
  }
  const data = (await res.json()) as { apiKey: string }
  return data.apiKey
}

export async function pluggyFetch(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`${PLUGGY_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`Pluggy ${path} → ${res.status}: ${texto}`)
  }
  return res.json()
}

export function metodo(event: HandlerEvent) {
  return (event.httpMethod || 'GET').toUpperCase()
}

export function parseBody<T>(event: HandlerEvent): T {
  if (!event.body) return {} as T
  return JSON.parse(event.body) as T
}

export { cors }
export type { Handler }

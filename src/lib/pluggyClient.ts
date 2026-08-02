/** Cliente fino das funções Netlify da Pluggy. */

export type ContaPluggySync = {
  id: string
  itemId: string
  type: string
  subtype: string | null
  name: string
  marketingName: string | null
  balance: number
  number: string | null
  creditData?: {
    balanceCloseDate?: string | null
    balanceDueDate?: string | null
    creditLimit?: number | null
  } | null
}

export type TxPluggySync = {
  id: string
  accountId: string
  itemId: string
  description: string
  descriptionRaw: string | null
  amount: number
  date: string
  category: string | null
  type: string
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
  } | null
}

export type SyncPluggyResultado = {
  sincronizadoEm: string
  dateFrom: string
  contas: ContaPluggySync[]
  transacoes: TxPluggySync[]
}

function apiBase() {
  // Caminho nativo das functions — não depende do redirect /api/*
  return '/.netlify/functions'
}

async function chamar<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const texto = await res.text()
  let data: (T & { error?: string }) | null = null
  if (texto) {
    try {
      data = JSON.parse(texto) as T & { error?: string }
    } catch {
      throw new Error(
        `A API respondeu algo que não é JSON (${res.status}). ` +
          `Provavelmente as functions Netlify não foram publicadas — faça deploy pelo Git ou com netlify deploy --build, não só a pasta dist.`,
      )
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `Erro ${res.status} em ${path}. Body vazio: functions/env ausentes no deploy?`)
  }
  if (!data) {
    throw new Error(
      `Resposta vazia de ${url}. As functions Pluggy não estão no ar neste site. ` +
        `No Netlify, confira Functions e publique o projeto inteiro (com pasta netlify/functions).`,
    )
  }
  return data
}

export async function criarConnectToken() {
  const data = await chamar<{ accessToken: string }>('/pluggy-token', { method: 'POST', body: '{}' })
  return data.accessToken
}

export async function sincronizarPluggy(itemIds: string[], dateFrom?: string) {
  return chamar<SyncPluggyResultado>('/pluggy-sync', {
    method: 'POST',
    body: JSON.stringify({ itemIds, dateFrom }),
  })
}

type PluggyConnectCtor = new (opts: {
  connectToken: string
  includeSandbox?: boolean
  onSuccess: (data: { item: { id: string } }) => void
  onError?: (erro: Error) => void
  onClose?: () => void
}) => { init: () => void; destroy?: () => void }

declare global {
  interface Window {
    PluggyConnect?: PluggyConnectCtor
  }
}

/** Carrega o widget Pluggy Connect sob demanda. */
export async function abrirPluggyConnect(connectToken: string): Promise<string> {
  if (!window.PluggyConnect) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Não consegui carregar o Pluggy Connect.'))
      document.head.appendChild(script)
    })
  }

  const Ctor = window.PluggyConnect
  if (!Ctor) throw new Error('Pluggy Connect não disponível.')

  return new Promise((resolve, reject) => {
    let resolvido = false
    const widget = new Ctor({
      connectToken,
      includeSandbox: false,
      onSuccess: ({ item }) => {
        resolvido = true
        widget.destroy?.()
        resolve(item.id)
      },
      onError: (erro) => {
        resolvido = true
        widget.destroy?.()
        const msg =
          erro instanceof Error
            ? erro.message
            : typeof erro === 'object' && erro && 'message' in erro
              ? String((erro as { message: unknown }).message)
              : 'Falha no Pluggy Connect. No widget, escolha MeuPluggy (não o Nubank direto).'
        reject(new Error(msg))
      },
      onClose: () => {
        if (!resolvido) {
          reject(new Error('Conexão cancelada. No widget, escolha MeuPluggy (não Nubank + CPF).'))
        }
      },
    })
    widget.init()
  })
}

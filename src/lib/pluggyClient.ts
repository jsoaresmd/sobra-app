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
    availableCreditLimit?: number | null
    creditLimit?: number | null
    minimumPayment?: number | null
  } | null
}

/** Fatura de cartão fechada/aberta como o banco informa (produto Bills). */
export type FaturaPluggy = {
  id: string
  accountId: string
  dueDate: string
  billClosingDate: string | null
  totalAmount: number
  minimumPaymentAmount?: number | null
  financeCharges?: Array<{ type: string; amount: number }> | null
  payments?: Array<{ valueType: string; paymentDate: string; paymentMode: string | null; amount: number }> | null
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
  status?: string
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
    totalAmount?: number | null
    purchaseDate?: string | null
    billId?: string | null
    /** Mês da fatura que vai cobrar (YYYY-MM), inclusive para compras pendentes. */
    billMonth?: string | null
  } | null
}

export type SyncPluggyResultado = {
  sincronizadoEm: string
  dateFrom: string
  contas: ContaPluggySync[]
  transacoes: TxPluggySync[]
  faturas?: FaturaPluggy[]
}

export type ItemStatus = {
  itemId: string
  status: string
  executionStatus: string
  lastUpdatedAt: string | null
  conector: string | null
  erro: string | null
  aguardando: string | null
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

/** Pede à Pluggy que busque dados novos no banco (sem isso, a leitura vem da última coleta). */
export async function pedirAtualizacaoPluggy(itemIds: string[]) {
  const data = await chamar<{ itens: ItemStatus[] }>('/pluggy-item', {
    method: 'POST',
    body: JSON.stringify({ itemIds, acao: 'atualizar' }),
  })
  return data.itens
}

export async function statusItensPluggy(itemIds: string[]) {
  const data = await chamar<{ itens: ItemStatus[] }>('/pluggy-item', {
    method: 'POST',
    body: JSON.stringify({ itemIds, acao: 'status' }),
  })
  return data.itens
}

export async function diagnosticoPluggy(itemIds: string[], dias = 45) {
  return chamar<Record<string, unknown>>('/pluggy-diagnostico', {
    method: 'POST',
    body: JSON.stringify({ itemIds, dias }),
  })
}

type PluggyConnectErro = Error & {
  code?: string | number
  codeDescription?: string
  items?: string[]
  data?: { items?: string[]; codeDescription?: string }
}

type PluggyConnectCtor = new (opts: {
  connectToken: string
  includeSandbox?: boolean
  onSuccess: (data: { item: { id: string } }) => void
  onError?: (erro: PluggyConnectErro) => void
  onClose?: () => void
}) => { init: () => void; destroy?: () => void }

declare global {
  interface Window {
    PluggyConnect?: PluggyConnectCtor
  }
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export function extrairItemsDuplicados(erro: unknown): string[] {
  if (!erro) return []
  if (typeof erro === 'string') {
    if (!/ITEM_USER_ALREADY_EXISTS|already exists|item_user_already_exists/i.test(erro)) return []
    return [...new Set(erro.match(UUID_RE) ?? [])]
  }
  if (typeof erro !== 'object') return []
  const e = erro as PluggyConnectErro & Record<string, unknown>
  const candidatos = [e.items, e.data?.items, (e as { itemIds?: string[] }).itemIds]
  for (const c of candidatos) {
    if (Array.isArray(c) && c.length) return [...new Set(c.filter((id) => typeof id === 'string' && id.length > 10))]
  }
  const texto = `${e.message ?? ''} ${e.codeDescription ?? ''} ${JSON.stringify(erro)}`
  if (!/ITEM_USER_ALREADY_EXISTS|already exists|item_user_already_exists|USER_ALREADY/i.test(texto)) {
    // Mesmo sem a frase, se o widget mandar items, já pegamos acima.
    return []
  }
  return [...new Set(texto.match(UUID_RE) ?? [])]
}

export type ConnectResultado = { itemIds: string[]; nova: boolean }

/** Carrega o widget Pluggy Connect sob demanda. */
export async function abrirPluggyConnect(connectToken: string): Promise<ConnectResultado> {
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
        resolve({ itemIds: [item.id], nova: true })
      },
      onError: (erro) => {
        resolvido = true
        widget.destroy?.()
        const duplicados = extrairItemsDuplicados(erro)
        if (duplicados.length > 0) {
          resolve({ itemIds: duplicados, nova: false })
          return
        }
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

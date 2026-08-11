import { db } from './db'
import {
  itensInexistentes,
  pedirAtualizacaoPluggy,
  sincronizarPluggy,
  statusItensPluggy,
  type ItemStatus,
} from './pluggyClient'
import { aplicarSyncPluggy } from './pluggySync'
import { fromISO, toISO } from './dates'
import type { Categoria, Config, Envelope, RegraImportacao } from './types'

type OpcoesSync = {
  /** Ignora a última sync e busca ~90 dias de novo (útil após limpar dados). */
  forcarCompleto?: boolean
  /** Pula o pedido de coleta nova no banco (usado quando já se pediu agora). */
  semAtualizarNoBanco?: boolean
  onProgresso?: (mensagem: string) => void
}

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function emAndamento(item: ItemStatus) {
  return item.status === 'UPDATING' || item.executionStatus === 'CREATED'
}

/**
 * A Pluggy guarda a última coleta e só vai ao banco quando o item é atualizado.
 * Sem esperar essa coleta terminar, a compra de hoje nunca aparece.
 */
async function coletarNoBanco(itemIds: string[], onProgresso?: (m: string) => void) {
  onProgresso?.('Pedindo dados novos ao banco…')
  let itens = await pedirAtualizacaoPluggy(itemIds)

  const limite = Date.now() + 120_000
  while (itens.some(emAndamento) && Date.now() < limite) {
    await espera(5000)
    itens = await statusItensPluggy(itemIds)
    onProgresso?.('O banco está enviando os dados…')
  }

  return itens
}

/**
 * Conexão que a Pluggy não reconhece mais não pode ficar salva: ela trava toda
 * sincronização seguinte. Some do app para que reconectar volte a ser possível.
 */
async function esquecerItens(mortos: string[]) {
  if (mortos.length === 0) return false
  const config = await db.config.get('app')
  const atuais = config?.pluggyItemIds ?? []
  await db.config.update('app', {
    pluggyItemIds: atuais.filter((id) => !mortos.includes(id)),
    pluggyUltimaSync: '',
  })
  return true
}

async function esquecerItensMortos(erro: unknown, itemIds: string[]) {
  return esquecerItens(itensInexistentes(erro, itemIds))
}

function naoExisteMais(item: ItemStatus) {
  return Boolean(item.falhou && /ITEM_NOT_FOUND|404/i.test(item.falhou))
}

/** Sincroniza todos os itemIds salvos na config e aplica no Dexie. */
export async function sincronizarBancosAbertos(
  config: Config,
  envelopes: Envelope[],
  regras: RegraImportacao[],
  hoje: string,
  categorias: Categoria[] = [],
  opcoes: OpcoesSync = {},
) {
  let itemIds = config.pluggyItemIds ?? []
  if (itemIds.length === 0) {
    throw new Error('Conecte um banco em Ajustes → Bancos antes de sincronizar.')
  }

  let itens: ItemStatus[] = []
  if (!opcoes.semAtualizarNoBanco) {
    try {
      itens = await coletarNoBanco(itemIds, opcoes.onProgresso)
    } catch (erro) {
      if (await esquecerItensMortos(erro, itemIds)) {
        throw new Error('Conexão antiga removida. Toque em Conectar banco para refazer.')
      }
      throw erro
    }

    // Conexões apagadas na Pluggy saem da lista; as boas seguem normalmente.
    const mortos = itens.filter(naoExisteMais).map((i) => i.itemId)
    if (mortos.length > 0) {
      await esquecerItens(mortos)
      itemIds = itemIds.filter((id) => !mortos.includes(id))
      itens = itens.filter((i) => !mortos.includes(i.itemId))
      if (itemIds.length === 0) {
        throw new Error('Conexão antiga removida. Toque em Conectar banco para refazer.')
      }
    }

    const precisaAutorizar = itens.find(
      (i) => i.status === 'WAITING_USER_INPUT' || i.status === 'LOGIN_ERROR' || i.status === 'OUTDATED',
    )
    if (precisaAutorizar) {
      throw new Error(
        `O banco pediu nova autorização (${precisaAutorizar.status}). Em Bancos, toque em Conectar banco e refaça o consentimento.`,
      )
    }
  }

  const temContaPluggy = (await db.contas.toArray()).some((c) => c.pluggyAccountId)
  const precisaCompleto = opcoes.forcarCompleto || !temContaPluggy || !config.pluggyUltimaSync

  // Cartão no Open Finance atrasa; sempre olha pelo menos 14 dias para trás.
  let dateFrom: string | undefined
  if (precisaCompleto) {
    dateFrom = undefined
  } else {
    const desde = fromISO(config.pluggyUltimaSync!.slice(0, 10))
    desde.setDate(desde.getDate() - 14)
    dateFrom = toISO(desde)
  }

  opcoes.onProgresso?.('Lendo lançamentos…')
  let pacote
  try {
    pacote = await sincronizarPluggy(itemIds, dateFrom)
  } catch (erro) {
    if (await esquecerItensMortos(erro, itemIds)) {
      throw new Error('Conexão antiga removida. Toque em Conectar banco para refazer.')
    }
    throw erro
  }

  if (pacote.mortos?.length) {
    await esquecerItens(pacote.mortos)
    itemIds = itemIds.filter((id) => !pacote.mortos!.includes(id))
  }

  if (!pacote.contas.length) {
    throw new Error(
      itemIds.length === 0
        ? 'Conexão antiga removida. Toque em Conectar banco para refazer.'
        : 'Conexão sem contas na Pluggy. Reconecte o banco.',
    )
  }

  const resultado = await aplicarSyncPluggy(pacote, envelopes, regras, hoje, categorias)
  return { ...resultado, coletadoEm: itens[0]?.lastUpdatedAt ?? null }
}

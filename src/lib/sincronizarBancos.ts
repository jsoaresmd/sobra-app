import { db } from './db'
import { sincronizarPluggy } from './pluggyClient'
import { aplicarSyncPluggy } from './pluggySync'
import { fromISO, toISO } from './dates'
import type { Categoria, Config, Envelope, RegraImportacao } from './types'

type OpcoesSync = {
  /** Ignora a última sync e busca ~90 dias de novo (útil após limpar dados). */
  forcarCompleto?: boolean
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
  const itemIds = config.pluggyItemIds ?? []
  if (itemIds.length === 0) {
    throw new Error('Conecte um banco em Ajustes → Bancos antes de sincronizar.')
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

  const pacote = await sincronizarPluggy(itemIds, dateFrom)
  if (!pacote.contas.length) {
    throw new Error('Item ID sem contas na Pluggy. Confira se é o ID certo.')
  }

  return aplicarSyncPluggy(pacote, envelopes, regras, hoje, categorias)
}

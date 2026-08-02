import { sincronizarPluggy } from './pluggyClient'
import { aplicarSyncPluggy } from './pluggySync'
import type { Categoria, Config, Envelope, RegraImportacao } from './types'

/** Sincroniza todos os itemIds salvos na config e aplica no Dexie. */
export async function sincronizarBancosAbertos(
  config: Config,
  envelopes: Envelope[],
  regras: RegraImportacao[],
  hoje: string,
  categorias: Categoria[] = [],
) {
  const itemIds = config.pluggyItemIds ?? []
  if (itemIds.length === 0) {
    throw new Error('Conecte um banco em Ajustes → Bancos antes de sincronizar.')
  }

  const desde = config.pluggyUltimaSync?.slice(0, 10)
  const dateFrom = desde
    ? new Date(new Date(desde).getTime() - 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10)
    : undefined

  const pacote = await sincronizarPluggy(itemIds, dateFrom)
  return aplicarSyncPluggy(pacote, envelopes, regras, hoje, categorias)
}

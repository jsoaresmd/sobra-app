import { db } from './db'
import { sincronizarPluggy } from './pluggyClient'
import { aplicarSyncPluggy } from './pluggySync'
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
  const temImportados = (await db.lancamentos.where('origem').equals('importado').count()) > 0
  const precisaCompleto = opcoes.forcarCompleto || !temContaPluggy || !temImportados || !config.pluggyUltimaSync

  const desde = precisaCompleto ? undefined : config.pluggyUltimaSync?.slice(0, 10)
  const dateFrom = desde
    ? new Date(new Date(desde).getTime() - 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10)
    : undefined

  const pacote = await sincronizarPluggy(itemIds, dateFrom)
  if (!pacote.contas.length) {
    throw new Error(
      'Esse Item ID não trouxe nenhuma conta da Pluggy. Confira se copiou o ID da conexão certa (MeuPluggy com Nubank), não de uma demo vazia.',
    )
  }

  return aplicarSyncPluggy(pacote, envelopes, regras, hoje, categorias)
}

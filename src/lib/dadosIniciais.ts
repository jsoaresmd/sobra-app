import { db } from './db'
import { CATEGORIAS_SEED } from './categoriasSeed'
import { METAS_SEED } from './metas'
import type { Config } from './types'

const configVazia = (): Config => ({
  id: 'app',
  renda: 0,
  metaGuardarMes: 0,
  nomesTitular: ['JAIRO ANDRE MEYER SOARES'],
  versao: 2,
})

let inicio: Promise<void> | null = null

/** Cria config e categorias na primeira abertura. A migração do banco antigo roda no Dexie. */
export function garantirDadosIniciais() {
  if (!inicio) {
    inicio = (async () => {
      if (!(await db.config.get('app'))) await db.config.put(configVazia())
      if ((await db.categorias.count()) === 0) await db.categorias.bulkPut(CATEGORIAS_SEED)
      if ((await db.metasModelo.count()) === 0) await db.metasModelo.bulkPut(METAS_SEED)
    })().catch((erro) => {
      inicio = null
      throw erro
    })
  }
  return inicio
}

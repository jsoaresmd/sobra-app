import { CATEGORIAS_SEED } from './categoriasSeed'
import { METAS_SEED } from './metas'
import { semAvisar } from './mudanca'
import { carregarTudo, upsertCategorias, upsertConfig, upsertMetasModelo } from './repo'
import type { Config } from './types'

const configVazia = (): Config => ({
  id: 'app',
  renda: 0,
  metaGuardarMes: 0,
  nomesTitular: ['JAIRO ANDRE MEYER SOARES'],
  versao: 2,
})

let inicio: Promise<void> | null = null

/** Cria config, categorias e metas na primeira entrada após o login. */
export function garantirDadosIniciais() {
  if (!inicio) {
    inicio = semAvisar(async () => {
      const pacote = await carregarTudo()
      if (!pacote.config) await upsertConfig(configVazia())
      if (pacote.categorias.length === 0) await upsertCategorias(CATEGORIAS_SEED)
      if (pacote.metasModelo.length === 0) await upsertMetasModelo(METAS_SEED)
    }).catch((erro) => {
      inicio = null
      throw erro
    })
  }
  return inicio
}

export function resetarSeed() {
  inicio = null
}

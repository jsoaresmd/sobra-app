import { db } from './db'
import { substituirTudo } from './repo'
import type {
  Categoria,
  Compromisso,
  Config,
  Estabelecimento,
  Importacao,
  Lancamento,
  MetaModelo,
  MetaSemana,
  PlanoMes,
  Revisao,
} from './types'

export type ResultadoImportCelular = {
  categorias: number
  estabelecimentos: number
  lancamentos: number
  compromissos: number
  metasModelo: number
  metasSemana: number
  revisoes: number
  planosMes: number
}

/** Lê o IndexedDB legado deste aparelho e sobe tudo para o Supabase (uma vez). */
export async function trazerDadosDesteCelular(): Promise<ResultadoImportCelular> {
  const [
    config,
    categorias,
    estabelecimentos,
    lancamentos,
    compromissos,
    metasModelo,
    metasSemana,
    revisoes,
    importacoes,
    planosMes,
  ] = await Promise.all([
    db.config.get('app'),
    db.categorias.toArray(),
    db.estabelecimentos.toArray(),
    db.lancamentos.toArray(),
    db.compromissos.toArray(),
    db.metasModelo.toArray(),
    db.metasSemana.toArray(),
    db.revisoes.toArray(),
    db.importacoes.toArray(),
    db.planosMes.toArray(),
  ])

  const temAlgo =
    categorias.length +
      estabelecimentos.length +
      lancamentos.length +
      compromissos.length +
      metasModelo.length +
      metasSemana.length +
      revisoes.length +
      planosMes.length >
    0

  if (!temAlgo && !config) {
    throw new Error('Não achei dados do Sobra neste celular.')
  }

  await substituirTudo({
    config: config as Config | undefined,
    categorias: categorias as Categoria[],
    estabelecimentos: estabelecimentos as Estabelecimento[],
    lancamentos: lancamentos as Lancamento[],
    compromissos: compromissos as Compromisso[],
    metasModelo: metasModelo as MetaModelo[],
    metasSemana: metasSemana as MetaSemana[],
    revisoes: revisoes as Revisao[],
    importacoes: importacoes as Importacao[],
    planosMes: planosMes as PlanoMes[],
  })

  try {
    await db.delete()
  } catch {
    // IndexedDB legado pode já ter sumido.
  }

  return {
    categorias: categorias.length,
    estabelecimentos: estabelecimentos.length,
    lancamentos: lancamentos.length,
    compromissos: compromissos.length,
    metasModelo: metasModelo.length,
    metasSemana: metasSemana.length,
    revisoes: revisoes.length,
    planosMes: planosMes.length,
  }
}

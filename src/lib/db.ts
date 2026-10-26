import Dexie, { type EntityTable, type Transaction } from 'dexie'
import { CATEGORIAS_SEED } from './categoriasSeed'
import {
  compromissosDoLegado,
  configAPartirDoLegado,
  estabelecimentosDoLegado,
  type DumpLegado,
} from './migrarLegado'
import type {
  BackupLegado,
  Categoria,
  Compromisso,
  Config,
  Estabelecimento,
  Importacao,
  Lancamento,
  MetaModelo,
  MetaSemana,
  Revisao,
} from './types'

class SobraDB extends Dexie {
  config!: EntityTable<Config, 'id'>
  categorias!: EntityTable<Categoria, 'id'>
  estabelecimentos!: EntityTable<Estabelecimento, 'id'>
  lancamentos!: EntityTable<Lancamento, 'id'>
  compromissos!: EntityTable<Compromisso, 'id'>
  metasModelo!: EntityTable<MetaModelo, 'id'>
  metasSemana!: EntityTable<MetaSemana, 'id'>
  revisoes!: EntityTable<Revisao, 'id'>
  importacoes!: EntityTable<Importacao, 'id'>
  backupLegado!: EntityTable<BackupLegado, 'id'>

  constructor() {
    super('sobra')
    this.version(1).stores({
      config: 'id',
      contas: 'id, ordem, tipo',
      categorias: 'id, ordem, grupo',
      lancamentos: 'id, data, categoriaId, contaId, pessoaId, grupoParcelaId, recorrenteId, [data+tipo]',
      recorrentes: 'id, ativo, diaDoMes',
    })
    this.version(2).stores({
      config: 'id',
      contas: 'id, ordem, tipo',
      categorias: 'id, ordem, grupo',
      lancamentos: 'id, data, categoriaId, contaId, pessoaId, envelopeId, grupoParcelaId, recorrenteId, [data+tipo]',
      recorrentes: 'id, ativo, diaDoMes',
      envelopes: 'id, ordem, tipo, categoriaId, recorrenteId',
      movimentosEnvelope: 'id, envelopeId, data, tipo, lancamentoId',
    })
    this.version(3).stores({
      config: 'id',
      contas: 'id, ordem, tipo',
      categorias: 'id, ordem, grupo',
      lancamentos:
        'id, data, categoriaId, contaId, pessoaId, envelopeId, grupoParcelaId, recorrenteId, importFingerprint, [data+tipo]',
      recorrentes: 'id, ativo, diaDoMes',
      envelopes: 'id, ordem, tipo, categoriaId, recorrenteId',
      movimentosEnvelope: 'id, envelopeId, data, tipo, lancamentoId',
      regrasImportacao: 'id, chave, envelopeId, categoriaId',
    })
    this.version(4).stores({
      config: 'id',
      contas: 'id, ordem, tipo, pluggyAccountId',
      categorias: 'id, ordem, grupo',
      lancamentos:
        'id, data, categoriaId, contaId, pessoaId, envelopeId, grupoParcelaId, recorrenteId, importFingerprint, [data+tipo]',
      recorrentes: 'id, ativo, diaDoMes',
      envelopes: 'id, ordem, tipo, categoriaId, recorrenteId',
      movimentosEnvelope: 'id, envelopeId, data, tipo, lancamentoId',
      regrasImportacao: 'id, chave, envelopeId, categoriaId',
    })
    // Versão 5 ainda enxerga as tabelas antigas: o upgrade copia regras e
    // recorrentes antes da versão 6 apagá-las.
    this.version(5)
      .stores({
        config: 'id',
        contas: 'id, ordem, tipo, pluggyAccountId',
        categorias: 'id, ordem, tipo, arquivada',
        lancamentos: 'id, data, categoriaId, origem, chaveDedup, idBanco, compromissoId, estabelecimentoChave',
        recorrentes: 'id, ativo, diaDoMes',
        envelopes: 'id, ordem, tipo, categoriaId, recorrenteId',
        movimentosEnvelope: 'id, envelopeId, data, tipo, lancamentoId',
        regrasImportacao: 'id, chave, envelopeId, categoriaId',
        estabelecimentos: 'id, &chaveNormalizada, categoriaId, compromissoId',
        compromissos: 'id, tipo, categoriaId, divida',
        metasModelo: 'id',
        metasSemana: 'id, semana, modeloId',
        revisoes: 'id, semanaInicio',
        importacoes: 'id, data',
        backupLegado: 'id',
      })
      .upgrade((tx) => migrarParaRevisaoSemanal(tx))
    this.version(6).stores({
      config: 'id',
      categorias: 'id, ordem, tipo, arquivada',
      estabelecimentos: 'id, &chaveNormalizada, categoriaId, compromissoId',
      lancamentos: 'id, data, categoriaId, origem, chaveDedup, idBanco, compromissoId, estabelecimentoChave',
      compromissos: 'id, tipo, categoriaId, divida',
      metasModelo: 'id',
      metasSemana: 'id, semana, modeloId',
      revisoes: 'id, semanaInicio',
      importacoes: 'id, data',
      backupLegado: 'id',
    })
  }
}

async function lerTabela(tx: Transaction, nome: string) {
  try {
    return await tx.table(nome).toArray()
  } catch {
    return []
  }
}

async function migrarParaRevisaoSemanal(tx: Transaction) {
  const dump: DumpLegado & Record<string, unknown> = {
    config: (await lerTabela(tx, 'config'))[0] as DumpLegado['config'],
    categorias: await lerTabela(tx, 'categorias'),
    envelopes: await lerTabela(tx, 'envelopes'),
    regrasImportacao: await lerTabela(tx, 'regrasImportacao'),
    recorrentes: await lerTabela(tx, 'recorrentes'),
    contas: await lerTabela(tx, 'contas'),
    lancamentos: await lerTabela(tx, 'lancamentos'),
    movimentosEnvelope: await lerTabela(tx, 'movimentosEnvelope'),
  }

  await tx.table('backupLegado').put({
    id: 'pre-sobra-2',
    criadoEm: new Date().toISOString(),
    json: JSON.stringify({
      app: 'sobra',
      versao: 1,
      modelo: 'legado',
      exportadoEm: new Date().toISOString(),
      ...dump,
    }),
  })

  await tx.table('lancamentos').clear()
  await tx.table('categorias').clear()
  await tx.table('categorias').bulkAdd(CATEGORIAS_SEED)
  await tx.table('config').put(configAPartirDoLegado(dump.config))

  const lojas = estabelecimentosDoLegado(dump)
  if (lojas.length) await tx.table('estabelecimentos').bulkAdd(lojas)

  const compromissos = compromissosDoLegado(dump)
  if (compromissos.length) await tx.table('compromissos').bulkAdd(compromissos)
}

export const db = new SobraDB()

export function novoId() {
  return crypto.randomUUID()
}

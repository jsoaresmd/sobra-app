import Dexie, { type EntityTable } from 'dexie'
import type {
  Categoria,
  Conta,
  Config,
  Envelope,
  Lancamento,
  MovimentoEnvelope,
  Recorrente,
  RegraImportacao,
} from './types'

class SobraDB extends Dexie {
  config!: EntityTable<Config, 'id'>
  contas!: EntityTable<Conta, 'id'>
  categorias!: EntityTable<Categoria, 'id'>
  lancamentos!: EntityTable<Lancamento, 'id'>
  recorrentes!: EntityTable<Recorrente, 'id'>
  envelopes!: EntityTable<Envelope, 'id'>
  movimentosEnvelope!: EntityTable<MovimentoEnvelope, 'id'>
  regrasImportacao!: EntityTable<RegraImportacao, 'id'>

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
  }
}

export const db = new SobraDB()

export function novoId() {
  return crypto.randomUUID()
}

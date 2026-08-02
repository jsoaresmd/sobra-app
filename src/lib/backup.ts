import { db } from './db'
import type {
  Categoria,
  Config,
  Conta,
  Envelope,
  Lancamento,
  MovimentoEnvelope,
  Recorrente,
  RegraImportacao,
} from './types'

type Backup = {
  app: 'sobra'
  versao: 2 | 3
  exportadoEm: string
  config: Config | undefined
  contas: Conta[]
  categorias: Categoria[]
  envelopes: Envelope[]
  movimentosEnvelope: MovimentoEnvelope[]
  lancamentos: Lancamento[]
  recorrentes: Recorrente[]
  regrasImportacao?: RegraImportacao[]
}

export async function montarBackup(): Promise<Backup> {
  const [config, contas, categorias, envelopes, movimentosEnvelope, lancamentos, recorrentes, regrasImportacao] =
    await Promise.all([
      db.config.get('app'),
      db.contas.toArray(),
      db.categorias.toArray(),
      db.envelopes.toArray(),
      db.movimentosEnvelope.toArray(),
      db.lancamentos.toArray(),
      db.recorrentes.toArray(),
      db.regrasImportacao.toArray(),
    ])

  return {
    app: 'sobra',
    versao: 3,
    exportadoEm: new Date().toISOString(),
    config,
    contas,
    categorias,
    envelopes,
    movimentosEnvelope,
    lancamentos,
    recorrentes,
    regrasImportacao,
  }
}

export async function baixarBackup() {
  const backup = await montarBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dia = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `sobra-backup-${dia}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function restaurarBackup(arquivo: File) {
  const texto = await arquivo.text()
  const dados = JSON.parse(texto) as Backup

  if (dados.app !== 'sobra') throw new Error('Este arquivo não é um backup do Sobra.')

  await db.transaction('rw', db.tables, async () => {
    await Promise.all([
      db.config.clear(),
      db.contas.clear(),
      db.categorias.clear(),
      db.envelopes.clear(),
      db.movimentosEnvelope.clear(),
      db.lancamentos.clear(),
      db.recorrentes.clear(),
      db.regrasImportacao.clear(),
    ])
    if (dados.config) await db.config.put(dados.config)
    await db.contas.bulkPut(dados.contas ?? [])
    await db.categorias.bulkPut(dados.categorias ?? [])
    await db.envelopes.bulkPut(dados.envelopes ?? [])
    await db.movimentosEnvelope.bulkPut(dados.movimentosEnvelope ?? [])
    await db.lancamentos.bulkPut(dados.lancamentos ?? [])
    await db.recorrentes.bulkPut(dados.recorrentes ?? [])
    await db.regrasImportacao.bulkPut(dados.regrasImportacao ?? [])
  })
}

export async function apagarTudo() {
  await db.delete()
  location.reload()
}

import { db } from './db'
import { CATEGORIAS_SEED } from './categoriasSeed'
import { configAPartirDoLegado, compromissosDoLegado, estabelecimentosDoLegado } from './migrarLegado'
import type { Config } from './types'

type BackupNovo = {
  app: 'sobra'
  versao: 20
  exportadoEm: string
  config: Config | undefined
  categorias: unknown[]
  estabelecimentos: unknown[]
  lancamentos: unknown[]
  compromissos: unknown[]
  metasModelo: unknown[]
  metasSemana: unknown[]
  revisoes: unknown[]
  importacoes: unknown[]
}

function baixarJson(nome: string, dados: unknown) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  URL.revokeObjectURL(url)
}

export async function montarBackup(): Promise<BackupNovo> {
  const [config, categorias, estabelecimentos, lancamentos, compromissos, metasModelo, metasSemana, revisoes, importacoes] =
    await Promise.all([
      db.config.get('app'),
      db.categorias.toArray(),
      db.estabelecimentos.toArray(),
      db.lancamentos.toArray(),
      db.compromissos.toArray(),
      db.metasModelo.toArray(),
      db.metasSemana.toArray(),
      db.revisoes.toArray(),
      db.importacoes.toArray(),
    ])

  return {
    app: 'sobra',
    versao: 20,
    exportadoEm: new Date().toISOString(),
    config,
    categorias,
    estabelecimentos,
    lancamentos,
    compromissos,
    metasModelo,
    metasSemana,
    revisoes,
    importacoes,
  }
}

export async function baixarBackup() {
  const dia = new Date().toISOString().slice(0, 10)
  baixarJson(`sobra-backup-${dia}.json`, await montarBackup())
}

export async function baixarBackupLegado() {
  const legado = await db.backupLegado.get('pre-sobra-2')
  if (!legado) throw new Error('Não há cópia da versão anterior neste aparelho.')
  baixarJson(`sobra-legado-${legado.criadoEm.slice(0, 10)}.json`, JSON.parse(legado.json))
}

export async function restaurarBackup(arquivo: File) {
  const dados = JSON.parse(await arquivo.text()) as BackupNovo & {
    versao?: number
    regrasImportacao?: unknown[]
    recorrentes?: unknown[]
    envelopes?: unknown[]
    categorias?: unknown[]
    config?: Config & { rendaMensal?: number }
  }
  if (dados.app !== 'sobra') throw new Error('Este arquivo não é um backup do Sobra.')

  if (dados.versao === 20) {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.filter((t) => t.name !== 'backupLegado').map((t) => t.clear()))
      if (dados.config) await db.config.put(dados.config)
      await db.categorias.bulkPut((dados.categorias ?? []) as never[])
      await db.estabelecimentos.bulkPut((dados.estabelecimentos ?? []) as never[])
      await db.lancamentos.bulkPut((dados.lancamentos ?? []) as never[])
      await db.compromissos.bulkPut((dados.compromissos ?? []) as never[])
      await db.metasModelo.bulkPut((dados.metasModelo ?? []) as never[])
      await db.metasSemana.bulkPut((dados.metasSemana ?? []) as never[])
      await db.revisoes.bulkPut((dados.revisoes ?? []) as never[])
      await db.importacoes.bulkPut((dados.importacoes ?? []) as never[])
    })
    return
  }

  const dump = {
    config: dados.config,
    categorias: dados.categorias as never[],
    envelopes: dados.envelopes as never[],
    regrasImportacao: dados.regrasImportacao as never[],
    recorrentes: dados.recorrentes as never[],
  }
  await db.transaction('rw', [db.config, db.categorias, db.estabelecimentos, db.compromissos, db.backupLegado], async () => {
    await db.backupLegado.put({
      id: 'pre-sobra-2',
      criadoEm: new Date().toISOString(),
      json: JSON.stringify(dados),
    })
    await db.config.put(configAPartirDoLegado(dump.config))
    if ((await db.categorias.count()) === 0) await db.categorias.bulkPut(CATEGORIAS_SEED)
    await db.estabelecimentos.bulkPut(estabelecimentosDoLegado(dump))
    await db.compromissos.bulkPut(compromissosDoLegado(dump))
  })
}

export async function apagarTudo() {
  await db.delete()
  location.reload()
}

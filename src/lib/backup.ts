import { CATEGORIAS_SEED } from './categoriasSeed'
import { db } from './db'
import { configAPartirDoLegado, compromissosDoLegado, estabelecimentosDoLegado } from './migrarLegado'
import { apagarTodosOsDadosRemotos, carregarTudo, substituirTudo } from './repo'
import { supabase } from './supabase'
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
  planosMes: unknown[]
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
  const pacote = await carregarTudo()
  return {
    app: 'sobra',
    versao: 20,
    exportadoEm: new Date().toISOString(),
    config: pacote.config,
    categorias: pacote.categorias,
    estabelecimentos: pacote.estabelecimentos,
    lancamentos: pacote.lancamentos,
    compromissos: pacote.compromissos,
    metasModelo: pacote.metasModelo,
    metasSemana: pacote.metasSemana,
    revisoes: pacote.revisoes,
    importacoes: pacote.importacoes,
    planosMes: pacote.planosMes,
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
    await substituirTudo({
      config: dados.config,
      categorias: (dados.categorias ?? []) as never[],
      estabelecimentos: (dados.estabelecimentos ?? []) as never[],
      lancamentos: (dados.lancamentos ?? []) as never[],
      compromissos: (dados.compromissos ?? []) as never[],
      metasModelo: (dados.metasModelo ?? []) as never[],
      metasSemana: (dados.metasSemana ?? []) as never[],
      revisoes: (dados.revisoes ?? []) as never[],
      importacoes: (dados.importacoes ?? []) as never[],
      planosMes: ((dados as BackupNovo).planosMes ?? []) as never[],
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
  const config = configAPartirDoLegado(dump.config)
  const estabelecimentos = estabelecimentosDoLegado(dump)
  const compromissos = compromissosDoLegado(dump)
  await substituirTudo({
    config,
    categorias: CATEGORIAS_SEED,
    estabelecimentos,
    lancamentos: [],
    compromissos,
    metasModelo: [],
    metasSemana: [],
    revisoes: [],
    importacoes: [],
    planosMes: [],
  })
}

export async function apagarTudo() {
  await apagarTodosOsDadosRemotos()
  await supabase.auth.signOut()
  location.reload()
}

import { CATEGORIAS_SEED, categoriaIdPorNomeAntigo } from './categoriasSeed'
import type { Compromisso, Config, Estabelecimento } from './types'

type RegraAntiga = {
  id: string
  chave: string
  nomeExibido: string
  envelopeId: string | null
  categoriaId: string | null
}

type RecorrenteAntigo = {
  id: string
  descricao: string
  tipo: string
  valor: number
  diaDoMes: number
  ativo: boolean
}

type NomeAntigo = { id: string; nome: string; categoriaId?: string | null }

export type DumpLegado = {
  config?: { rendaMensal?: number; metaPoupanca?: number } | null
  categorias?: NomeAntigo[]
  envelopes?: NomeAntigo[]
  regrasImportacao?: RegraAntiga[]
  recorrentes?: RecorrenteAntigo[]
}

export function configAPartirDoLegado(antiga: DumpLegado['config']): Config {
  return {
    id: 'app',
    renda: antiga?.rendaMensal ?? 0,
    metaGuardarMes: antiga?.metaPoupanca ?? 0,
    nomesTitular: ['JAIRO ANDRE MEYER SOARES'],
    versao: 2,
  }
}

function nomeDaRegra(regra: RegraAntiga, dump: DumpLegado) {
  const envelope = dump.envelopes?.find((e) => e.id === regra.envelopeId)
  if (envelope?.nome) return envelope.nome
  const categoria = dump.categorias?.find((c) => c.id === regra.categoriaId)
  if (categoria?.nome) return categoria.nome
  const peloEnvelope = dump.envelopes?.find((e) => e.categoriaId && e.categoriaId === regra.categoriaId)
  return peloEnvelope?.nome ?? null
}

export function estabelecimentosDoLegado(dump: DumpLegado): Estabelecimento[] {
  const vistos = new Set<string>()
  const saida: Estabelecimento[] = []
  for (const regra of dump.regrasImportacao ?? []) {
    const chave = regra.chave?.trim()
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    saida.push({
      id: regra.id,
      chaveNormalizada: chave,
      textoOriginal: regra.nomeExibido || chave,
      apelido: '',
      nota: '',
      categoriaId: categoriaIdPorNomeAntigo(nomeDaRegra(regra, dump)),
    })
  }
  return saida
}

export function compromissosDoLegado(dump: DumpLegado): Compromisso[] {
  return (dump.recorrentes ?? [])
    .filter((r) => r.tipo === 'despesa')
    .map((r) => ({
      id: r.id,
      nome: r.descricao,
      apelido: '',
      tipo: 'fixo' as const,
      valor: r.valor,
      dia: r.diaDoMes,
      categoriaId: categoriaIdPorNomeAntigo(r.descricao),
      divida: false,
    }))
}

export { CATEGORIAS_SEED }

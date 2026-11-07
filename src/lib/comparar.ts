import { idsDoGrupo } from './categorias'
import { inicioDaSemana, naSemana, rotuloSemana, semanaAnterior } from './semana'
import type { Categoria, Lancamento } from './types'

const IGNORAR = new Set(['cat-ignorar', 'cat-renda'])

function contaNoTotal(linha: Lancamento) {
  return linha.sinal === 'saida' && !!linha.categoriaId && !IGNORAR.has(linha.categoriaId)
}

export function totalDaSemana(
  lancamentos: readonly Lancamento[],
  semana: string,
  categoriaId?: string,
  categorias?: readonly Categoria[],
) {
  const ids =
    categoriaId && categorias ? new Set(idsDoGrupo(categoriaId, categorias)) : categoriaId ? new Set([categoriaId]) : null
  return lancamentos.reduce((total, linha) => {
    if (!naSemana(linha.data, semana) || !contaNoTotal(linha)) return total
    if (ids && (!linha.categoriaId || !ids.has(linha.categoriaId))) return total
    return total + linha.valor
  }, 0)
}

export function serieOitoSemanas(
  lancamentos: readonly Lancamento[],
  semanaFinal: string,
  categoriaId?: string,
  categorias?: readonly Categoria[],
) {
  const serie: { semana: string; rotulo: string; total: number }[] = []
  let cursor = inicioDaSemana(semanaFinal)
  for (let i = 0; i < 8; i++) {
    serie.unshift({
      semana: cursor,
      rotulo: rotuloSemana(cursor),
      total: totalDaSemana(lancamentos, cursor, categoriaId, categorias),
    })
    cursor = semanaAnterior(cursor)
  }
  return serie
}

export function maioresGastos(lancamentos: readonly Lancamento[], semana: string, limite = 5) {
  return lancamentos
    .filter((linha) => naSemana(linha.data, semana) && contaNoTotal(linha))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite)
}

export function maioresCrescimentos(lancamentos: readonly Lancamento[], semana: string) {
  const somar = (alvo: string) => {
    const mapa = new Map<string, number>()
    for (const linha of lancamentos) {
      if (!naSemana(linha.data, alvo) || !contaNoTotal(linha)) continue
      mapa.set(linha.estabelecimentoChave, (mapa.get(linha.estabelecimentoChave) ?? 0) + linha.valor)
    }
    return mapa
  }
  const atual = somar(semana)
  const anterior = somar(semanaAnterior(semana))
  return [...atual.entries()]
    .map(([chave, valor]) => ({ chave, valor, delta: valor - (anterior.get(chave) ?? 0) }))
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)
}

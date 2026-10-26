import { fimDaSemana, inicioDaSemana, semanasEntre } from './semana'
import type { Categoria, Lancamento } from './types'

export type LinhaPlacar = {
  categoriaId: string
  base: number
  /** Quanto a semana passada estourou e esta semana desconta. */
  desconto: number
  teto: number
  gasto: number
  /** Positivo sobrou. Negativo passou. */
  sobra: number
}

type Gasto = Pick<Lancamento, 'data' | 'valor' | 'sinal' | 'categoriaId' | 'compromissoId'>

/** Teto semanal = teto mensal × 12 ÷ 52, arredondado. */
export function tetoBase(tetoMensal: number) {
  return Math.round((tetoMensal * 12) / 52)
}

export function tom(gasto: number, teto: number): 'ok' | 'alerta' | 'estouro' {
  if (gasto > teto) return 'estouro'
  if (teto <= 0) return gasto > 0 ? 'estouro' : 'ok'
  if (gasto / teto >= 0.8) return 'alerta'
  return 'ok'
}

export function gastoDaCategoria(lancamentos: readonly Gasto[], categoriaId: string, inicio: string, fim: string) {
  let total = 0
  for (const linha of lancamentos) {
    if (linha.categoriaId !== categoriaId || linha.compromissoId) continue
    if (linha.data < inicio || linha.data > fim) continue
    total += linha.sinal === 'entrada' ? -linha.valor : linha.valor
  }
  return total
}

function categoriasSemanais(categorias: readonly Categoria[]) {
  return categorias.filter((categoria) => categoria.tipo === 'semanal' && !categoria.arquivada)
}

/**
 * Sobra não acumula. Estouro desconta das semanas seguintes até zerar,
 * inclusive quando o estouro é maior que o teto base.
 */
export function placarPorSemana(
  categorias: readonly Categoria[],
  lancamentos: readonly Gasto[],
  daSemana: string,
  ateSemana: string,
) {
  const semanais = categoriasSemanais(categorias)
  const desconto = new Map<string, number>()
  const resultado = new Map<string, LinhaPlacar[]>()

  for (const semana of semanasEntre(daSemana, ateSemana)) {
    const fim = fimDaSemana(semana)
    const linhas: LinhaPlacar[] = []
    for (const categoria of semanais) {
      const base = tetoBase(categoria.tetoMensal)
      const anterior = desconto.get(categoria.id) ?? 0
      const teto = base - anterior
      const gasto = gastoDaCategoria(lancamentos, categoria.id, semana, fim)
      const sobra = teto - gasto
      desconto.set(categoria.id, sobra < 0 ? -sobra : 0)
      linhas.push({ categoriaId: categoria.id, base, desconto: anterior, teto, gasto, sobra })
    }
    resultado.set(inicioDaSemana(semana), linhas)
  }
  return resultado
}

export function placarDaSemana(
  categorias: readonly Categoria[],
  lancamentos: readonly Gasto[],
  semana: string,
) {
  const datas = lancamentos.map((linha) => linha.data).filter(Boolean).sort()
  const inicio = datas[0] && datas[0] < semana ? datas[0] : semana
  return placarPorSemana(categorias, lancamentos, inicio, semana).get(inicioDaSemana(semana)) ?? []
}

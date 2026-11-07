import { valeNoMes } from './compromissos'
import { gastoCreditoNoMes } from './planoMes'
import type { Categoria, Compromisso, Lancamento, PlanoMes } from './types'

export type ResumoDoMes = {
  rendaFixa: number
  extras: number
  renda: number
  compromissos: number
  semanal: number
  mensais: number
  sobra: number
  guardado: number
  meta: number
  creditoGasto: number
  tetoCredito: number
  creditoSobra: number
  modo: PlanoMes['modo']
  faturaAPagar: number
}

function gasto(
  lancamentos: readonly Lancamento[],
  ids: Set<string>,
  mes: string,
  semCompromisso: boolean,
) {
  let total = 0
  for (const linha of lancamentos) {
    if (!linha.data.startsWith(mes) || !linha.categoriaId || !ids.has(linha.categoriaId)) continue
    if (semCompromisso && linha.compromissoId) continue
    total += linha.sinal === 'entrada' ? -linha.valor : linha.valor
  }
  return total
}

export function resumoDoMes(
  mes: string,
  categorias: readonly Categoria[],
  lancamentos: readonly Lancamento[],
  compromissos: readonly Compromisso[],
  rendaFixa: number,
  plano: Pick<PlanoMes, 'modo' | 'metaGuardar' | 'tetoCredito' | 'faturaAPagar'>,
): ResumoDoMes {
  const ids = (tipo: Categoria['tipo']) =>
    new Set(categorias.filter((categoria) => categoria.tipo === tipo).map((c) => c.id))
  const extras = gasto(lancamentos, ids('renda'), mes, false) * -1
  const semanal = gasto(lancamentos, ids('semanal'), mes, true)
  const mensais = gasto(lancamentos, ids('mensal'), mes, true)
  const guardado = gasto(lancamentos, ids('investimento'), mes, false)
  const comprometido = compromissos
    .filter((item) => valeNoMes(item, mes))
    .reduce((total, item) => total + item.valor, 0)
  const renda = rendaFixa + Math.max(0, extras)
  const creditoGasto = gastoCreditoNoMes(lancamentos, mes)
  const tetoCredito = plano.tetoCredito
  return {
    rendaFixa,
    extras: Math.max(0, extras),
    renda,
    compromissos: comprometido,
    semanal,
    mensais,
    sobra: renda - comprometido - semanal - mensais,
    guardado,
    meta: plano.metaGuardar,
    creditoGasto,
    tetoCredito,
    creditoSobra: tetoCredito - creditoGasto,
    modo: plano.modo,
    faturaAPagar: plano.faturaAPagar ?? 0,
  }
}

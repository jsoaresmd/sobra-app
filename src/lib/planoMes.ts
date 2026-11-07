import { db } from './db'
import type { Config, Lancamento, PlanoMes } from './types'

const IGNORAR = 'cat-ignorar'

export function planoPadrao(mes: string, config?: Pick<Config, 'metaGuardarMes'> | null): PlanoMes {
  return {
    id: mes,
    mes,
    modo: 'guardar',
    metaGuardar: config?.metaGuardarMes ?? 0,
    tetoCredito: 0,
    notas: '',
  }
}

export function planoDoMes(planos: readonly PlanoMes[], mes: string, config?: Pick<Config, 'metaGuardarMes'> | null) {
  return planos.find((plano) => plano.mes === mes || plano.id === mes) ?? planoPadrao(mes, config)
}

/** Cria o plano no banco se ainda não existir. */
export async function garantirPlanoMes(mes: string) {
  const existente = await db.planosMes.get(mes)
  if (existente) return existente
  const config = await db.config.get('app')
  const plano = planoPadrao(mes, config)
  await db.planosMes.put(plano)
  return plano
}

export async function salvarPlanoMes(mudancas: Partial<PlanoMes> & { mes: string }) {
  const atual = (await db.planosMes.get(mudancas.mes)) ?? planoPadrao(mudancas.mes, await db.config.get('app'))
  const plano: PlanoMes = {
    ...atual,
    ...mudancas,
    id: mudancas.mes,
    mes: mudancas.mes,
  }
  await db.planosMes.put(plano)
  return plano
}

/** Soma do cartão no mês: o que monta a próxima fatura. */
export function gastoCreditoNoMes(lancamentos: readonly Lancamento[], mes: string) {
  let total = 0
  for (const linha of lancamentos) {
    if (linha.origem !== 'cartao' || !linha.data.startsWith(mes)) continue
    if (linha.categoriaId === IGNORAR) continue
    total += linha.sinal === 'entrada' ? -linha.valor : linha.valor
  }
  return total
}

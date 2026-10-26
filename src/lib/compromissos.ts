import type { Compromisso } from './types'

/** Quanto ainda falta, incluindo a parcela que está em aberto. */
export function faltaPagar(compromisso: Compromisso) {
  if (compromisso.divida && compromisso.saldoDevedor != null) return Math.max(0, compromisso.saldoDevedor)
  if (compromisso.parcelaAtual && compromisso.parcelasTotal) {
    const restantes = Math.max(0, compromisso.parcelasTotal - compromisso.parcelaAtual + 1)
    return compromisso.valor * restantes
  }
  if (compromisso.parcelasRestantes != null) return compromisso.valor * compromisso.parcelasRestantes
  return null
}

export function valeNoMes(compromisso: Compromisso, mes: string) {
  if (compromisso.divida && (compromisso.saldoDevedor ?? 0) <= 0) return false
  if (compromisso.tipo !== 'fixo' && compromisso.mesFinal && mes > compromisso.mesFinal) return false
  return true
}

/** Simula o término. Se a parcela não cobre os juros, não quita. */
export function previsaoTermino(compromisso: Compromisso) {
  if (compromisso.parcelasRestantes != null && !(compromisso.jurosMes && compromisso.jurosMes > 0)) {
    return { meses: compromisso.parcelasRestantes, quita: compromisso.parcelasRestantes >= 0 }
  }
  if (compromisso.saldoDevedor == null) return null
  let saldo = compromisso.saldoDevedor
  const juros = (compromisso.jurosMes ?? 0) / 100
  const parcela = compromisso.valor
  if (parcela <= 0) return { meses: 0, quita: saldo <= 0 }
  let meses = 0
  while (saldo > 0.009 && meses < 600) {
    const encargo = saldo * juros
    if (parcela <= encargo + 0.009 && juros > 0) return { meses, quita: false }
    saldo = saldo + encargo - parcela
    meses += 1
  }
  return { meses, quita: saldo <= 0.009 }
}

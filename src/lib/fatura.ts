import { addMonths, getDaysInMonth } from 'date-fns'
import { fromISO, toISO } from './dates'
import type { Config, Conta, Lancamento, Recorrente } from './types'

export type Fatura = {
  conta: Conta
  /** Fatura que ainda está acumulando compras. */
  aberta: number
  fechaEm: string
  venceEmAberta: string
  diasParaFechar: number
  /** Fatura já fechada e ainda não vencida. */
  fechada: number
  venceEmFechada: string
  /** Compras já feitas que só entram nas faturas seguintes (parcelas). */
  futuras: number
  limiteUsado: number | null
  /** True quando o valor veio do que foi conferido no app do banco. */
  usandoValorInformado: boolean
}

function comDia(base: Date, dia: number) {
  const noMes = getDaysInMonth(base)
  return new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(dia, 1), noMes))
}

/** Última ocorrência do dia `dia` que seja menor ou igual a `ref`. */
export function ultimaOcorrencia(ref: Date, dia: number) {
  const candidato = comDia(ref, dia)
  if (candidato <= ref) return candidato
  return comDia(addMonths(ref, -1), dia)
}

/** Primeira ocorrência do dia `dia` estritamente depois de `ref`. */
export function proximaOcorrencia(ref: Date, dia: number) {
  const candidato = comDia(ref, dia)
  if (candidato > ref) return candidato
  return comDia(addMonths(ref, 1), dia)
}

export function diasAte(alvoISO: string, hojeISO: string) {
  const alvo = fromISO(alvoISO).getTime()
  const hoje = fromISO(hojeISO).getTime()
  return Math.round((alvo - hoje) / 86400000)
}

export function calcularFatura(conta: Conta, lancamentos: Lancamento[], hojeISO: string): Fatura | null {
  if (conta.tipo !== 'credito' || !conta.diaFechamento || !conta.diaVencimento) return null

  const hoje = fromISO(hojeISO)
  const ultimoFechamento = ultimaOcorrencia(hoje, conta.diaFechamento)
  const proximoFechamento = proximaOcorrencia(ultimoFechamento, conta.diaFechamento)
  const fechamentoAnterior = ultimaOcorrencia(new Date(ultimoFechamento.getTime() - 86400000), conta.diaFechamento)

  const doCartao = lancamentos.filter((l) => l.contaId === conta.id && l.tipo === 'despesa')

  const somaEntre = (deExclusivo: string, ateInclusivo: string) =>
    doCartao.filter((l) => l.data > deExclusivo && l.data <= ateInclusivo).reduce((total, l) => total + l.valor, 0)

  const inicioAberta = toISO(ultimoFechamento)
  const fimAberta = toISO(proximoFechamento)

  const informadoVale =
    conta.faturaInformada !== undefined &&
    conta.faturaInformadaEm !== undefined &&
    conta.faturaInformadaEm > inicioAberta &&
    conta.faturaInformadaEm <= fimAberta

  const aberta = informadoVale
    ? conta.faturaInformada! + somaEntre(conta.faturaInformadaEm!, fimAberta)
    : somaEntre(inicioAberta, fimAberta)

  const fechada = somaEntre(toISO(fechamentoAnterior), inicioAberta)
  const futuras = doCartao.filter((l) => l.data > fimAberta).reduce((total, l) => total + l.valor, 0)

  const venceEmFechada = proximaOcorrencia(ultimoFechamento, conta.diaVencimento)
  const venceEmAberta = proximaOcorrencia(proximoFechamento, conta.diaVencimento)

  return {
    conta,
    aberta,
    fechaEm: fimAberta,
    venceEmAberta: toISO(venceEmAberta),
    diasParaFechar: diasAte(fimAberta, hojeISO),
    fechada: venceEmFechada >= hoje ? fechada : 0,
    venceEmFechada: toISO(venceEmFechada),
    futuras,
    limiteUsado: conta.limite ? (aberta + fechada + futuras) / conta.limite : null,
    usandoValorInformado: informadoVale,
  }
}

export type TermometroFatura = {
  fatura: Fatura
  teto: number
  /** Quanto ainda cabe antes de estourar o teto (pode ser negativo). */
  espaco: number
  porDia: number
  percentual: number
  estourou: boolean
}

/**
 * Quanto a fatura pode custar sem quebrar o mês: o que entra, menos o que é pago
 * fora do cartão (contas em débito, dízimo) e menos o que se quer guardar.
 */
export function calcularTetoFatura(config: Config, contas: Conta[], recorrentes: Recorrente[]) {
  if (config.tetoFaturaManual && config.tetoFaturaManual > 0) return config.tetoFaturaManual

  const ehCartao = (contaId: string | null) => contas.find((c) => c.id === contaId)?.tipo === 'credito'
  const foraDoCartao = recorrentes
    .filter((r) => r.ativo && r.tipo === 'despesa' && !ehCartao(r.contaId))
    .reduce((total, r) => total + r.valor, 0)

  return Math.max(0, config.rendaMensal - config.metaPoupanca - foraDoCartao)
}

export function montarTermometro(fatura: Fatura, teto: number): TermometroFatura {
  const espaco = teto - fatura.aberta
  const dias = Math.max(1, fatura.diasParaFechar)

  return {
    fatura,
    teto,
    espaco,
    porDia: espaco / dias,
    percentual: teto > 0 ? fatura.aberta / teto : 0,
    estourou: espaco < 0,
  }
}

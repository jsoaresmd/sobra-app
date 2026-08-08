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
  /** Parcelas com data futura (ainda não “gastas”). */
  futuras: number
  /** Valor da fatura que importa agora (fechada pendente, senão a aberta). */
  atual: number
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

  // Só o que já caiu na fatura até hoje — parcelas futuras não entram no valor “de agora”.
  const doCartao = lancamentos.filter(
    (l) => l.contaId === conta.id && l.tipo === 'despesa' && l.data <= hojeISO,
  )

  const somaEntre = (deExclusivo: string, ateInclusivo: string) =>
    doCartao.filter((l) => l.data > deExclusivo && l.data <= ateInclusivo).reduce((total, l) => total + l.valor, 0)

  const inicioAberta = toISO(ultimoFechamento)
  const fimAberta = toISO(proximoFechamento)

  // Valor digitado à mão no app (não o balance bruto da Pluggy, que costuma ser o total em aberto).
  const informadoVale =
    conta.faturaInformada !== undefined &&
    conta.faturaInformadaEm !== undefined &&
    conta.faturaInformadaEm >= inicioAberta &&
    conta.faturaInformadaEm <= hojeISO

  const abertaCalculada = somaEntre(inicioAberta, hojeISO < fimAberta ? hojeISO : fimAberta)
  const abertaFinal = informadoVale
    ? conta.faturaInformadaEm === hojeISO
      ? conta.faturaInformada!
      : conta.faturaInformada! + somaEntre(conta.faturaInformadaEm!, hojeISO)
    : abertaCalculada

  const fechada = somaEntre(toISO(fechamentoAnterior), inicioAberta)
  const futuras = lancamentos
    .filter((l) => l.contaId === conta.id && l.tipo === 'despesa' && l.data > hojeISO)
    .reduce((total, l) => total + l.valor, 0)

  const venceEmFechada = proximaOcorrencia(ultimoFechamento, conta.diaVencimento)
  const venceEmAberta = proximaOcorrencia(proximoFechamento, conta.diaVencimento)
  const fechadaPendente = venceEmFechada >= hoje ? fechada : 0

  /** O que importa agora: fatura fechada a pagar, ou a que ainda está aberta. */
  const atual = fechadaPendente > 0 ? fechadaPendente : abertaFinal

  return {
    conta,
    aberta: abertaFinal,
    fechaEm: fimAberta,
    venceEmAberta: toISO(venceEmAberta),
    diasParaFechar: diasAte(fimAberta, hojeISO),
    fechada: fechadaPendente,
    venceEmFechada: toISO(venceEmFechada),
    futuras,
    atual,
    limiteUsado: conta.limite ? atual / conta.limite : null,
    usandoValorInformado: Boolean(informadoVale),
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
  const valor = fatura.atual
  const espaco = teto - valor
  const dias = Math.max(1, fatura.diasParaFechar)

  return {
    fatura,
    teto,
    espaco,
    porDia: espaco / dias,
    percentual: teto > 0 ? valor / teto : 0,
    estourou: espaco < 0,
  }
}

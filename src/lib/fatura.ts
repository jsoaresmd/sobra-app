import { addMonths, getDaysInMonth } from 'date-fns'
import { fromISO, toISO } from './dates'
import type { Config, Conta, FaturaBanco, Lancamento, Recorrente } from './types'

export type Fatura = {
  conta: Conta
  /** Fatura que se paga agora, já descontando o que foi pago adiantado. */
  atual: number
  /** Total da fatura antes dos pagamentos. */
  bruto: number
  pago: number
  vence: string
  /** True quando essa fatura já fechou e não recebe mais compras. */
  fechada: boolean
  /** Compras que já entraram na fatura seguinte. */
  proxima: number
  /** Parcelas que só caem nas faturas depois dessa. */
  futuras: number
  fechaEm: string
  diasParaFechar: number
  limiteDisponivel: number | null
  limiteUsado: number | null
  /** De onde veio o valor: o banco, a conta do app, ou o que foi digitado. */
  fonte: 'banco' | 'app' | 'informado'
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

/**
 * O que ainda vai cair nas próximas faturas: parcelas já lançadas com data
 * futura mais as que faltam de cada compra parcelada (o banco só manda a
 * parcela do mês, então o resto vem de `3/10`). Nunca entra na fatura de agora.
 */
function parcelasAVencer(doCartao: Lancamento[], fimAberta: string) {
  const lancadas = doCartao.filter((l) => l.data > fimAberta).reduce((soma, l) => soma + l.valor, 0)

  const chains = new Map<string, { valor: number; total: number; ultima: number }>()
  for (const l of doCartao) {
    const total = l.totalParcelas ?? 0
    const numero = l.parcela ?? 0
    if (total <= 1 || numero <= 0) continue
    const base = l.descricao.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, '').trim()
    const chave = `${base}|${total}|${l.valor.toFixed(2)}`
    const atual = chains.get(chave)
    if (!atual || numero > atual.ultima) chains.set(chave, { valor: l.valor, total, ultima: numero })
  }

  const restantes = [...chains.values()].reduce(
    (soma, c) => soma + Math.max(0, c.total - c.ultima) * c.valor,
    0,
  )

  return restantes + lancadas
}

/** A fatura que o banco ainda espera receber: a primeira que vence de hoje em diante. */
function faturaAPagar(faturas: FaturaBanco[] | undefined, hojeISO: string) {
  if (!faturas?.length) return null
  const abertas = faturas.filter((f) => f.vence >= hojeISO)
  return abertas.length > 0 ? abertas[0] : null
}

export function calcularFatura(conta: Conta, lancamentos: Lancamento[], hojeISO: string): Fatura | null {
  if (conta.tipo !== 'credito') return null

  const diaFechamento = conta.diaFechamento ?? 4
  const diaVencimento = conta.diaVencimento ?? 11
  const hoje = fromISO(hojeISO)
  const ultimoFechamento = ultimaOcorrencia(hoje, diaFechamento)
  const proximoFechamento = proximaOcorrencia(ultimoFechamento, diaFechamento)
  const fechamentoAnterior = ultimaOcorrencia(new Date(ultimoFechamento.getTime() - 86400000), diaFechamento)

  const doCartao = lancamentos.filter((l) => l.contaId === conta.id && l.tipo === 'despesa')
  const somaEntre = (deExclusivo: string, ateInclusivo: string) =>
    doCartao.filter((l) => l.data > deExclusivo && l.data <= ateInclusivo).reduce((total, l) => total + l.valor, 0)

  const inicioFechada = toISO(fechamentoAnterior)
  const inicioAberta = toISO(ultimoFechamento)
  const fimAberta = toISO(proximoFechamento)
  const ateHoje = hojeISO < fimAberta ? hojeISO : fimAberta

  const doBanco = faturaAPagar(conta.faturasBanco, hojeISO)
  const futuras = parcelasAVencer(doCartao, fimAberta)

  let bruto: number
  let pago: number
  let vence: string
  let fechada: boolean
  let proxima: number
  let fonte: Fatura['fonte']

  if (doBanco) {
    bruto = doBanco.total + doBanco.encargos
    pago = doBanco.pago
    vence = doBanco.vence
    fechada = Boolean(doBanco.fechouEm && doBanco.fechouEm <= hojeISO)
    // Depois que a fatura fecha, o que se compra já é da fatura seguinte.
    proxima = fechada ? somaEntre(doBanco.fechouEm!, ateHoje) : 0
    fonte = 'banco'
  } else {
    const fechadaCalculada = somaEntre(inicioFechada, inicioAberta)
    const venceFechada = toISO(proximaOcorrencia(ultimoFechamento, diaVencimento))
    const aindaPagaFechada = venceFechada >= hojeISO && fechadaCalculada > 0

    bruto = aindaPagaFechada ? fechadaCalculada : somaEntre(inicioAberta, ateHoje)
    pago = 0
    vence = aindaPagaFechada ? venceFechada : toISO(proximaOcorrencia(proximoFechamento, diaVencimento))
    fechada = aindaPagaFechada
    proxima = aindaPagaFechada ? somaEntre(inicioAberta, ateHoje) : 0
    fonte = 'app'
  }

  // Valor conferido no app do banco vence qualquer cálculo, com as compras
  // lançadas depois somadas por cima.
  const informadoVale =
    conta.faturaInformada !== undefined &&
    conta.faturaInformadaEm !== undefined &&
    conta.faturaInformadaEm >= inicioFechada &&
    conta.faturaInformadaEm <= hojeISO

  if (informadoVale) {
    bruto = conta.faturaInformada! + somaEntre(conta.faturaInformadaEm!, fechada ? inicioAberta : ateHoje)
    pago = 0
    fonte = 'informado'
  }

  const atual = Math.max(0, bruto - pago)

  return {
    conta,
    atual,
    bruto,
    pago,
    vence,
    fechada,
    proxima,
    futuras,
    fechaEm: fimAberta,
    diasParaFechar: diasAte(fimAberta, hojeISO),
    limiteDisponivel: conta.limiteDisponivel ?? null,
    limiteUsado: conta.limite ? atual / conta.limite : null,
    fonte,
  }
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

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

export function calcularFatura(conta: Conta, lancamentos: Lancamento[], hojeISO: string): Fatura | null {
  if (conta.tipo !== 'credito' || !conta.diaFechamento || !conta.diaVencimento) return null

  const hoje = fromISO(hojeISO)
  const ultimoFechamento = ultimaOcorrencia(hoje, conta.diaFechamento)
  const proximoFechamento = proximaOcorrencia(ultimoFechamento, conta.diaFechamento)
  const fechamentoAnterior = ultimaOcorrencia(new Date(ultimoFechamento.getTime() - 86400000), conta.diaFechamento)

  const doCartao = lancamentos.filter((l) => l.contaId === conta.id && l.tipo === 'despesa')

  const somaEntre = (deExclusivo: string, ateInclusivo: string) =>
    doCartao.filter((l) => l.data > deExclusivo && l.data <= ateInclusivo).reduce((total, l) => total + l.valor, 0)

  const inicioFechada = toISO(fechamentoAnterior)
  const inicioAberta = toISO(ultimoFechamento)
  const fimAberta = toISO(proximoFechamento)

  const fechada = somaEntre(inicioFechada, inicioAberta)
  const aberta = somaEntre(inicioAberta, hojeISO < fimAberta ? hojeISO : fimAberta)
  const futuras = parcelasAVencer(doCartao, fimAberta)

  const venceEmFechada = proximaOcorrencia(ultimoFechamento, conta.diaVencimento)
  const venceEmAberta = proximaOcorrencia(proximoFechamento, conta.diaVencimento)
  const fechadaPendente = venceEmFechada >= hoje ? fechada : 0

  /** O que importa agora: a fatura fechada a pagar, ou a que ainda está aberta. */
  const calculadaAtual = fechadaPendente > 0 ? fechadaPendente : aberta

  // Âncora manual: o valor conferido no app do banco vale mais que a soma dos
  // lançamentos, e só as compras da mesma fatura entram por cima.
  const inicioJanelaAtual = fechadaPendente > 0 ? inicioFechada : inicioAberta
  const fimJanelaAtual = fechadaPendente > 0 ? inicioAberta : hojeISO < fimAberta ? hojeISO : fimAberta
  const informadoVale =
    conta.faturaInformada !== undefined &&
    conta.faturaInformadaEm !== undefined &&
    conta.faturaInformadaEm >= inicioJanelaAtual &&
    conta.faturaInformadaEm <= hojeISO

  const atual = informadoVale
    ? conta.faturaInformada! + somaEntre(conta.faturaInformadaEm!, fimJanelaAtual)
    : calculadaAtual

  return {
    conta,
    aberta,
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

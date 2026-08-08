import { fromISO, toISO, type Ciclo, dentroDo, diaDoCicloParaISO } from './dates'

import { diasAte, proximaOcorrencia, type Fatura } from './fatura'
import type { Config, Conta, Lancamento, Recorrente } from './types'

export type Compromisso = {
  id: string
  descricao: string
  valor: number
  data: string
  tipo: 'fatura' | 'fixo'
}

export type Caixa = {
  /** Soma do que está nas contas de débito e no dinheiro vivo. */
  saldoBanco: number
  /** Data em que os saldos foram conferidos pela última vez. */
  conferidoEm: string | null
  diasSemConferir: number | null
  proximoSalario: string
  diasAteSalario: number
  compromissos: Compromisso[]
  totalCompromissos: number
  /** O que sobra de dinheiro de verdade até a próxima renda entrar. */
  sobraReal: number
  porDia: number
}

/**
 * A conta que o envelope fazia sozinho: tira do saldo tudo que já tem dono
 * (a fatura do cartão que cai neste ciclo e as contas fixas a pagar) e mostra
 * o que realmente é seu para gastar até a próxima renda.
 *
 * Cartão — só uma fatura por vez, a que você paga “agora”:
 * - Antes do fechamento (ex.: até o dia 4): a fatura em aberto.
 * - Depois do fechamento: a fatura que acabou de fechar (vence ~dia 11),
 *   sem somar a fatura nova (próximo mês) nem parcelas futuras.
 */
export function calcularCaixa(
  config: Config,
  contas: Conta[],
  faturas: Fatura[],
  recorrentes: Recorrente[],
  lancamentos: Lancamento[],
  ciclo: Ciclo,
  hoje: string,
): Caixa {
  const emCaixa = contas.filter((c) => !c.arquivada && c.tipo !== 'credito')
  const saldoBanco = emCaixa.reduce((total, c) => total + (c.saldo ?? 0), 0)
  const datas = emCaixa.map((c) => c.saldoEm).filter((d): d is string => Boolean(d))
  const conferidoEm = datas.length > 0 ? datas.sort()[0] : null

  const proximoSalario = toISO(proximaOcorrencia(fromISO(hoje), config.diaInicioCiclo))
  const compromissos: Compromisso[] = []

  for (const fatura of faturas) {
    if (fatura.atual <= 0) continue
    compromissos.push({
      id: `${fatura.conta.id}-atual`,
      descricao: `Fatura ${fatura.conta.nome}`,
      valor: fatura.atual,
      data: fatura.fechada > 0 ? fatura.venceEmFechada : fatura.venceEmAberta,
      tipo: 'fatura',
    })
  }

  const jaLancado = new Set(
    lancamentos.filter((l) => dentroDo(ciclo, l.data)).map((l) => l.recorrenteId).filter(Boolean) as string[],
  )
  const ehCartao = (contaId: string | null) => contas.find((c) => c.id === contaId)?.tipo === 'credito'

  for (const r of recorrentes) {
    if (!r.ativo || r.tipo !== 'despesa' || ehCartao(r.contaId) || jaLancado.has(r.id)) continue
    // Se a data já passou e nada foi lançado, a conta continua em aberto: o
    // valor segue reservado até ser marcada como paga.
    const data = diaDoCicloParaISO(ciclo, r.diaDoMes)
    if (data > proximoSalario) continue
    compromissos.push({ id: r.id, descricao: r.descricao, valor: r.valor, data, tipo: 'fixo' })
  }

  compromissos.sort((a, b) => a.data.localeCompare(b.data))

  const totalCompromissos = compromissos.reduce((total, c) => total + c.valor, 0)
  const sobraReal = saldoBanco - totalCompromissos
  const diasAteSalario = Math.max(1, diasAte(proximoSalario, hoje))

  return {
    saldoBanco,
    conferidoEm,
    diasSemConferir: conferidoEm ? diasAte(hoje, conferidoEm) : null,
    proximoSalario,
    diasAteSalario,
    compromissos,
    totalCompromissos,
    sobraReal,
    porDia: sobraReal / diasAteSalario,
  }
}

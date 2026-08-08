import { db, novoId } from './db'
import { dentroDo, type Ciclo } from './dates'
import type { Envelope, Lancamento, MovimentoEnvelope, TipoMovimentoEnvelope } from './types'

async function registrarMovimento(
  envelope: Envelope,
  tipo: TipoMovimentoEnvelope,
  delta: number,
  data: string,
  descricao: string,
  extras: Partial<Pick<MovimentoEnvelope, 'lancamentoId' | 'envelopeParId'>> = {},
) {
  const saldoDepois = Math.round((envelope.saldo + delta) * 100) / 100
  const movimento: MovimentoEnvelope = {
    id: novoId(),
    envelopeId: envelope.id,
    tipo,
    valor: delta,
    saldoDepois,
    data,
    descricao,
    criadoEm: new Date().toISOString(),
    ...extras,
  }
  envelope.saldo = saldoDepois
  await db.envelopes.put(envelope)
  await db.movimentosEnvelope.put(movimento)
  return movimento
}

/**
 * Virada de ciclo: manda sobra dos variáveis para investimento, zera fixos,
 * e marca o ciclo. O depósito em si fica a cargo de `depositarCiclo`.
 */
export async function alocarCiclo(ciclo: Ciclo) {
  return db.transaction('rw', db.envelopes, db.movimentosEnvelope, async () => {
    const ativos = (await db.envelopes.toArray()).filter((e) => !e.arquivado)
    const precisa = ativos.some((e) => e.cicloAlocado !== ciclo.inicio)
    if (!precisa) return false

    for (const bruto of ativos) {
      const envelope = { ...bruto }
      if (envelope.cicloAlocado === ciclo.inicio) continue

      if (envelope.tipo === 'investimento') {
        envelope.cicloAlocado = ciclo.inicio
        await db.envelopes.put(envelope)
        continue
      }

      if (envelope.tipo === 'variavel' && envelope.cicloAlocado && envelope.saldo > 0) {
        const todos = await db.envelopes.toArray()
        await enviarSobraParaInvestimento(envelope, ciclo.inicio, todos)
      }

      if (envelope.tipo === 'fixo' && envelope.saldo !== 0) {
        await registrarMovimento(envelope, 'ajuste', -envelope.saldo, ciclo.inicio, 'Ajuste de ciclo anterior')
      }

      envelope.cicloAlocado = ciclo.inicio
      await db.envelopes.put(envelope)
    }

    return true
  })
}

/** Coloca o valorMensal em cada envelope que ainda não recebeu depósito neste ciclo. */
export async function depositarCiclo(ciclo: Ciclo) {
  return db.transaction('rw', db.envelopes, db.movimentosEnvelope, async () => {
    const ativos = (await db.envelopes.toArray()).filter((e) => !e.arquivado && e.tipo !== 'investimento')
    let depositou = false

    for (const bruto of ativos) {
      if (bruto.valorMensal <= 0) continue
      const jaDepositou = await db.movimentosEnvelope
        .where('envelopeId')
        .equals(bruto.id)
        .filter((m) => m.tipo === 'alocacao' && m.data === ciclo.inicio)
        .first()
      if (jaDepositou) continue

      const envelope = { ...bruto, cicloAlocado: ciclo.inicio }
      await registrarMovimento(envelope, 'alocacao', envelope.valorMensal, ciclo.inicio, 'Depósito do ciclo')
      depositou = true
    }

    return depositou
  })
}

async function enviarSobraParaInvestimento(origem: Envelope, data: string, todos: Envelope[]) {
  const investimento = todos.find((e) => e.tipo === 'investimento' && !e.arquivado)
  if (!investimento || origem.saldo <= 0) return

  const valor = origem.saldo
  await registrarMovimento(origem, 'sobra', -valor, data, `Sobra → ${investimento.nome}`, {
    envelopeParId: investimento.id,
  })
  const dest = (await db.envelopes.get(investimento.id)) ?? investimento
  await registrarMovimento(dest, 'sobra', valor, data, `Sobra de ${origem.nome}`, {
    envelopeParId: origem.id,
  })
}

/** Transfere saldo de um envelope para outro (o gesto de "tirar do lazer e pôr no mercado"). */
export async function transferirEntreEnvelopes(
  deId: string,
  paraId: string,
  valor: number,
  data: string,
) {
  if (valor <= 0) throw new Error('Valor precisa ser positivo.')
  if (deId === paraId) throw new Error('Escolha envelopes diferentes.')

  await db.transaction('rw', db.envelopes, db.movimentosEnvelope, async () => {
    const de = await db.envelopes.get(deId)
    const para = await db.envelopes.get(paraId)
    if (!de || !para) throw new Error('Envelope não encontrado.')
    if (de.saldo < valor) throw new Error('Saldo insuficiente no envelope de origem.')

    await registrarMovimento(de, 'transferencia', -valor, data, `Para ${para.nome}`, {
      envelopeParId: para.id,
    })
    await registrarMovimento(para, 'transferencia', valor, data, `De ${de.nome}`, {
      envelopeParId: de.id,
    })
  })
}

/** Tira o valor do envelope (gasto). Saldo pode ficar negativo — o envelope estoura. */
export async function debitarEnvelope(
  envelopeId: string,
  valor: number,
  data: string,
  descricao: string,
  lancamentoId: string,
) {
  if (valor <= 0) return
  await db.transaction('rw', db.envelopes, db.movimentosEnvelope, db.lancamentos, async () => {
    const envelope = await db.envelopes.get(envelopeId)
    if (!envelope || envelope.arquivado) return
    await registrarMovimento(envelope, 'gasto', -valor, data, descricao, { lancamentoId })
    await db.lancamentos.update(lancamentoId, { envelopeDebitado: true, envelopeId })
  })
}

/** Devolve o valor ao envelope (lançamento apagado ou editado). */
export async function estornarEnvelope(lancamento: Lancamento) {
  if (!lancamento.envelopeId || !lancamento.envelopeDebitado || lancamento.tipo !== 'despesa') return

  await db.transaction('rw', db.envelopes, db.movimentosEnvelope, db.lancamentos, async () => {
    const envelope = await db.envelopes.get(lancamento.envelopeId!)
    if (!envelope) {
      await db.lancamentos.update(lancamento.id, { envelopeDebitado: false })
      return
    }
    await registrarMovimento(
      envelope,
      'ajuste',
      lancamento.valor,
      lancamento.data,
      `Estorno: ${lancamento.descricao || 'lançamento'}`,
      { lancamentoId: lancamento.id },
    )
    await db.lancamentos.update(lancamento.id, { envelopeDebitado: false })
  })
}

/**
 * Debita envelopes de lançamentos do ciclo atual que ainda não foram debitados
 * (parcelas futuras que acabaram de entrar no período, etc.).
 */
export async function processarDebitosPendentes(ciclo: Ciclo, hoje: string) {
  const pendentes = await db.lancamentos
    .filter(
      (l) =>
        l.tipo === 'despesa' &&
        Boolean(l.envelopeId) &&
        !l.envelopeDebitado &&
        dentroDo(ciclo, l.data) &&
        l.data <= hoje,
    )
    .toArray()

  for (const l of pendentes) {
    await debitarEnvelope(l.envelopeId!, l.valor, l.data, l.descricao || 'Gasto', l.id)
  }
}

export async function ajustarSaldoEnvelope(envelopeId: string, novoSaldo: number, data: string) {
  await db.transaction('rw', db.envelopes, db.movimentosEnvelope, async () => {
    const envelope = await db.envelopes.get(envelopeId)
    if (!envelope) return
    const delta = Math.round((novoSaldo - envelope.saldo) * 100) / 100
    if (delta === 0) return
    await registrarMovimento(envelope, 'ajuste', delta, data, 'Ajuste manual de saldo')
  })
}

export function envelopePorCategoria(envelopes: Envelope[], categoriaId: string | null) {
  if (!categoriaId) return undefined
  return envelopes.find((e) => !e.arquivado && e.categoriaId === categoriaId)
}

export function envelopePorRecorrente(envelopes: Envelope[], recorrenteId: string) {
  return envelopes.find((e) => !e.arquivado && e.recorrenteId === recorrenteId)
}

export const ROTULO_TIPO_ENVELOPE: Record<Envelope['tipo'], string> = {
  fixo: 'Conta fixa',
  variavel: 'Planejamento',
  investimento: 'Investimento',
}

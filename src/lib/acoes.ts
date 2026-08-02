import { addMonths } from 'date-fns'
import { db, novoId } from './db'
import { fromISO, toISO } from './dates'
import { debitarEnvelope, envelopePorCategoria, envelopePorRecorrente, estornarEnvelope } from './envelopes'
import type { Categoria, Conta, Envelope, Lancamento, Recorrente, TipoLancamento } from './types'

export type NovoLancamento = {
  tipo: TipoLancamento
  valor: number
  data: string
  categoriaId: string | null
  contaId: string | null
  pessoaId: string | null
  envelopeId: string | null
  descricao: string
  parcelas: number
  /** Quando parcelado, indica se `valor` é o total da compra ou o valor de cada parcela. */
  valorEhTotal: boolean
  /** YYYY-MM-DD de hoje — só debita o envelope se a data do lançamento for até hoje. */
  hoje: string
}

/** Divide o total em parcelas iguais, jogando a sobra de centavos na primeira. */
function dividirEmParcelas(total: number, parcelas: number) {
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / parcelas)
  const sobra = centavos - base * parcelas
  return Array.from({ length: parcelas }, (_, i) => (base + (i === 0 ? sobra : 0)) / 100)
}

export async function criarLancamento(entrada: NovoLancamento) {
  const agora = new Date().toISOString()
  const parcelas = Math.max(1, Math.round(entrada.parcelas))

  if (parcelas === 1) {
    const lancamento: Lancamento = {
      id: novoId(),
      tipo: entrada.tipo,
      valor: entrada.valor,
      data: entrada.data,
      categoriaId: entrada.categoriaId,
      contaId: entrada.contaId,
      pessoaId: entrada.pessoaId,
      envelopeId: entrada.envelopeId,
      descricao: entrada.descricao.trim(),
      origem: 'manual',
      criadoEm: agora,
    }
    await db.lancamentos.put(lancamento)
    if (lancamento.tipo === 'despesa' && lancamento.envelopeId && lancamento.data <= entrada.hoje) {
      await debitarEnvelope(lancamento.envelopeId, lancamento.valor, lancamento.data, lancamento.descricao || 'Gasto', lancamento.id)
    }
    return lancamento.id
  }

  const total = entrada.valorEhTotal ? entrada.valor : entrada.valor * parcelas
  const valores = dividirEmParcelas(total, parcelas)
  const grupoParcelaId = novoId()
  const primeira = fromISO(entrada.data)

  const registros: Lancamento[] = valores.map((valor, i) => ({
    id: novoId(),
    tipo: entrada.tipo,
    valor,
    data: toISO(addMonths(primeira, i)),
    categoriaId: entrada.categoriaId,
    contaId: entrada.contaId,
    pessoaId: entrada.pessoaId,
    envelopeId: entrada.envelopeId,
    descricao: entrada.descricao.trim(),
    grupoParcelaId,
    parcela: i + 1,
    totalParcelas: parcelas,
    origem: 'manual',
    criadoEm: agora,
  }))

  await db.lancamentos.bulkPut(registros)

  for (const l of registros) {
    if (l.tipo === 'despesa' && l.envelopeId && l.data <= entrada.hoje) {
      await debitarEnvelope(l.envelopeId, l.valor, l.data, l.descricao || 'Gasto', l.id)
    }
  }

  return registros[0].id
}

export async function atualizarLancamento(id: string, mudancas: Partial<Lancamento>, hoje: string) {
  const atual = await db.lancamentos.get(id)
  if (!atual) return

  await estornarEnvelope(atual)

  const proximo: Lancamento = { ...atual, ...mudancas, envelopeDebitado: false }
  await db.lancamentos.put(proximo)

  if (proximo.tipo === 'despesa' && proximo.envelopeId && proximo.data <= hoje) {
    await debitarEnvelope(proximo.envelopeId, proximo.valor, proximo.data, proximo.descricao || 'Gasto', proximo.id)
  }
}

export async function removerLancamento(id: string) {
  const atual = await db.lancamentos.get(id)
  if (atual) await estornarEnvelope(atual)
  await db.lancamentos.delete(id)
}

/** Apaga a compra inteira, incluindo as parcelas que ainda não venceram. */
export async function removerGrupoParcelas(grupoParcelaId: string) {
  const grupo = await db.lancamentos.where('grupoParcelaId').equals(grupoParcelaId).toArray()
  for (const l of grupo) await estornarEnvelope(l)
  await db.lancamentos.where('grupoParcelaId').equals(grupoParcelaId).delete()
}

/** Registra que um compromisso fixo do ciclo já aconteceu. */
export async function confirmarRecorrente(
  recorrente: Recorrente,
  data: string,
  envelopes: Envelope[],
  valor?: number,
) {
  const envelope =
    envelopePorRecorrente(envelopes, recorrente.id) ?? envelopePorCategoria(envelopes, recorrente.categoriaId)

  const lancamento: Lancamento = {
    id: novoId(),
    tipo: recorrente.tipo,
    valor: valor ?? recorrente.valor,
    data,
    categoriaId: recorrente.categoriaId,
    contaId: recorrente.contaId,
    pessoaId: recorrente.pessoaId,
    envelopeId: envelope?.id ?? null,
    descricao: recorrente.descricao,
    origem: 'recorrente',
    recorrenteId: recorrente.id,
    criadoEm: new Date().toISOString(),
  }
  await db.lancamentos.put(lancamento)

  if (lancamento.tipo === 'despesa' && lancamento.envelopeId) {
    await debitarEnvelope(lancamento.envelopeId, lancamento.valor, data, lancamento.descricao, lancamento.id)
  }

  return lancamento.id
}

export async function salvarCategoria(categoria: Categoria) {
  await db.categorias.put(categoria)
}

export async function salvarConta(conta: Conta) {
  await db.contas.put(conta)
}

export async function salvarRecorrente(recorrente: Recorrente) {
  await db.recorrentes.put(recorrente)
}

export async function removerRecorrente(id: string) {
  await db.recorrentes.delete(id)
  await db.lancamentos.where('recorrenteId').equals(id).modify({ recorrenteId: undefined, origem: 'manual' })
  await db.envelopes.filter((e) => e.recorrenteId === id).modify({ recorrenteId: null })
}

export async function salvarEnvelope(envelope: Envelope) {
  await db.envelopes.put(envelope)
}

export async function removerEnvelope(id: string) {
  await db.transaction('rw', db.envelopes, db.lancamentos, db.movimentosEnvelope, async () => {
    await db.lancamentos.where('envelopeId').equals(id).modify({ envelopeId: null, envelopeDebitado: false })
    await db.movimentosEnvelope.where('envelopeId').equals(id).delete()
    await db.envelopes.delete(id)
  })
}

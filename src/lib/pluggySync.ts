import { db, novoId } from './db'
import { debitarEnvelope } from './envelopes'
import { chaveEstabelecimento, extrairParcela, nomeSemParcela } from './merchant'
import { sugerirEnvelope } from './regrasImportacao'
import { salvarRegraImportacao } from './regrasImportacao'
import { partirDataHora } from './dates'
import type { ContaPluggySync, SyncPluggyResultado, TxPluggySync } from './pluggyClient'
import type { Conta, Envelope, Lancamento, RegraImportacao, TipoConta } from './types'
import type { TxNubank } from './nubankShared'

function tipoContaPluggy(conta: ContaPluggySync): TipoConta {
  if (conta.type === 'CREDIT' || conta.subtype === 'CREDIT_CARD') return 'credito'
  if (conta.type === 'BANK' || conta.type === 'CHECKING' || conta.subtype === 'CHECKING_ACCOUNT') return 'debito'
  return 'debito'
}

function diaDeISO(iso: string | null | undefined) {
  if (!iso) return undefined
  const d = Number(iso.slice(8, 10))
  return Number.isFinite(d) ? d : undefined
}

function corConta(tipo: TipoConta) {
  if (tipo === 'credito') return '#8a05be'
  if (tipo === 'debito') return '#3f7ec4'
  return '#2f9e6e'
}

function txComoNubank(tx: TxPluggySync): TxNubank {
  const titulo = tx.descriptionRaw || tx.description || 'Lançamento'
  const { parcela, totalParcelas } = extrairParcela(titulo)
  const metaParcela = tx.creditCardMetadata?.installmentNumber ?? undefined
  const metaTotal = tx.creditCardMetadata?.totalInstallments ?? undefined
  const estabelecimento = nomeSemParcela(titulo)
  const valor = Math.abs(tx.amount)

  // Pluggy: DEBIT = dinheiro saindo, CREDIT = entrando.
  // Fallback pelo sinal se o type não vier.
  const tipo: 'despesa' | 'receita' =
    tx.type === 'CREDIT' || (tx.type !== 'DEBIT' && tx.amount < 0) ? 'receita' : 'despesa'

  const parcelaFinal = metaParcela ?? parcela
  const totalFinal = metaTotal ?? totalParcelas

  return {
    fingerprint: `pluggy:${tx.id}`,
    data: tx.date.slice(0, 10),
    descricao: parcelaFinal && totalFinal ? `${estabelecimento} (${parcelaFinal}/${totalFinal})` : estabelecimento,
    estabelecimento,
    chave: chaveEstabelecimento(estabelecimento),
    valor,
    tipo,
    parcela: parcelaFinal,
    totalParcelas: totalFinal,
    origem: /pagamento/i.test(titulo) ? 'pagamento' : /^IOF\b/i.test(titulo) ? 'iof' : 'compra',
  }
}

async function upsertConta(contaP: ContaPluggySync, ordem: number, hoje: string) {
  const tipo = tipoContaPluggy(contaP)
  const existentes = await db.contas.toArray()
  let local =
    existentes.find((c) => c.pluggyAccountId === contaP.id) ??
    existentes.find(
      (c) =>
        !c.pluggyAccountId &&
        c.tipo === tipo &&
        c.nome.toLowerCase().includes((contaP.marketingName || contaP.name).toLowerCase().slice(0, 6)),
    )

  const nome = contaP.marketingName || contaP.name
  const mudancas: Partial<Conta> = {
    nome,
    tipo,
    cor: local?.cor ?? corConta(tipo),
    pluggyAccountId: contaP.id,
    pluggyItemId: contaP.itemId,
    ordem: local?.ordem ?? ordem,
  }

  if (tipo === 'credito') {
    mudancas.diaFechamento = diaDeISO(contaP.creditData?.balanceCloseDate) ?? local?.diaFechamento ?? 4
    mudancas.diaVencimento = diaDeISO(contaP.creditData?.balanceDueDate) ?? local?.diaVencimento ?? 11
    mudancas.limite = contaP.creditData?.creditLimit ?? local?.limite
    mudancas.faturaInformada = Math.abs(contaP.balance)
    mudancas.faturaInformadaEm = hoje
  } else {
    mudancas.saldo = contaP.balance
    mudancas.saldoEm = hoje
  }

  if (local) {
    await db.contas.update(local.id, mudancas)
    return local.id
  }

  const id = novoId()
  const nova: Conta = {
    id,
    nome,
    tipo,
    cor: corConta(tipo),
    ordem,
    pluggyAccountId: contaP.id,
    pluggyItemId: contaP.itemId,
    diaFechamento: mudancas.diaFechamento,
    diaVencimento: mudancas.diaVencimento,
    limite: mudancas.limite,
    faturaInformada: mudancas.faturaInformada,
    faturaInformadaEm: mudancas.faturaInformadaEm,
    saldo: mudancas.saldo,
    saldoEm: mudancas.saldoEm,
  }
  await db.contas.put(nova)
  return id
}

/**
 * Aplica o pacote vindo da função Netlify: atualiza contas/saldos/faturas
 * e importa transações novas nos envelopes (usando as etiquetas aprendidas).
 */
export async function aplicarSyncPluggy(
  pacote: SyncPluggyResultado,
  envelopes: Envelope[],
  regras: RegraImportacao[],
  hoje: string,
) {
  const mapaConta = new Map<string, string>() // pluggyAccountId → localId

  for (let i = 0; i < pacote.contas.length; i++) {
    const localId = await upsertConta(pacote.contas[i], i, hoje)
    mapaConta.set(pacote.contas[i].id, localId)
  }

  const fps = pacote.transacoes.map((t) => `pluggy:${t.id}`)
  const jaTem = new Set(
    (await db.lancamentos.where('importFingerprint').anyOf(fps).toArray())
      .map((l) => l.importFingerprint)
      .filter(Boolean),
  )

  let novas = 0
  let etiquetadas = 0
  let semEtiqueta = 0

  for (const tx of pacote.transacoes) {
    const fingerprint = `pluggy:${tx.id}`
    if (jaTem.has(fingerprint)) continue

    const normalizada = txComoNubank(tx)
    if (normalizada.origem === 'pagamento') continue

    const sugestao = sugerirEnvelope(normalizada, envelopes, regras)
    const contaId = mapaConta.get(tx.accountId) ?? null
    const { hora } = partirDataHora(tx.date)

    // Preferir categoria da Pluggy se mapearmos pelo nome depois — por enquanto envelopes.
    const lancamento: Lancamento = {
      id: novoId(),
      tipo: normalizada.tipo,
      valor: normalizada.valor,
      data: normalizada.data,
      hora,
      categoriaId: sugestao.categoriaId,
      contaId,
      pessoaId: null,
      envelopeId: normalizada.tipo === 'despesa' ? sugestao.envelopeId : null,
      descricao: normalizada.descricao,
      parcela: normalizada.parcela,
      totalParcelas: normalizada.totalParcelas,
      origem: 'importado',
      importFingerprint: fingerprint,
      criadoEm: new Date().toISOString(),
    }

    await db.lancamentos.put(lancamento)

    if (lancamento.tipo === 'despesa' && lancamento.envelopeId && lancamento.data <= hoje) {
      await debitarEnvelope(
        lancamento.envelopeId,
        lancamento.valor,
        lancamento.data,
        lancamento.descricao,
        lancamento.id,
      )
    }

    if (normalizada.origem === 'compra' && sugestao.origem === 'regra') {
      await salvarRegraImportacao(
        normalizada.chave,
        normalizada.estabelecimento,
        sugestao.envelopeId,
        sugestao.categoriaId,
      )
    }

    if (normalizada.tipo === 'despesa' && !sugestao.envelopeId) semEtiqueta += 1
    else if (sugestao.envelopeId) etiquetadas += 1
    novas += 1
  }

  await db.config.update('app', {
    pluggyUltimaSync: pacote.sincronizadoEm,
  })

  return { novas, etiquetadas, semEtiqueta, contas: pacote.contas.length }
}

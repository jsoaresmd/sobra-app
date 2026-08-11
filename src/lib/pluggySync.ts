import { db, novoId } from './db'
import { debitarEnvelope } from './envelopes'
import { chaveEstabelecimento, extrairParcela, nomeSemParcela } from './merchant'
import { sugerirEnvelope } from './regrasImportacao'
import { salvarRegraImportacao } from './regrasImportacao'
import { partirDataHora } from './dates'
import type { ContaPluggySync, FaturaPluggy, SyncPluggyResultado, TxPluggySync } from './pluggyClient'
import type { Conta, Envelope, FaturaBanco, Lancamento, RegraImportacao, TipoConta, Categoria } from './types'
import type { TxNubank } from './nubankShared'

type TxImportada = TxNubank & {
  /** Mês da fatura que cobra o gasto (YYYY-MM), quando o banco informa. */
  faturaMes?: string
  pendente?: boolean
}

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

function txComoNubank(tx: TxPluggySync, contaTipo: TipoConta, hoje: string): TxImportada {
  const titulo = tx.descriptionRaw || tx.description || 'Lançamento'
  const { parcela, totalParcelas } = extrairParcela(titulo)
  const metaParcela = tx.creditCardMetadata?.installmentNumber ?? undefined
  const metaTotal = tx.creditCardMetadata?.totalInstallments ?? undefined
  const estabelecimento = nomeSemParcela(titulo)
  const valor = Math.abs(tx.amount)

  const dataFatura = tx.date.slice(0, 10)
  const dataCompra = tx.creditCardMetadata?.purchaseDate?.slice(0, 10)
  const numeroParcela = metaParcela ?? parcela ?? 1
  const totalDeParcelas = metaTotal ?? totalParcelas ?? 1
  const primeiraParcela = totalDeParcelas <= 1 || numeroParcela === 1

  // Cartão: a Pluggy manda `date` da fatura (às vezes no futuro). O extrato do
  // app precisa da data em que você gastou, senão some atrás do filtro “até hoje”.
  let data = dataFatura
  if (contaTipo === 'credito' && primeiraParcela) {
    if (dataCompra) data = dataCompra
    else if (tx.status === 'PENDING' && dataFatura > hoje) data = hoje
  }

  let tipo: 'despesa' | 'receita'
  if (contaTipo === 'credito') {
    // CREDIT no cartão = pagamento/estorno; DEBIT = compra.
    tipo = tx.type === 'CREDIT' || /pagamento da fatura|pagamento recebido/i.test(titulo) ? 'receita' : 'despesa'
  } else {
    tipo = tx.type === 'CREDIT' || (tx.type !== 'DEBIT' && tx.amount < 0) ? 'receita' : 'despesa'
  }

  const parcelaFinal = metaParcela ?? parcela
  const totalFinal = metaTotal ?? totalParcelas
  const ehPagamento = contaTipo === 'credito'
    ? /pagamento da fatura|pagamento recebido|^pagamento\b/i.test(titulo)
    : /pagamento/i.test(titulo)

  return {
    fingerprint: `pluggy:${tx.id}`,
    data,
    descricao: parcelaFinal && totalFinal ? `${estabelecimento} (${parcelaFinal}/${totalFinal})` : estabelecimento,
    estabelecimento,
    chave: chaveEstabelecimento(estabelecimento),
    valor,
    tipo,
    parcela: parcelaFinal,
    totalParcelas: totalFinal,
    origem: ehPagamento ? 'pagamento' : /^IOF\b/i.test(titulo) ? 'iof' : 'compra',
    faturaMes: tx.creditCardMetadata?.billMonth ?? undefined,
    pendente: tx.status === 'PENDING' ? true : undefined,
  }
}

function faturasDaConta(faturas: FaturaPluggy[], accountId: string): FaturaBanco[] {
  return faturas
    .filter((b) => b.accountId === accountId)
    .map((b) => ({
      id: b.id,
      vence: b.dueDate.slice(0, 10),
      fechouEm: b.billClosingDate ? b.billClosingDate.slice(0, 10) : null,
      total: b.totalAmount,
      encargos: (b.financeCharges ?? []).reduce((soma, c) => soma + (c.amount ?? 0), 0),
      pago: (b.payments ?? []).reduce((soma, p) => soma + (p.amount ?? 0), 0),
    }))
    .sort((a, b) => a.vence.localeCompare(b.vence))
}

async function upsertConta(contaP: ContaPluggySync, ordem: number, hoje: string, faturas: FaturaBanco[]) {
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
    mudancas.limiteDisponivel = contaP.creditData?.availableCreditLimit ?? local?.limiteDisponivel
    if (faturas.length > 0) mudancas.faturasBanco = faturas
    // Não usa balance da Pluggy como fatura: no Open Finance ele é o limite usado
    // (fatura aberta + parcelas futuras), não a fatura que se paga agora.
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
    limiteDisponivel: mudancas.limiteDisponivel,
    faturasBanco: mudancas.faturasBanco,
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
  categorias: Categoria[] = [],
) {
  const mapaConta = new Map<string, string>() // pluggyAccountId → localId
  const mapaTipo = new Map<string, TipoConta>()

  for (let i = 0; i < pacote.contas.length; i++) {
    const contaP = pacote.contas[i]
    const localId = await upsertConta(contaP, i, hoje, faturasDaConta(pacote.faturas ?? [], contaP.id))
    mapaConta.set(contaP.id, localId)
    mapaTipo.set(contaP.id, tipoContaPluggy(contaP))
  }

  const fps = pacote.transacoes.map((t) => `pluggy:${t.id}`)
  const existentes = fps.length
    ? await db.lancamentos.where('importFingerprint').anyOf(fps).toArray()
    : []
  const porFp = new Map(existentes.map((l) => [l.importFingerprint!, l]))

  let novas = 0
  let etiquetadas = 0
  let semEtiqueta = 0
  let corrigidas = 0
  let pendentes = 0

  for (const tx of pacote.transacoes) {
    const fingerprint = `pluggy:${tx.id}`
    const contaTipo = mapaTipo.get(tx.accountId) ?? 'debito'
    const normalizada = txComoNubank(tx, contaTipo, hoje)
    if (normalizada.origem === 'pagamento') continue
    if (normalizada.pendente) pendentes += 1

    const ja = porFp.get(fingerprint)
    if (ja) {
      const mudou =
        ja.data !== normalizada.data ||
        ja.tipo !== normalizada.tipo ||
        ja.valor !== normalizada.valor ||
        (ja.faturaMes ?? undefined) !== normalizada.faturaMes ||
        Boolean(ja.pendente) !== Boolean(normalizada.pendente)

      if (mudou) {
        await db.lancamentos.update(ja.id, {
          data: normalizada.data,
          tipo: normalizada.tipo,
          valor: normalizada.valor,
          descricao: normalizada.descricao,
          faturaMes: normalizada.faturaMes,
          pendente: normalizada.pendente,
        })
        corrigidas += 1
      }
      continue
    }

    const sugestao = sugerirEnvelope(normalizada, envelopes, regras, categorias, tx.category)
    const contaId = mapaConta.get(tx.accountId) ?? null
    const { hora } = partirDataHora(tx.creditCardMetadata?.purchaseDate || tx.date)

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
      faturaMes: normalizada.faturaMes,
      pendente: normalizada.pendente,
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

  const resumoContas = pacote.contas.map((c) => {
    const nome = c.marketingName || c.name
    const tipo = tipoContaPluggy(c)
    const valor = tipo === 'credito' ? Math.abs(c.balance) : c.balance
    return { nome, tipo, valor }
  })

  return {
    novas,
    etiquetadas,
    semEtiqueta,
    corrigidas,
    pendentes,
    contas: pacote.contas.length,
    transacoesRecebidas: pacote.transacoes.length,
    resumoContas,
  }
}

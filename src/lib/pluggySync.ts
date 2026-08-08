import { db, novoId } from './db'
import { debitarEnvelope } from './envelopes'
import { chaveEstabelecimento, extrairParcela, nomeSemParcela } from './merchant'
import { sugerirEnvelope } from './regrasImportacao'
import { salvarRegraImportacao } from './regrasImportacao'
import { partirDataHora } from './dates'
import type { ContaPluggySync, SyncPluggyResultado, TxPluggySync } from './pluggyClient'
import type { Conta, Envelope, Lancamento, RegraImportacao, TipoConta, Categoria } from './types'
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

function txComoNubank(tx: TxPluggySync, contaTipo: TipoConta): TxNubank {
  const titulo = tx.descriptionRaw || tx.description || 'Lançamento'
  const { parcela, totalParcelas } = extrairParcela(titulo)
  const metaParcela = tx.creditCardMetadata?.installmentNumber ?? undefined
  const metaTotal = tx.creditCardMetadata?.totalInstallments ?? undefined
  const estabelecimento = nomeSemParcela(titulo)
  const valor = Math.abs(tx.amount)

  const dataFatura = tx.date.slice(0, 10)
  const dataCompra = tx.creditCardMetadata?.purchaseDate?.slice(0, 10)
  const numeroParcela = metaParcela ?? parcela
  const totalDeParcelas = metaTotal ?? totalParcelas ?? 1

  // Da 2ª parcela em diante a data que vale é a da fatura que cobra aquela
  // parcela; senão a compra inteira cairia no mês em que foi feita.
  const usarDataDaCompra =
    contaTipo === 'credito' &&
    Boolean(dataCompra) &&
    dataCompra! < dataFatura &&
    (totalDeParcelas <= 1 || (numeroParcela ?? 1) === 1)

  const data = usarDataDaCompra ? dataCompra! : dataFatura

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
    // Não usa balance da Pluggy como fatura: costuma ser o total em aberto (várias faturas/parcelas),
    // não o valor da fatura atual do Nubank.
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
    const localId = await upsertConta(pacote.contas[i], i, hoje)
    mapaConta.set(pacote.contas[i].id, localId)
    mapaTipo.set(pacote.contas[i].id, tipoContaPluggy(pacote.contas[i]))
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

  for (const tx of pacote.transacoes) {
    const fingerprint = `pluggy:${tx.id}`
    const contaTipo = mapaTipo.get(tx.accountId) ?? 'debito'
    const normalizada = txComoNubank(tx, contaTipo)
    if (normalizada.origem === 'pagamento') continue

    const ja = porFp.get(fingerprint)
    if (ja) {
      // Corrige data antiga (fatura futura) para a data real da compra.
      if (ja.data !== normalizada.data || ja.tipo !== normalizada.tipo) {
        await db.lancamentos.update(ja.id, {
          data: normalizada.data,
          tipo: normalizada.tipo,
          valor: normalizada.valor,
          descricao: normalizada.descricao,
        })
        corrigidas += 1
      }
      continue
    }

    const sugestao = sugerirEnvelope(normalizada, envelopes, regras, categorias, tx.category)
    const contaId = mapaConta.get(tx.accountId) ?? null
    const { hora } = partirDataHora(tx.date)

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
    contas: pacote.contas.length,
    transacoesRecebidas: pacote.transacoes.length,
    resumoContas,
  }
}

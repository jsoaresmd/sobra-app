import { db, novoId } from './db'
import { debitarEnvelope } from './envelopes'
import { fingerprintsJaImportados, salvarRegraImportacao } from './regrasImportacao'
import type { TxNubank } from './nubankShared'
import type { Lancamento } from './types'

export type ItemImportacao = {
  tx: TxNubank
  incluir: boolean
  envelopeId: string | null
  categoriaId: string | null
  /** Já existe no banco com o mesmo fingerprint. */
  duplicado: boolean
  sugestao: 'regra' | 'heuristica' | 'nenhuma'
}

export async function confirmarImportacao(itens: ItemImportacao[], contaId: string | null, hoje: string) {
  const candidatos = itens.filter((i) => i.incluir && !i.duplicado && i.tx.origem !== 'pagamento')
  const fps = candidatos.map((i) => i.tx.fingerprint)
  const jaTem = await fingerprintsJaImportados(fps)

  let criados = 0
  let regras = 0

  for (const item of candidatos) {
    if (jaTem.has(item.tx.fingerprint)) continue

    const lancamento: Lancamento = {
      id: novoId(),
      tipo: item.tx.tipo,
      valor: item.tx.valor,
      data: item.tx.data,
      categoriaId: item.categoriaId,
      contaId,
      pessoaId: null,
      envelopeId: item.tx.tipo === 'despesa' ? item.envelopeId : null,
      descricao: item.tx.descricao,
      parcela: item.tx.parcela,
      totalParcelas: item.tx.totalParcelas,
      origem: 'importado',
      importFingerprint: item.tx.fingerprint,
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

    if (item.tx.origem === 'compra' && item.tx.chave && (item.envelopeId || item.categoriaId)) {
      await salvarRegraImportacao(item.tx.chave, item.tx.estabelecimento, item.envelopeId, item.categoriaId)
      regras += 1
    }

    criados += 1
  }

  return { criados, regras }
}

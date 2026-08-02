import { db, novoId } from './db'
import type { Envelope, RegraImportacao } from './types'
import type { TxNubank } from './nubankShared'

/** Sugestões frouxas só para a primeira vez — não grava até você confirmar. */
const HEURISTICAS: Array<{ teste: RegExp; envelopes: string[] }> = [
  { teste: /gigante|condor|mercado|atacad|salome|armazem|panificadora/i, envelopes: ['Mercado'] },
  { teste: /farmac|drog|raia|unipreco|medprev|cuidar/i, envelopes: ['Saúde'] },
  { teste: /posto|nutag|uber|combust|forca do oleo|costaauto/i, envelopes: ['Transporte'] },
  {
    teste: /restaurante|ifood|pampa|grill|beer|duff|assados|domin[oó]|pia do ovo|sokulski|baraquias/i,
    envelopes: ['Restaurante'],
  },
  { teste: /lavanderia|araulav/i, envelopes: ['Casa'] },
  {
    teste: /amazonprime|youtube|netflix|spotify|google|claude|cursor|opus clip|nucel/i,
    envelopes: ['Assinaturas', 'Lazer'],
  },
  { teste: /patyy|petz|cobasi/i, envelopes: ['Pets'] },
  { teste: /avilas gym|academia/i, envelopes: ['Saúde'] },
]

export function sugerirEnvelope(tx: TxNubank, envelopes: Envelope[], regras: RegraImportacao[]) {
  const regra = regras.find((r) => r.chave === tx.chave)
  if (regra) {
    return {
      envelopeId: regra.envelopeId,
      categoriaId: regra.categoriaId,
      origem: 'regra' as const,
    }
  }

  for (const h of HEURISTICAS) {
    if (!h.teste.test(tx.estabelecimento) && !h.teste.test(tx.chave)) continue
    const envelope = h.envelopes
      .map((nome) => envelopes.find((e) => !e.arquivado && e.nome.toLowerCase() === nome.toLowerCase()))
      .find(Boolean)
    if (envelope) {
      return {
        envelopeId: envelope.id,
        categoriaId: envelope.categoriaId,
        origem: 'heuristica' as const,
      }
    }
  }

  return { envelopeId: null, categoriaId: null, origem: 'nenhuma' as const }
}

export async function salvarRegraImportacao(
  chave: string,
  nomeExibido: string,
  envelopeId: string | null,
  categoriaId: string | null,
) {
  if (!chave) return
  const existente = await db.regrasImportacao.where('chave').equals(chave).first()
  const agora = new Date().toISOString()
  if (existente) {
    await db.regrasImportacao.update(existente.id, {
      nomeExibido,
      envelopeId,
      categoriaId,
      usos: existente.usos + 1,
      atualizadoEm: agora,
    })
    return
  }
  const regra: RegraImportacao = {
    id: novoId(),
    chave,
    nomeExibido,
    envelopeId,
    categoriaId,
    usos: 1,
    atualizadoEm: agora,
  }
  await db.regrasImportacao.put(regra)
}

export async function fingerprintsJaImportados(fps: string[]) {
  if (fps.length === 0) return new Set<string>()
  const existentes = await db.lancamentos.where('importFingerprint').anyOf(fps).toArray()
  return new Set(existentes.map((l) => l.importFingerprint!).filter(Boolean))
}

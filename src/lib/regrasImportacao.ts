import { db, novoId } from './db'
import { resolverNomeCategoriaNubank } from './categoriasNubank'
import type { Categoria, Envelope, RegraImportacao } from './types'
import type { TxNubank } from './nubankShared'

/** Sugestões frouxas só para a primeira vez — não grava até você confirmar. */
const HEURISTICAS: Array<{ teste: RegExp; envelopes: string[] }> = [
  { teste: /gigante|condor|mercado|atacad|salome|armazem|panificadora|carrefour|assai|atacadao/i, envelopes: ['Supermercado'] },
  { teste: /farmac|drog|raia|unipreco|medprev|cuidar|panvel/i, envelopes: ['Saúde'] },
  { teste: /posto|nutag|uber|combust|forca do oleo|costaauto|shell|ipiranga|99\s*app/i, envelopes: ['Transporte'] },
  {
    teste: /restaurante|ifood|pampa|grill|beer|duff|assados|domin[oó]|pia do ovo|sokulski|baraquias|rappi/i,
    envelopes: ['Restaurante'],
  },
  { teste: /lavanderia|araulav|enel|copel|sanepar|claro|vivo|tim|oi\b/i, envelopes: ['Casa', 'Serviços'] },
  {
    teste: /amazonprime|youtube|netflix|spotify|google|claude|cursor|opus clip|nucel|disney|hbo|paramount/i,
    envelopes: ['Serviços'],
  },
  { teste: /patyy|petz|cobasi/i, envelopes: ['Pets'] },
  { teste: /avilas gym|academia|smart\s*fit/i, envelopes: ['Saúde'] },
  { teste: /renner|zara|cea|c&a|shein|nike|adidas/i, envelopes: ['Vestuário'] },
  { teste: /magazine|americanas|casas bahia|amazon|kabum|fast\s*shop/i, envelopes: ['Eletrônicos', 'Outros'] },
  { teste: /gol\b|latam|azul\b|booking|airbnb|hotel/i, envelopes: ['Viagens'] },
  { teste: /dizimo|dízimo|igreja|oferta/i, envelopes: ['Dízimo'] },
]

function acharEnvelope(envelopes: Envelope[], nomes: string[]) {
  return nomes
    .map((nome) => envelopes.find((e) => !e.arquivado && e.nome.toLowerCase() === nome.toLowerCase()))
    .find(Boolean)
}

function acharCategoria(categorias: Categoria[], nome: string | null) {
  if (!nome) return null
  const oficial = resolverNomeCategoriaNubank(nome) ?? nome
  return categorias.find((c) => !c.arquivada && c.nome.toLowerCase() === oficial.toLowerCase()) ?? null
}

export function sugerirEnvelope(
  tx: TxNubank,
  envelopes: Envelope[],
  regras: RegraImportacao[],
  categorias: Categoria[] = [],
  categoriaBanco?: string | null,
) {
  const regra = regras.find((r) => r.chave === tx.chave)
  if (regra) {
    return {
      envelopeId: regra.envelopeId,
      categoriaId: regra.categoriaId,
      origem: 'regra' as const,
    }
  }

  // Categoria vinda do Nubank/Pluggy → envelope de mesmo nome.
  const nomeCat = resolverNomeCategoriaNubank(categoriaBanco)
  if (nomeCat) {
    const envelope =
      acharEnvelope(envelopes, [nomeCat, nomeCat === 'Doações' ? 'Dízimo' : nomeCat]) ??
      envelopes.find((e) => !e.arquivado && e.categoriaId && categorias.find((c) => c.id === e.categoriaId)?.nome === nomeCat)
    const categoria = acharCategoria(categorias, nomeCat)
    if (envelope || categoria) {
      return {
        envelopeId: envelope?.id ?? null,
        categoriaId: envelope?.categoriaId ?? categoria?.id ?? null,
        origem: 'heuristica' as const,
      }
    }
  }

  for (const h of HEURISTICAS) {
    if (!h.teste.test(tx.estabelecimento) && !h.teste.test(tx.chave)) continue
    const envelope = acharEnvelope(envelopes, h.envelopes)
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

import { naSemana } from './semana'
import type { Lancamento, MetaModelo, MetaSemana } from './types'

export const METAS_SEED: MetaModelo[] = [
  {
    id: 'meta-ifood',
    nome: 'Zero iFood',
    tipo: 'limite-quantidade',
    parametros: { filtro: 'delivery', quantidade: 0 },
    ativaPorPadrao: false,
  },
  {
    id: 'meta-restaurante',
    nome: 'Teto de restaurante',
    tipo: 'limite-valor',
    parametros: { categoriaId: 'cat-restaurante', valor: 150 },
    ativaPorPadrao: false,
  },
  {
    id: 'meta-mercado',
    nome: 'Idas ao mercado',
    tipo: 'limite-quantidade',
    parametros: { categoriaId: 'cat-mercado', quantidade: 2 },
    ativaPorPadrao: false,
  },
  {
    id: 'meta-parcela',
    nome: 'Nenhuma parcela nova',
    tipo: 'zero-parcelamento-novo',
    parametros: {},
    ativaPorPadrao: false,
  },
  {
    id: 'meta-filme',
    nome: 'Nenhum aluguel de filme',
    tipo: 'limite-quantidade',
    parametros: { estabelecimentoChave: 'amazon prime aluguel', quantidade: 0 },
    ativaPorPadrao: false,
  },
  {
    id: 'meta-guardar',
    nome: 'Guardar na semana',
    tipo: 'guardar',
    parametros: { valor: 100 },
    ativaPorPadrao: false,
  },
  {
    id: 'meta-livre',
    nome: 'Meta livre',
    tipo: 'livre',
    parametros: { texto: '' },
    ativaPorPadrao: false,
  },
]

export type ResultadoMeta = {
  cumprida: boolean
  detalhe: string
  manual: boolean
}

function ehDelivery(linha: Pick<Lancamento, 'descricaoOriginal' | 'estabelecimentoChave'>) {
  const texto = linha.descricaoOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\*/g, ' ')
  return /^ifd\b/.test(texto) || linha.estabelecimentoChave.includes('99food')
}

function linhasDaSemana(lancamentos: readonly Lancamento[], semana: string) {
  return lancamentos.filter((linha) => naSemana(linha.data, semana))
}

function gasto(linhas: readonly Lancamento[], categoriaId?: string) {
  let total = 0
  for (const linha of linhas) {
    if (categoriaId && linha.categoriaId !== categoriaId) continue
    if (linha.compromissoId) continue
    total += linha.sinal === 'entrada' ? -linha.valor : linha.valor
  }
  return total
}

function contar(linhas: readonly Lancamento[], aceita: (linha: Lancamento) => boolean) {
  return linhas.filter((linha) => linha.sinal === 'saida' && !linha.compromissoId && aceita(linha)).length
}

export function avaliarMeta(
  modelo: MetaModelo,
  meta: Pick<MetaSemana, 'cumprida'> | undefined,
  semana: string,
  lancamentos: readonly Lancamento[],
): ResultadoMeta {
  const daSemana = linhasDaSemana(lancamentos, semana)
  const params = modelo.parametros

  if (modelo.tipo === 'livre') {
    const texto = String(params.texto || modelo.nome)
    return { cumprida: meta?.cumprida === true, detalhe: texto, manual: true }
  }

  if (modelo.tipo === 'zero-parcelamento-novo') {
    const novas = daSemana.filter((linha) => linha.parcelaAtual === 1)
    return {
      cumprida: novas.length === 0,
      detalhe: novas.length === 0 ? 'Nenhuma parcela nova' : `${novas.length} parcela nova`,
      manual: false,
    }
  }

  if (modelo.tipo === 'guardar') {
    const alvo = Number(params.valor) || 0
    const guardado = daSemana
      .filter((linha) => linha.categoriaId === 'cat-investimento' && linha.sinal === 'saida')
      .reduce((total, linha) => total + linha.valor, 0)
    return {
      cumprida: guardado >= alvo,
      detalhe: `${guardado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${alvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      manual: false,
    }
  }

  if (modelo.tipo === 'limite-valor' || modelo.tipo === 'zero-categoria') {
    const categoriaId = String(params.categoriaId || '')
    const valor = gasto(daSemana, categoriaId)
    const teto = modelo.tipo === 'zero-categoria' ? 0 : Number(params.valor) || 0
    return {
      cumprida: valor <= teto,
      detalhe: `${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${teto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      manual: false,
    }
  }

  const quantidade = Number(params.quantidade) || 0
  const chave = params.estabelecimentoChave ? String(params.estabelecimentoChave) : ''
  const categoriaId = params.categoriaId ? String(params.categoriaId) : ''
  const filtro = params.filtro ? String(params.filtro) : ''
  const total = contar(daSemana, (linha) => {
    if (filtro === 'delivery') return ehDelivery(linha)
    if (chave) return linha.estabelecimentoChave === chave
    if (categoriaId) return linha.categoriaId === categoriaId
    return false
  })
  return {
    cumprida: total <= quantidade,
    detalhe: `${total} de ${quantidade}`,
    manual: false,
  }
}

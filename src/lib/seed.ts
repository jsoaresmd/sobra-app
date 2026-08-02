import { db, novoId } from './db'
import type { Categoria, Config, Conta, Envelope } from './types'

const CATEGORIAS_PADRAO: Omit<Categoria, 'id'>[] = [
  { nome: 'Mercado', emoji: '🛒', cor: '#2f9e6e', grupo: 'essencial', orcamento: 0, ordem: 0 },
  { nome: 'Restaurante e delivery', emoji: '🍔', cor: '#e8734a', grupo: 'variavel', orcamento: 0, ordem: 1 },
  { nome: 'Transporte', emoji: '⛽', cor: '#3f7ec4', grupo: 'essencial', orcamento: 0, ordem: 2 },
  { nome: 'Casa', emoji: '🏠', cor: '#8a6cc4', grupo: 'essencial', orcamento: 0, ordem: 3 },
  { nome: 'Saúde', emoji: '💊', cor: '#d4557f', grupo: 'essencial', orcamento: 0, ordem: 4 },
  { nome: 'Educação', emoji: '🎓', cor: '#2c8fa6', grupo: 'essencial', orcamento: 0, ordem: 5 },
  { nome: 'Assinaturas', emoji: '📺', cor: '#6f7ce0', grupo: 'essencial', orcamento: 0, ordem: 6 },
  { nome: 'Lazer', emoji: '🎬', cor: '#c9821f', grupo: 'variavel', orcamento: 0, ordem: 7 },
  { nome: 'Compras', emoji: '🛍️', cor: '#b4529c', grupo: 'variavel', orcamento: 0, ordem: 8 },
  { nome: 'Pets', emoji: '🐾', cor: '#7a9b3d', grupo: 'variavel', orcamento: 0, ordem: 9 },
  { nome: 'Presentes', emoji: '🎁', cor: '#c2565a', grupo: 'variavel', orcamento: 0, ordem: 10 },
  { nome: 'Outros', emoji: '✨', cor: '#7b8794', grupo: 'variavel', orcamento: 0, ordem: 11 },
]

const CONTAS_PADRAO: Omit<Conta, 'id'>[] = [
  { nome: 'Nubank', tipo: 'credito', cor: '#8a05be', diaFechamento: 3, diaVencimento: 10, ordem: 0 },
  { nome: 'Conta corrente', tipo: 'debito', cor: '#3f7ec4', ordem: 1 },
  { nome: 'Dinheiro', tipo: 'dinheiro', cor: '#2f9e6e', ordem: 2 },
]

/** Envelopes iniciais pensados no fluxo da família (valores zerados para o usuário preencher). */
const ENVELOPES_PADRAO: Array<Omit<Envelope, 'id' | 'categoriaId' | 'recorrenteId' | 'cicloAlocado' | 'saldo'> & { categoriaNome?: string }> = [
  { nome: 'Dízimo', emoji: '🙏', cor: '#6f7ce0', tipo: 'fixo', valorMensal: 0, ordem: 0 },
  { nome: 'Casa', emoji: '🏠', cor: '#8a6cc4', tipo: 'fixo', valorMensal: 0, ordem: 1, categoriaNome: 'Casa' },
  { nome: 'Financiamento', emoji: '🚗', cor: '#3f7ec4', tipo: 'fixo', valorMensal: 0, ordem: 2 },
  { nome: 'Internet', emoji: '📶', cor: '#2c8fa6', tipo: 'fixo', valorMensal: 0, ordem: 3 },
  { nome: 'Mercado', emoji: '🛒', cor: '#2f9e6e', tipo: 'variavel', valorMensal: 0, ordem: 4, categoriaNome: 'Mercado' },
  { nome: 'Pets', emoji: '🐾', cor: '#7a9b3d', tipo: 'variavel', valorMensal: 0, ordem: 5, categoriaNome: 'Pets' },
  { nome: 'Saúde', emoji: '💊', cor: '#d4557f', tipo: 'variavel', valorMensal: 0, ordem: 6, categoriaNome: 'Saúde' },
  { nome: 'Transporte', emoji: '⛽', cor: '#3f7ec4', tipo: 'variavel', valorMensal: 0, ordem: 7, categoriaNome: 'Transporte' },
  { nome: 'Restaurante', emoji: '🍔', cor: '#e8734a', tipo: 'variavel', valorMensal: 0, ordem: 8, categoriaNome: 'Restaurante e delivery' },
  { nome: 'Lazer', emoji: '🎬', cor: '#c9821f', tipo: 'variavel', valorMensal: 0, ordem: 9, categoriaNome: 'Lazer' },
  { nome: 'Assinaturas', emoji: '📺', cor: '#6f7ce0', tipo: 'variavel', valorMensal: 0, ordem: 10, categoriaNome: 'Assinaturas' },
  { nome: 'Investimentos', emoji: '📈', cor: '#14855f', tipo: 'investimento', valorMensal: 0, ordem: 11 },
]

export function configPadrao(): Config {
  return {
    id: 'app',
    rendaMensal: 0,
    diaInicioCiclo: 1,
    metaPoupanca: 0,
    alertaEm: 0.85,
    pessoas: [
      { id: novoId(), nome: 'Eu', cor: '#4f52d6' },
      { id: novoId(), nome: 'Nós dois', cor: '#c9821f' },
    ],
    onboardingFeito: false,
  }
}

/** Evita que o StrictMode (e qualquer remount) rode o seed duas vezes em paralelo. */
let inicializacao: Promise<void> | null = null

function escolherConta(a: Conta, b: Conta) {
  const pontos = (c: Conta) =>
    (c.saldo ? 4 : 0) + (c.faturaInformada ? 4 : 0) + (c.limite ? 1 : 0) + (c.diaFechamento ? 1 : 0)
  const diff = pontos(b) - pontos(a)
  if (diff !== 0) return diff < 0 ? a : b
  if (a.ordem !== b.ordem) return a.ordem < b.ordem ? a : b
  return a.id < b.id ? a : b
}

function escolherCategoria(a: Categoria, b: Categoria) {
  const pontos = (c: Categoria) => (c.orcamento > 0 ? 2 : 0) + (c.arquivada ? -1 : 0)
  const diff = pontos(b) - pontos(a)
  if (diff !== 0) return diff < 0 ? a : b
  if (a.ordem !== b.ordem) return a.ordem < b.ordem ? a : b
  return a.id < b.id ? a : b
}

async function limparDuplicatas() {
  await db.transaction('rw', db.contas, db.categorias, db.lancamentos, db.recorrentes, async () => {
    const contas = await db.contas.toArray()
    const porNome = new Map<string, Conta[]>()
    for (const c of contas) {
      const chave = `${c.tipo}|${c.nome.trim().toLowerCase()}`
      const lista = porNome.get(chave) ?? []
      lista.push(c)
      porNome.set(chave, lista)
    }

    for (const grupo of porNome.values()) {
      if (grupo.length < 2) continue
      const vencedor = grupo.reduce(escolherConta)
      const perdedores = grupo.filter((c) => c.id !== vencedor.id)
      for (const perdedor of perdedores) {
        await db.lancamentos.where('contaId').equals(perdedor.id).modify({ contaId: vencedor.id })
        await db.recorrentes.filter((r) => r.contaId === perdedor.id).modify({ contaId: vencedor.id })
        await db.contas.delete(perdedor.id)
      }
    }

    const categorias = await db.categorias.toArray()
    const catsPorNome = new Map<string, Categoria[]>()
    for (const c of categorias) {
      const chave = c.nome.trim().toLowerCase()
      const lista = catsPorNome.get(chave) ?? []
      lista.push(c)
      catsPorNome.set(chave, lista)
    }

    for (const grupo of catsPorNome.values()) {
      if (grupo.length < 2) continue
      const vencedor = grupo.reduce(escolherCategoria)
      const perdedores = grupo.filter((c) => c.id !== vencedor.id)
      for (const perdedor of perdedores) {
        await db.lancamentos.where('categoriaId').equals(perdedor.id).modify({ categoriaId: vencedor.id })
        await db.recorrentes.filter((r) => r.categoriaId === perdedor.id).modify({ categoriaId: vencedor.id })
        await db.categorias.delete(perdedor.id)
      }
    }
  })
}

async function semearSeVazio() {
  await db.transaction('rw', db.config, db.categorias, db.contas, async () => {
    const jaTem = await db.config.get('app')
    if (jaTem) return

    await db.config.put(configPadrao())
    await db.categorias.bulkPut(CATEGORIAS_PADRAO.map((c) => ({ ...c, id: novoId() })))
    await db.contas.bulkPut(CONTAS_PADRAO.map((c) => ({ ...c, id: novoId() })))
  })
}

/** Cria os envelopes padrão uma vez, ligando-os às categorias pelo nome. */
async function semearEnvelopesSeVazio() {
  const qtd = await db.envelopes.count()
  if (qtd > 0) return

  const categorias = await db.categorias.toArray()
  const porNome = new Map(categorias.map((c) => [c.nome.trim().toLowerCase(), c]))

  const envelopes: Envelope[] = ENVELOPES_PADRAO.map((padrao) => {
    const categoria = padrao.categoriaNome ? porNome.get(padrao.categoriaNome.toLowerCase()) : undefined
    return {
      id: novoId(),
      nome: padrao.nome,
      emoji: padrao.emoji,
      cor: padrao.cor,
      tipo: padrao.tipo,
      valorMensal: categoria?.orcamento && categoria.orcamento > 0 ? categoria.orcamento : padrao.valorMensal,
      saldo: 0,
      cicloAlocado: null,
      categoriaId: categoria?.id ?? null,
      recorrenteId: null,
      ordem: padrao.ordem,
    }
  })

  await db.envelopes.bulkPut(envelopes)
}

/** Cria envelopes que faltam em instalações antigas (ex.: Saúde, Assinaturas). */
async function garantirEnvelopesExtras() {
  const existentes = await db.envelopes.toArray()
  if (existentes.length === 0) return

  const nomes = new Set(existentes.map((e) => e.nome.trim().toLowerCase()))
  const categorias = await db.categorias.toArray()
  const porNome = new Map(categorias.map((c) => [c.nome.trim().toLowerCase(), c]))
  const extras = ENVELOPES_PADRAO.filter((e) => !nomes.has(e.nome.toLowerCase()))
  if (extras.length === 0) return

  const ordemBase = existentes.length
  await db.envelopes.bulkPut(
    extras.map((padrao, i) => {
      const categoria = padrao.categoriaNome ? porNome.get(padrao.categoriaNome.toLowerCase()) : undefined
      return {
        id: novoId(),
        nome: padrao.nome,
        emoji: padrao.emoji,
        cor: padrao.cor,
        tipo: padrao.tipo,
        valorMensal: 0,
        saldo: 0,
        cicloAlocado: null,
        categoriaId: categoria?.id ?? null,
        recorrenteId: null,
        ordem: ordemBase + i,
      }
    }),
  )
}

/** Cria os dados iniciais na primeira abertura e limpa duplicatas de seeds antigos. */
export function garantirDadosIniciais() {
  if (!inicializacao) {
    inicializacao = (async () => {
      await semearSeVazio()
      await limparDuplicatas()
      await semearEnvelopesSeVazio()
      await garantirEnvelopesExtras()
    })().catch((erro) => {
      inicializacao = null
      throw erro
    })
  }
  return inicializacao
}

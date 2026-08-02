import { db, novoId } from './db'
import {
  CATEGORIAS_NUBANK,
  ENVELOPES_NUBANK,
  normalizarNomeCategoria,
  resolverNomeCategoriaNubank,
} from './categoriasNubank'
import type { Categoria, Config, Conta, Envelope } from './types'

const CONTAS_PADRAO: Omit<Conta, 'id'>[] = [
  { nome: 'Nubank', tipo: 'credito', cor: '#8a05be', diaFechamento: 4, diaVencimento: 11, ordem: 0 },
  { nome: 'Conta corrente', tipo: 'debito', cor: '#3f7ec4', ordem: 1 },
  { nome: 'Dinheiro', tipo: 'dinheiro', cor: '#2f9e6e', ordem: 2 },
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
  await db.transaction('rw', db.contas, db.categorias, db.lancamentos, db.recorrentes, db.envelopes, async () => {
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
        await db.envelopes.filter((e) => e.categoriaId === perdedor.id).modify({ categoriaId: vencedor.id })
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
    await db.categorias.bulkPut(
      CATEGORIAS_NUBANK.map((c, ordem) => ({
        id: novoId(),
        nome: c.nome,
        emoji: c.emoji,
        cor: c.cor,
        grupo: c.grupo,
        orcamento: 0,
        ordem,
      })),
    )
    await db.contas.bulkPut(CONTAS_PADRAO.map((c) => ({ ...c, id: novoId() })))
  })
}

/** Cria os envelopes padrão uma vez, ligando-os às categorias pelo nome. */
async function semearEnvelopesSeVazio() {
  const qtd = await db.envelopes.count()
  if (qtd > 0) return

  const categorias = await db.categorias.toArray()
  const porNome = new Map(categorias.map((c) => [normalizarNomeCategoria(c.nome), c]))

  const envelopes: Envelope[] = ENVELOPES_NUBANK.map((padrao, ordem) => {
    const categoria = padrao.categoriaNome
      ? porNome.get(normalizarNomeCategoria(padrao.categoriaNome))
      : undefined
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
      ordem,
    }
  })

  await db.envelopes.bulkPut(envelopes)
}

/**
 * Alinha instalações antigas às categorias do Nubank:
 * renomeia (Mercado→Supermercado…), cria as que faltam e arquiva legado.
 */
async function alinharCategoriasNubank() {
  await db.transaction('rw', db.categorias, db.envelopes, db.lancamentos, db.recorrentes, db.regrasImportacao, async () => {
    const existentes = await db.categorias.toArray()
    const porChave = new Map(existentes.map((c) => [normalizarNomeCategoria(c.nome), c]))

    // 1) Renomear categorias legadas para o nome Nubank.
    for (const cat of existentes) {
      const alvo = resolverNomeCategoriaNubank(cat.nome)
      if (!alvo || alvo === cat.nome) continue
      const chaveAlvo = normalizarNomeCategoria(alvo)
      const jaTemAlvo = porChave.get(chaveAlvo)
      if (jaTemAlvo && jaTemAlvo.id !== cat.id) {
        await db.lancamentos.where('categoriaId').equals(cat.id).modify({ categoriaId: jaTemAlvo.id })
        await db.recorrentes.filter((r) => r.categoriaId === cat.id).modify({ categoriaId: jaTemAlvo.id })
        await db.envelopes.filter((e) => e.categoriaId === cat.id).modify({ categoriaId: jaTemAlvo.id })
        await db.regrasImportacao.filter((r) => r.categoriaId === cat.id).modify({ categoriaId: jaTemAlvo.id })
        await db.categorias.delete(cat.id)
        porChave.delete(normalizarNomeCategoria(cat.nome))
        continue
      }
      const def = CATEGORIAS_NUBANK.find((d) => d.nome === alvo)!
      await db.categorias.update(cat.id, {
        nome: def.nome,
        emoji: def.emoji,
        cor: def.cor,
        grupo: def.grupo,
        arquivada: false,
      })
      porChave.delete(normalizarNomeCategoria(cat.nome))
      porChave.set(chaveAlvo, { ...cat, nome: def.nome, emoji: def.emoji, cor: def.cor, grupo: def.grupo })
    }

    // 2) Criar categorias Nubank que ainda não existem.
    const atuais = await db.categorias.toArray()
    const nomesAtuais = new Set(atuais.map((c) => normalizarNomeCategoria(c.nome)))
    const ordemBase = atuais.length
    const novas: Categoria[] = []
    CATEGORIAS_NUBANK.forEach((def, i) => {
      if (nomesAtuais.has(normalizarNomeCategoria(def.nome))) return
      novas.push({
        id: novoId(),
        nome: def.nome,
        emoji: def.emoji,
        cor: def.cor,
        grupo: def.grupo,
        orcamento: 0,
        ordem: ordemBase + i,
      })
    })
    if (novas.length) await db.categorias.bulkPut(novas)

    // 3) Ordenar / garantir emoji das oficiais; arquivar o que não está na lista.
    const oficiais = new Set(CATEGORIAS_NUBANK.map((c) => normalizarNomeCategoria(c.nome)))
    const depois = await db.categorias.toArray()
    for (const cat of depois) {
      const chave = normalizarNomeCategoria(cat.nome)
      const def = CATEGORIAS_NUBANK.find((d) => normalizarNomeCategoria(d.nome) === chave)
      if (def) {
        const ordem = CATEGORIAS_NUBANK.findIndex((d) => d.nome === def.nome)
        await db.categorias.update(cat.id, {
          emoji: def.emoji,
          cor: def.cor,
          grupo: def.grupo,
          ordem,
          arquivada: false,
        })
      } else if (!oficiais.has(chave) && !cat.arquivada) {
        await db.categorias.update(cat.id, { arquivada: true })
      }
    }

    // 4) Renomear envelopes legados (Mercado→Supermercado, Assinaturas→Serviços).
    const envelopes = await db.envelopes.toArray()
    const catsFinais = await db.categorias.toArray()
    const catPorNome = new Map(catsFinais.map((c) => [normalizarNomeCategoria(c.nome), c]))

    for (const env of envelopes) {
      const def = ENVELOPES_NUBANK.find(
        (d) =>
          normalizarNomeCategoria(d.nome) === normalizarNomeCategoria(env.nome) ||
          d.aliases?.some((a) => normalizarNomeCategoria(a) === normalizarNomeCategoria(env.nome)),
      )
      if (!def) continue
      const categoria = def.categoriaNome ? catPorNome.get(normalizarNomeCategoria(def.categoriaNome)) : undefined
      await db.envelopes.update(env.id, {
        nome: def.nome,
        emoji: def.emoji,
        cor: def.cor,
        tipo: def.tipo,
        categoriaId: categoria?.id ?? env.categoriaId,
        arquivado: false,
      })
    }

    // 5) Criar envelopes Nubank que faltam.
    const envelopesDepois = await db.envelopes.toArray()
    const nomesEnv = new Set(envelopesDepois.map((e) => normalizarNomeCategoria(e.nome)))
    const ordemEnv = envelopesDepois.length
    const novosEnv: Envelope[] = []
    ENVELOPES_NUBANK.forEach((def, i) => {
      if (nomesEnv.has(normalizarNomeCategoria(def.nome))) return
      if (def.aliases?.some((a) => nomesEnv.has(normalizarNomeCategoria(a)))) return
      const categoria = def.categoriaNome ? catPorNome.get(normalizarNomeCategoria(def.categoriaNome)) : undefined
      novosEnv.push({
        id: novoId(),
        nome: def.nome,
        emoji: def.emoji,
        cor: def.cor,
        tipo: def.tipo,
        valorMensal: 0,
        saldo: 0,
        cicloAlocado: null,
        categoriaId: categoria?.id ?? null,
        recorrenteId: null,
        ordem: ordemEnv + i,
      })
    })
    if (novosEnv.length) await db.envelopes.bulkPut(novosEnv)
  })
}

/** Cria os dados iniciais na primeira abertura e limpa duplicatas de seeds antigos. */
export function garantirDadosIniciais() {
  if (!inicializacao) {
    inicializacao = (async () => {
      await semearSeVazio()
      await limparDuplicatas()
      await semearEnvelopesSeVazio()
      await alinharCategoriasNubank()
    })().catch((erro) => {
      inicializacao = null
      throw erro
    })
  }
  return inicializacao
}

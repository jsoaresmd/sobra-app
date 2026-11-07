import { avisarMudanca, semAvisar } from './mudanca'
import { supabase, userIdAtual } from './supabase'
import type {
  Categoria,
  Compromisso,
  Config,
  Estabelecimento,
  Importacao,
  Lancamento,
  MetaModelo,
  MetaSemana,
  PlanoMes,
  Revisao,
} from './types'

function falhou(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export type PacoteDados = {
  config: Config | undefined
  categorias: Categoria[]
  estabelecimentos: Estabelecimento[]
  lancamentos: Lancamento[]
  compromissos: Compromisso[]
  metasModelo: MetaModelo[]
  metasSemana: MetaSemana[]
  revisoes: Revisao[]
  importacoes: Importacao[]
  planosMes: PlanoMes[]
}

export async function carregarTudo(): Promise<PacoteDados> {
  const uid = await userIdAtual()
  const [
    configRes,
    categoriasRes,
    estabelecimentosRes,
    lancamentosRes,
    compromissosRes,
    metasModeloRes,
    metasSemanaRes,
    revisoesRes,
    importacoesRes,
    planosMesRes,
  ] = await Promise.all([
    supabase.from('config').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('categorias').select('*').eq('user_id', uid).order('ordem'),
    supabase.from('estabelecimentos').select('*').eq('user_id', uid),
    supabase.from('lancamentos').select('*').eq('user_id', uid),
    supabase.from('compromissos').select('*').eq('user_id', uid),
    supabase.from('metas_modelo').select('*').eq('user_id', uid),
    supabase.from('metas_semana').select('*').eq('user_id', uid),
    supabase.from('revisoes').select('*').eq('user_id', uid).order('semana_inicio', { ascending: false }),
    supabase.from('importacoes').select('*').eq('user_id', uid),
    supabase.from('planos_mes').select('*').eq('user_id', uid),
  ])

  for (const res of [
    configRes,
    categoriasRes,
    estabelecimentosRes,
    lancamentosRes,
    compromissosRes,
    metasModeloRes,
    metasSemanaRes,
    revisoesRes,
    importacoesRes,
    planosMesRes,
  ]) {
    falhou(res.error)
  }

  return {
    config: configRes.data ? deConfig(configRes.data) : undefined,
    categorias: (categoriasRes.data ?? []).map(deCategoria),
    estabelecimentos: (estabelecimentosRes.data ?? []).map(deEstabelecimento),
    lancamentos: (lancamentosRes.data ?? []).map(deLancamento),
    compromissos: (compromissosRes.data ?? []).map(deCompromisso),
    metasModelo: (metasModeloRes.data ?? []).map(deMetaModelo),
    metasSemana: (metasSemanaRes.data ?? []).map(deMetaSemana),
    revisoes: (revisoesRes.data ?? []).map(deRevisao),
    importacoes: (importacoesRes.data ?? []).map(deImportacao),
    planosMes: (planosMesRes.data ?? []).map(dePlanoMes),
  }
}

export async function upsertConfig(config: Config) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('config').upsert(paraConfig(config, user_id))
  falhou(error)
  avisarMudanca()
}

export async function upsertCategorias(itens: Categoria[]) {
  if (!itens.length) return
  const user_id = await userIdAtual()
  const { error } = await supabase.from('categorias').upsert(itens.map((item) => paraCategoria(item, user_id)))
  falhou(error)
  avisarMudanca()
}

export async function updateCategoria(id: string, mudancas: Partial<Categoria>) {
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('categorias')
    .update(paraCategoriaParcial(mudancas))
    .eq('id', id)
    .eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function insertCategoria(item: Categoria) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('categorias').insert(paraCategoria(item, user_id))
  falhou(error)
  avisarMudanca()
}

export async function upsertEstabelecimentos(itens: Estabelecimento[]) {
  if (!itens.length) return
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('estabelecimentos')
    .upsert(itens.map((item) => paraEstabelecimento(item, user_id)))
  falhou(error)
  avisarMudanca()
}

export async function updateEstabelecimento(id: string, mudancas: Partial<Estabelecimento>) {
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('estabelecimentos')
    .update(paraEstabelecimentoParcial(mudancas))
    .eq('id', id)
    .eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function upsertCompromissos(itens: Compromisso[]) {
  if (!itens.length) return
  const user_id = await userIdAtual()
  const { error } = await supabase.from('compromissos').upsert(itens.map((item) => paraCompromisso(item, user_id)))
  falhou(error)
  avisarMudanca()
}

export async function updateCompromisso(id: string, mudancas: Partial<Compromisso>) {
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('compromissos')
    .update(paraCompromissoParcial(mudancas))
    .eq('id', id)
    .eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function insertCompromisso(item: Compromisso) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('compromissos').insert(paraCompromisso(item, user_id))
  falhou(error)
  avisarMudanca()
}

export async function deleteCompromisso(id: string) {
  const user_id = await userIdAtual()
  const { error: e1 } = await supabase
    .from('lancamentos')
    .update({ compromisso_id: null })
    .eq('user_id', user_id)
    .eq('compromisso_id', id)
  falhou(e1)
  const { error: e2 } = await supabase
    .from('estabelecimentos')
    .update({ compromisso_id: null })
    .eq('user_id', user_id)
    .eq('compromisso_id', id)
  falhou(e2)
  const { error: e3 } = await supabase.from('compromissos').delete().eq('id', id).eq('user_id', user_id)
  falhou(e3)
  avisarMudanca()
}

export async function upsertLancamentos(itens: Lancamento[]) {
  if (!itens.length) return
  const user_id = await userIdAtual()
  const { error } = await supabase.from('lancamentos').upsert(itens.map((item) => paraLancamento(item, user_id)))
  falhou(error)
  avisarMudanca()
}

export async function updateLancamento(id: string, mudancas: Partial<Lancamento>) {
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('lancamentos')
    .update(paraLancamentoParcial(mudancas))
    .eq('id', id)
    .eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function updateLancamentosPorEstabelecimento(
  chave: string,
  mudancas: Partial<Pick<Lancamento, 'categoriaId' | 'confirmarEntrada'>>,
) {
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('lancamentos')
    .update(paraLancamentoParcial(mudancas))
    .eq('user_id', user_id)
    .eq('estabelecimento_chave', chave)
  falhou(error)
  avisarMudanca()
}

export async function deleteLancamento(id: string) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function upsertMetasModelo(itens: MetaModelo[]) {
  if (!itens.length) return
  const user_id = await userIdAtual()
  const { error } = await supabase.from('metas_modelo').upsert(itens.map((item) => paraMetaModelo(item, user_id)))
  falhou(error)
  avisarMudanca()
}

export async function insertMetaModelo(item: MetaModelo) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('metas_modelo').insert(paraMetaModelo(item, user_id))
  falhou(error)
  avisarMudanca()
}

export async function deleteMetaModelo(id: string) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('metas_modelo').delete().eq('id', id).eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function upsertMetasSemana(itens: MetaSemana[]) {
  if (!itens.length) return
  const user_id = await userIdAtual()
  const { error } = await supabase.from('metas_semana').upsert(itens.map((item) => paraMetaSemana(item, user_id)))
  falhou(error)
  avisarMudanca()
}

export async function updateMetaSemana(id: string, mudancas: Partial<MetaSemana>) {
  const user_id = await userIdAtual()
  const { error } = await supabase
    .from('metas_semana')
    .update(paraMetaSemanaParcial(mudancas))
    .eq('id', id)
    .eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function deleteMetasSemanaDaSemana(semana: string) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('metas_semana').delete().eq('user_id', user_id).eq('semana', semana)
  falhou(error)
  avisarMudanca()
}

export async function insertRevisao(item: Revisao) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('revisoes').insert(paraRevisao(item, user_id))
  falhou(error)
  avisarMudanca()
}

export async function deleteRevisao(id: string) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('revisoes').delete().eq('id', id).eq('user_id', user_id)
  falhou(error)
  avisarMudanca()
}

export async function insertImportacao(item: Importacao) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('importacoes').insert(paraImportacao(item, user_id))
  falhou(error)
  avisarMudanca()
}

export async function upsertPlanoMes(item: PlanoMes) {
  const user_id = await userIdAtual()
  const { error } = await supabase.from('planos_mes').upsert(paraPlanoMes(item, user_id))
  falhou(error)
  avisarMudanca()
}

export async function getPlanoMes(mes: string) {
  const user_id = await userIdAtual()
  const { data, error } = await supabase.from('planos_mes').select('*').eq('user_id', user_id).eq('mes', mes).maybeSingle()
  falhou(error)
  return data ? dePlanoMes(data) : undefined
}

export async function getConfig() {
  const user_id = await userIdAtual()
  const { data, error } = await supabase.from('config').select('*').eq('user_id', user_id).maybeSingle()
  falhou(error)
  return data ? deConfig(data) : undefined
}

export async function buscarEstabelecimentoPorChave(chave: string) {
  const user_id = await userIdAtual()
  const { data, error } = await supabase
    .from('estabelecimentos')
    .select('*')
    .eq('user_id', user_id)
    .eq('chave_normalizada', chave)
    .maybeSingle()
  falhou(error)
  return data ? deEstabelecimento(data) : undefined
}

export async function buscarLancamento(id: string) {
  const user_id = await userIdAtual()
  const { data, error } = await supabase.from('lancamentos').select('*').eq('user_id', user_id).eq('id', id).maybeSingle()
  falhou(error)
  return data ? deLancamento(data) : undefined
}

export async function buscarCompromisso(id: string) {
  const user_id = await userIdAtual()
  const { data, error } = await supabase.from('compromissos').select('*').eq('user_id', user_id).eq('id', id).maybeSingle()
  falhou(error)
  return data ? deCompromisso(data) : undefined
}

export async function listarLancamentosPorEstabelecimento(chave: string) {
  const user_id = await userIdAtual()
  const { data, error } = await supabase
    .from('lancamentos')
    .select('*')
    .eq('user_id', user_id)
    .eq('estabelecimento_chave', chave)
  falhou(error)
  return (data ?? []).map(deLancamento)
}

export async function apagarTodosOsDadosRemotos() {
  const user_id = await userIdAtual()
  const tabelas = [
    'lancamentos',
    'estabelecimentos',
    'compromissos',
    'metas_semana',
    'metas_modelo',
    'revisoes',
    'importacoes',
    'planos_mes',
    'categorias',
    'config',
  ] as const
  for (const tabela of tabelas) {
    const { error } = await supabase.from(tabela).delete().eq('user_id', user_id)
    falhou(error)
  }
  avisarMudanca()
}

export async function substituirTudo(pacote: {
  config?: Config
  categorias: Categoria[]
  estabelecimentos: Estabelecimento[]
  lancamentos: Lancamento[]
  compromissos: Compromisso[]
  metasModelo: MetaModelo[]
  metasSemana: MetaSemana[]
  revisoes: Revisao[]
  importacoes: Importacao[]
  planosMes: PlanoMes[]
}) {
  await semAvisar(async () => {
    await apagarTodosOsDadosRemotos()
    const user_id = await userIdAtual()
    if (pacote.config) {
      const { error } = await supabase.from('config').upsert(paraConfig(pacote.config, user_id))
      falhou(error)
    }
    const lotes: Array<[string, Record<string, unknown>[]]> = [
      ['categorias', pacote.categorias.map((item) => paraCategoria(item, user_id))],
      ['estabelecimentos', pacote.estabelecimentos.map((item) => paraEstabelecimento(item, user_id))],
      ['compromissos', pacote.compromissos.map((item) => paraCompromisso(item, user_id))],
      ['lancamentos', pacote.lancamentos.map((item) => paraLancamento(item, user_id))],
      ['metas_modelo', pacote.metasModelo.map((item) => paraMetaModelo(item, user_id))],
      ['metas_semana', pacote.metasSemana.map((item) => paraMetaSemana(item, user_id))],
      ['revisoes', pacote.revisoes.map((item) => paraRevisao(item, user_id))],
      ['importacoes', pacote.importacoes.map((item) => paraImportacao(item, user_id))],
      ['planos_mes', pacote.planosMes.map((item) => paraPlanoMes(item, user_id))],
    ]
    for (const [tabela, rows] of lotes) {
      if (!rows.length) continue
      for (let i = 0; i < rows.length; i += 200) {
        const fatia = rows.slice(i, i + 200)
        const { error } = await supabase.from(tabela).upsert(fatia)
        falhou(error)
      }
    }
    avisarMudanca()
  })
}

// ——— mappers ———

type Row = Record<string, unknown>

function deConfig(row: Row): Config {
  return {
    id: 'app',
    renda: Number(row.renda ?? 0),
    metaGuardarMes: Number(row.meta_guardar_mes ?? 0),
    nomesTitular: (row.nomes_titular as string[]) ?? [],
    versao: 2,
  }
}

function paraConfig(item: Config, user_id: string) {
  return {
    user_id,
    renda: item.renda,
    meta_guardar_mes: item.metaGuardarMes,
    nomes_titular: item.nomesTitular,
    versao: item.versao,
  }
}

function deCategoria(row: Row): Categoria {
  return {
    id: String(row.id),
    nome: String(row.nome),
    emoji: String(row.emoji ?? '📌'),
    cor: String(row.cor ?? '#5a6b8c'),
    tipo: row.tipo as Categoria['tipo'],
    tetoMensal: Number(row.teto_mensal ?? 0),
    arquivada: Boolean(row.arquivada),
    ordem: Number(row.ordem ?? 0),
    paiId: (row.pai_id as string | null) ?? null,
  }
}

function paraCategoria(item: Categoria, user_id: string) {
  return {
    id: item.id,
    user_id,
    nome: item.nome,
    emoji: item.emoji,
    cor: item.cor,
    tipo: item.tipo,
    teto_mensal: item.tetoMensal,
    arquivada: item.arquivada,
    ordem: item.ordem,
    pai_id: item.paiId ?? null,
  }
}

function paraCategoriaParcial(mudancas: Partial<Categoria>) {
  const out: Record<string, unknown> = {}
  if (mudancas.nome !== undefined) out.nome = mudancas.nome
  if (mudancas.emoji !== undefined) out.emoji = mudancas.emoji
  if (mudancas.cor !== undefined) out.cor = mudancas.cor
  if (mudancas.tipo !== undefined) out.tipo = mudancas.tipo
  if (mudancas.tetoMensal !== undefined) out.teto_mensal = mudancas.tetoMensal
  if (mudancas.arquivada !== undefined) out.arquivada = mudancas.arquivada
  if (mudancas.ordem !== undefined) out.ordem = mudancas.ordem
  if (mudancas.paiId !== undefined) out.pai_id = mudancas.paiId
  return out
}

function deEstabelecimento(row: Row): Estabelecimento {
  return {
    id: String(row.id),
    chaveNormalizada: String(row.chave_normalizada),
    textoOriginal: String(row.texto_original ?? ''),
    apelido: String(row.apelido ?? ''),
    nota: String(row.nota ?? ''),
    categoriaId: (row.categoria_id as string | null) ?? null,
    compromissoId: (row.compromisso_id as string | null) ?? null,
  }
}

function paraEstabelecimento(item: Estabelecimento, user_id: string) {
  return {
    id: item.id,
    user_id,
    chave_normalizada: item.chaveNormalizada,
    texto_original: item.textoOriginal,
    apelido: item.apelido,
    nota: item.nota,
    categoria_id: item.categoriaId,
    compromisso_id: item.compromissoId ?? null,
  }
}

function paraEstabelecimentoParcial(mudancas: Partial<Estabelecimento>) {
  const out: Record<string, unknown> = {}
  if (mudancas.chaveNormalizada !== undefined) out.chave_normalizada = mudancas.chaveNormalizada
  if (mudancas.textoOriginal !== undefined) out.texto_original = mudancas.textoOriginal
  if (mudancas.apelido !== undefined) out.apelido = mudancas.apelido
  if (mudancas.nota !== undefined) out.nota = mudancas.nota
  if (mudancas.categoriaId !== undefined) out.categoria_id = mudancas.categoriaId
  if (mudancas.compromissoId !== undefined) out.compromisso_id = mudancas.compromissoId
  return out
}

function deCompromisso(row: Row): Compromisso {
  return {
    id: String(row.id),
    nome: String(row.nome),
    apelido: String(row.apelido ?? ''),
    tipo: row.tipo as Compromisso['tipo'],
    valor: Number(row.valor ?? 0),
    dia: row.dia == null ? undefined : Number(row.dia),
    parcelaAtual: row.parcela_atual == null ? undefined : Number(row.parcela_atual),
    parcelasTotal: row.parcelas_total == null ? undefined : Number(row.parcelas_total),
    mesFinal: (row.mes_final as string | undefined) ?? undefined,
    categoriaId: (row.categoria_id as string | null) ?? null,
    divida: Boolean(row.divida),
    saldoDevedor: row.saldo_devedor == null ? undefined : Number(row.saldo_devedor),
    jurosMes: row.juros_mes == null ? undefined : Number(row.juros_mes),
    parcelasRestantes: row.parcelas_restantes == null ? undefined : Number(row.parcelas_restantes),
    forma: (row.forma as Compromisso['forma']) ?? undefined,
    chaveVinculo: (row.chave_vinculo as string | undefined) ?? undefined,
  }
}

function paraCompromisso(item: Compromisso, user_id: string) {
  return {
    id: item.id,
    user_id,
    nome: item.nome,
    apelido: item.apelido,
    tipo: item.tipo,
    valor: item.valor,
    dia: item.dia ?? null,
    parcela_atual: item.parcelaAtual ?? null,
    parcelas_total: item.parcelasTotal ?? null,
    mes_final: item.mesFinal ?? null,
    categoria_id: item.categoriaId,
    divida: item.divida,
    saldo_devedor: item.saldoDevedor ?? null,
    juros_mes: item.jurosMes ?? null,
    parcelas_restantes: item.parcelasRestantes ?? null,
    forma: item.forma ?? null,
    chave_vinculo: item.chaveVinculo ?? null,
  }
}

function paraCompromissoParcial(mudancas: Partial<Compromisso>) {
  const out: Record<string, unknown> = {}
  if (mudancas.nome !== undefined) out.nome = mudancas.nome
  if (mudancas.apelido !== undefined) out.apelido = mudancas.apelido
  if (mudancas.tipo !== undefined) out.tipo = mudancas.tipo
  if (mudancas.valor !== undefined) out.valor = mudancas.valor
  if (mudancas.dia !== undefined) out.dia = mudancas.dia
  if (mudancas.parcelaAtual !== undefined) out.parcela_atual = mudancas.parcelaAtual
  if (mudancas.parcelasTotal !== undefined) out.parcelas_total = mudancas.parcelasTotal
  if (mudancas.mesFinal !== undefined) out.mes_final = mudancas.mesFinal
  if (mudancas.categoriaId !== undefined) out.categoria_id = mudancas.categoriaId
  if (mudancas.divida !== undefined) out.divida = mudancas.divida
  if (mudancas.saldoDevedor !== undefined) out.saldo_devedor = mudancas.saldoDevedor
  if (mudancas.jurosMes !== undefined) out.juros_mes = mudancas.jurosMes
  if (mudancas.parcelasRestantes !== undefined) out.parcelas_restantes = mudancas.parcelasRestantes
  if (mudancas.forma !== undefined) out.forma = mudancas.forma
  if (mudancas.chaveVinculo !== undefined) out.chave_vinculo = mudancas.chaveVinculo
  return out
}

function deLancamento(row: Row): Lancamento {
  return {
    id: String(row.id),
    origem: row.origem as Lancamento['origem'],
    data: String(row.data),
    valor: Number(row.valor),
    sinal: row.sinal as Lancamento['sinal'],
    descricaoOriginal: String(row.descricao_original ?? ''),
    estabelecimentoChave: String(row.estabelecimento_chave ?? ''),
    categoriaId: (row.categoria_id as string | null) ?? null,
    parcelaAtual: row.parcela_atual == null ? undefined : Number(row.parcela_atual),
    parcelasTotal: row.parcelas_total == null ? undefined : Number(row.parcelas_total),
    compromissoId: (row.compromisso_id as string | null) ?? null,
    chaveDedup: String(row.chave_dedup),
    importadoEm: String(row.importado_em),
    idBanco: (row.id_banco as string | undefined) ?? undefined,
    confirmarEntrada: row.confirmar_entrada == null ? undefined : Boolean(row.confirmar_entrada),
  }
}

function paraLancamento(item: Lancamento, user_id: string) {
  return {
    id: item.id,
    user_id,
    origem: item.origem,
    data: item.data,
    valor: item.valor,
    sinal: item.sinal,
    descricao_original: item.descricaoOriginal,
    estabelecimento_chave: item.estabelecimentoChave,
    categoria_id: item.categoriaId,
    parcela_atual: item.parcelaAtual ?? null,
    parcelas_total: item.parcelasTotal ?? null,
    compromisso_id: item.compromissoId ?? null,
    chave_dedup: item.chaveDedup,
    importado_em: item.importadoEm,
    id_banco: item.idBanco ?? null,
    confirmar_entrada: item.confirmarEntrada ?? null,
  }
}

function paraLancamentoParcial(mudancas: Partial<Lancamento>) {
  const out: Record<string, unknown> = {}
  if (mudancas.origem !== undefined) out.origem = mudancas.origem
  if (mudancas.data !== undefined) out.data = mudancas.data
  if (mudancas.valor !== undefined) out.valor = mudancas.valor
  if (mudancas.sinal !== undefined) out.sinal = mudancas.sinal
  if (mudancas.descricaoOriginal !== undefined) out.descricao_original = mudancas.descricaoOriginal
  if (mudancas.estabelecimentoChave !== undefined) out.estabelecimento_chave = mudancas.estabelecimentoChave
  if (mudancas.categoriaId !== undefined) out.categoria_id = mudancas.categoriaId
  if (mudancas.parcelaAtual !== undefined) out.parcela_atual = mudancas.parcelaAtual
  if (mudancas.parcelasTotal !== undefined) out.parcelas_total = mudancas.parcelasTotal
  if (mudancas.compromissoId !== undefined) out.compromisso_id = mudancas.compromissoId
  if (mudancas.chaveDedup !== undefined) out.chave_dedup = mudancas.chaveDedup
  if (mudancas.importadoEm !== undefined) out.importado_em = mudancas.importadoEm
  if (mudancas.idBanco !== undefined) out.id_banco = mudancas.idBanco
  if (mudancas.confirmarEntrada !== undefined) out.confirmar_entrada = mudancas.confirmarEntrada
  return out
}

function deMetaModelo(row: Row): MetaModelo {
  return {
    id: String(row.id),
    nome: String(row.nome),
    tipo: row.tipo as MetaModelo['tipo'],
    parametros: (row.parametros as Record<string, string | number>) ?? {},
    ativaPorPadrao: Boolean(row.ativa_por_padrao),
  }
}

function paraMetaModelo(item: MetaModelo, user_id: string) {
  return {
    id: item.id,
    user_id,
    nome: item.nome,
    tipo: item.tipo,
    parametros: item.parametros,
    ativa_por_padrao: item.ativaPorPadrao,
  }
}

function deMetaSemana(row: Row): MetaSemana {
  return {
    id: String(row.id),
    modeloId: String(row.modelo_id),
    semana: String(row.semana),
    ativa: Boolean(row.ativa),
    cumprida: row.cumprida == null ? undefined : Boolean(row.cumprida),
    detalhe: (row.detalhe as string | undefined) ?? undefined,
  }
}

function paraMetaSemana(item: MetaSemana, user_id: string) {
  return {
    id: item.id,
    user_id,
    modelo_id: item.modeloId,
    semana: item.semana,
    ativa: item.ativa,
    cumprida: item.cumprida ?? null,
    detalhe: item.detalhe ?? null,
  }
}

function paraMetaSemanaParcial(mudancas: Partial<MetaSemana>) {
  const out: Record<string, unknown> = {}
  if (mudancas.modeloId !== undefined) out.modelo_id = mudancas.modeloId
  if (mudancas.semana !== undefined) out.semana = mudancas.semana
  if (mudancas.ativa !== undefined) out.ativa = mudancas.ativa
  if (mudancas.cumprida !== undefined) out.cumprida = mudancas.cumprida
  if (mudancas.detalhe !== undefined) out.detalhe = mudancas.detalhe
  return out
}

function deRevisao(row: Row): Revisao {
  return {
    id: String(row.id),
    semanaInicio: String(row.semana_inicio),
    fechadaEm: String(row.fechada_em),
    notas: String(row.notas ?? ''),
    snapshot: (row.snapshot as Record<string, number>) ?? {},
  }
}

function paraRevisao(item: Revisao, user_id: string) {
  return {
    id: item.id,
    user_id,
    semana_inicio: item.semanaInicio,
    fechada_em: item.fechadaEm,
    notas: item.notas,
    snapshot: item.snapshot,
  }
}

function deImportacao(row: Row): Importacao {
  return {
    id: String(row.id),
    arquivo: String(row.arquivo),
    tipo: row.tipo as Importacao['tipo'],
    data: String(row.data),
    novos: Number(row.novos ?? 0),
    jaExistiam: Number(row.ja_existiam ?? 0),
    ignorados: Number(row.ignorados ?? 0),
    semCategoria: Number(row.sem_categoria ?? 0),
  }
}

function paraImportacao(item: Importacao, user_id: string) {
  return {
    id: item.id,
    user_id,
    arquivo: item.arquivo,
    tipo: item.tipo,
    data: item.data,
    novos: item.novos,
    ja_existiam: item.jaExistiam,
    ignorados: item.ignorados,
    sem_categoria: item.semCategoria,
  }
}

function dePlanoMes(row: Row): PlanoMes {
  return {
    id: String(row.id),
    mes: String(row.mes),
    modo: row.modo as PlanoMes['modo'],
    metaGuardar: Number(row.meta_guardar ?? 0),
    tetoCredito: Number(row.teto_credito ?? 0),
    faturaAPagar: row.fatura_a_pagar == null ? undefined : Number(row.fatura_a_pagar),
    notas: String(row.notas ?? ''),
  }
}

function paraPlanoMes(item: PlanoMes, user_id: string) {
  return {
    id: item.id,
    user_id,
    mes: item.mes,
    modo: item.modo,
    meta_guardar: item.metaGuardar,
    teto_credito: item.tetoCredito,
    fatura_a_pagar: item.faturaAPagar ?? null,
    notas: item.notas,
  }
}

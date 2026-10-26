import { addMonths, format } from 'date-fns'
import { normalizarNome } from './categoriasSeed'
import { classificar, type RegraConhecida } from './classificar'
import { fromISO } from './dates'
import { extrairParcela, textoEstabelecimento } from './merchant'
import type { OrigemLancamento, SinalLancamento, TipoCompromisso } from './types'

export type { RegraConhecida }

const IGNORAR = 'cat-ignorar'
const RENDA = 'cat-renda'

export type RascunhoLancamento = {
  origem: OrigemLancamento
  data: string
  /** Sempre positivo. */
  valor: number
  sinal: SinalLancamento
  descricaoOriginal: string
  estabelecimentoChave: string
  textoEstabelecimento: string
  categoriaId: string | null
  parcelaAtual?: number
  parcelasTotal?: number
  chaveCompromisso?: string
  /** Cartão: data|título|centavos. Conta: UUID. */
  chaveDedup: string
  idBanco?: string
  /** Entrada da conta que a revisão confirma como renda ou reembolso. */
  confirmarEntrada: boolean
}

export type RascunhoCompromisso = {
  chaveVinculo: string
  nome: string
  apelido: string
  tipo: TipoCompromisso
  valor: number
  dia?: number
  parcelaAtual?: number
  parcelasTotal?: number
  mesFinal?: string
  categoriaId: string | null
  divida: false
}

export type ResumoImportacao = {
  novos: number
  jaExistiam: number
  ignorados: number
  semCategoria: number
  inicio: string
  fim: string
}

export type ResultadoImportacao = {
  tipo: 'cartao' | 'conta'
  lancamentos: RascunhoLancamento[]
  compromissos: RascunhoCompromisso[]
  resumo: ResumoImportacao
}

type Bruto = {
  origem: OrigemLancamento
  data: string
  centavos: number
  descricaoOriginal: string
  texto: string
  chaveDedup: string
  idBanco?: string
  ignorar: boolean
  confirmarEntrada: boolean
  forcarCategoria?: string
  parcelaAtual?: number
  parcelasTotal?: number
  tipoCompromisso?: TipoCompromisso
}

export function linhasCsv(texto: string) {
  const src = texto.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let aspas = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (aspas) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          aspas = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      aspas = true
    } else if (ch === ',') {
      row.push(cur.trim())
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cur.trim())
      if (row.some((celula) => celula !== '')) rows.push(row)
      row = []
      cur = ''
    } else {
      cur += ch
    }
  }

  row.push(cur.trim())
  if (row.some((celula) => celula !== '')) rows.push(row)
  return rows
}

export function centavosCartao(bruto: string) {
  const limpo = bruto.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return centavosDe(limpo, bruto)
}

export function centavosConta(bruto: string) {
  return centavosDe(bruto.replace(/\s/g, ''), bruto)
}

function centavosDe(limpo: string, bruto: string) {
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) throw new Error(`Valor inválido: ${bruto}`)
  const negativo = limpo.startsWith('-')
  const [inteiro, frac = ''] = limpo.replace('-', '').split('.')
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))
  return negativo ? -centavos : centavos
}

export function detectarCsv(texto: string): 'cartao' | 'conta' {
  const cabecalho = linhasCsv(texto)[0]?.map((coluna) => normalizarNome(coluna)) ?? []
  if (cabecalho[0] === 'date' && cabecalho[1] === 'title' && cabecalho[2] === 'amount') return 'cartao'
  if (
    cabecalho[0] === 'data' &&
    cabecalho[1] === 'valor' &&
    cabecalho[2] === 'identificador' &&
    cabecalho[3] === 'descricao'
  ) {
    return 'conta'
  }
  throw new Error('CSV não reconhecido. Use o extrato do cartão ou da conta do Nubank.')
}

export function selecionarNovos<T extends { chaveDedup: string }>(
  linhas: readonly T[],
  existentes: Iterable<string>,
) {
  const temos = new Map<string, number>()
  for (const chave of existentes) temos.set(chave, (temos.get(chave) ?? 0) + 1)
  const vistos = new Map<string, number>()
  const novos: T[] = []
  for (const linha of linhas) {
    const ordem = (vistos.get(linha.chaveDedup) ?? 0) + 1
    vistos.set(linha.chaveDedup, ordem)
    if (ordem > (temos.get(linha.chaveDedup) ?? 0)) novos.push(linha)
  }
  return novos
}

const ROTULOS_CONTA = [
  /^pagamento de boleto efetuado\s*-\s*/i,
  /^transfer[eê]ncia enviada pelo pix\s*-\s*/i,
  /^compra no d[eé]bito\s*-\s*/i,
  /^transfer[eê]ncia recebida pelo pix via open banking\s*-\s*/i,
  /^transfer[eê]ncia recebida pelo pix\s*-\s*/i,
  /^transfer[eê]ncia recebida\s*-\s*/i,
]

const DOCUMENTO =
  /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|[•*]{3}\.\d{3}\.\d{3}-[•*]{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/

export function nomeDaConta(descricao: string) {
  let resto = descricao.trim()
  for (const rotulo of ROTULOS_CONTA) {
    if (rotulo.test(resto)) {
      resto = resto.replace(rotulo, '')
      break
    }
  }
  const documento = resto.search(DOCUMENTO)
  if (documento >= 0) resto = resto.slice(0, documento)
  return resto.replace(/[\s-]+$/g, '').trim()
}

function dataConta(bruto: string) {
  const match = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) throw new Error(`Data inválida: ${bruto}`)
  return `${match[3]}-${match[2]}-${match[1]}`
}

function transferenciaDoTitular(descricao: string, nomes: readonly string[]) {
  const texto = normalizarNome(descricao)
  if (!texto.includes('transferencia')) return false
  return nomes.some((nome) => {
    const chave = normalizarNome(nome)
    return chave.length > 0 && texto.includes(chave)
  })
}

function marcarIof(linhas: Bruto[]) {
  const usados = new Set<number>()
  for (let i = 0; i < linhas.length; i++) {
    if (!/iof de compra internacional/i.test(linhas[i].descricaoOriginal)) continue
    const par = linhas.findIndex(
      (outro, j) =>
        j !== i &&
        !usados.has(j) &&
        /iof de volta/i.test(outro.descricaoOriginal) &&
        outro.data === linhas[i].data &&
        outro.centavos === -linhas[i].centavos,
    )
    if (par >= 0) {
      usados.add(i)
      usados.add(par)
      linhas[i].ignorar = true
      linhas[par].ignorar = true
    } else {
      linhas[i].forcarCategoria = 'cat-assinaturas'
    }
  }
}

function parseCartao(texto: string): Bruto[] {
  const rows = linhasCsv(texto).slice(1)
  const linhas: Bruto[] = []
  for (const cols of rows) {
    if (cols.length < 3) throw new Error(`Linha inválida do cartão: ${cols.join(',')}`)
    const [data, titulo, amount] = cols
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`Data inválida: ${data}`)
    const centavos = centavosCartao(amount)
    const parcela = extrairParcela(titulo)
    const boleto = /^boleto no cr(?:é|e)dito\s*-/i.test(titulo)
    const linha: Bruto = {
      origem: 'cartao',
      data,
      centavos,
      descricaoOriginal: titulo,
      texto: textoEstabelecimento(titulo),
      chaveDedup: `${data}|${titulo}|${centavos}`,
      ignorar: /^pagamento recebido$/i.test(titulo),
      confirmarEntrada: false,
    }
    if (parcela.parcela && parcela.totalParcelas) {
      linha.parcelaAtual = parcela.parcela
      linha.parcelasTotal = parcela.totalParcelas
      linha.tipoCompromisso = 'parcelado'
    } else if (boleto) {
      const nome = normalizarNome(titulo)
      linha.tipoCompromisso = nome.includes('aymore') || nome.includes('financiamento') ? 'financiamento' : 'fixo'
    }
    linhas.push(linha)
  }
  marcarIof(linhas)
  return linhas
}

function parseConta(texto: string, nomesTitular: readonly string[]): Bruto[] {
  const rows = linhasCsv(texto).slice(1)
  return rows.map((cols) => {
    if (cols.length < 4) throw new Error(`Linha inválida da conta: ${cols.join(',')}`)
    const [dataBr, amount, identificador, descricao] = cols
    const centavos = centavosConta(amount)
    const fatura = /^pagamento de fatura$/i.test(descricao)
    const titular = transferenciaDoTitular(descricao, nomesTitular)
    const entrada = centavos > 0
    return {
      origem: 'conta' as const,
      data: dataConta(dataBr),
      centavos,
      descricaoOriginal: descricao,
      texto: nomeDaConta(descricao) || descricao,
      chaveDedup: identificador,
      idBanco: identificador,
      ignorar: fatura || titular,
      confirmarEntrada: entrada && !fatura && !titular,
      forcarCategoria: entrada && !fatura && !titular ? RENDA : undefined,
    }
  })
}

function reais(centavos: number) {
  return Math.abs(centavos) / 100
}

/** Cartão: positivo é gasto. Conta: negativo é saída. */
function sinalDe(linha: Bruto): SinalLancamento {
  if (linha.origem === 'conta') return linha.centavos < 0 ? 'saida' : 'entrada'
  return linha.centavos < 0 ? 'entrada' : 'saida'
}

function montar(linhas: Bruto[], regras: readonly RegraConhecida[]) {
  return linhas.map((linha) => {
    const classe = classificar(linha.texto, regras)
    const categoriaId = linha.ignorar ? IGNORAR : (linha.forcarCategoria ?? classe.categoriaId)
    const estabelecimentoChave = classe.chave
    const rascunho: RascunhoLancamento = {
      origem: linha.origem,
      data: linha.data,
      valor: reais(linha.centavos),
      sinal: sinalDe(linha),
      descricaoOriginal: linha.descricaoOriginal,
      estabelecimentoChave,
      textoEstabelecimento: linha.texto,
      categoriaId,
      chaveDedup: linha.chaveDedup,
      confirmarEntrada: linha.confirmarEntrada,
    }
    if (linha.idBanco) rascunho.idBanco = linha.idBanco
    if (linha.parcelaAtual) rascunho.parcelaAtual = linha.parcelaAtual
    if (linha.parcelasTotal) rascunho.parcelasTotal = linha.parcelasTotal
    if (linha.tipoCompromisso && !linha.ignorar) {
      const chave =
        linha.tipoCompromisso === 'parcelado'
          ? `parcela:${estabelecimentoChave}:${Math.abs(linha.centavos)}:${linha.parcelasTotal}`
          : `boleto:${estabelecimentoChave}`
      rascunho.chaveCompromisso = chave
    }
    return rascunho
  })
}

function compromissoDe(linha: RascunhoLancamento, tipo: TipoCompromisso): RascunhoCompromisso {
  const rascunho: RascunhoCompromisso = {
    chaveVinculo: linha.chaveCompromisso ?? '',
    nome: linha.textoEstabelecimento,
    apelido: '',
    tipo,
    valor: linha.valor,
    dia: Number(linha.data.slice(8, 10)),
    categoriaId: linha.categoriaId,
    divida: false,
  }
  if (linha.parcelaAtual && linha.parcelasTotal) {
    rascunho.parcelaAtual = linha.parcelaAtual
    rascunho.parcelasTotal = linha.parcelasTotal
    rascunho.mesFinal = format(
      addMonths(fromISO(linha.data), linha.parcelasTotal - linha.parcelaAtual),
      'yyyy-MM',
    )
  }
  return rascunho
}

function tipoDoCompromisso(linha: RascunhoLancamento): TipoCompromisso {
  if (linha.parcelaAtual) return 'parcelado'
  const nome = normalizarNome(linha.descricaoOriginal)
  if (nome.includes('aymore') || nome.includes('financiamento')) return 'financiamento'
  return 'fixo'
}

function compromissosDas(linhas: RascunhoLancamento[]) {
  const porChave = new Map<string, RascunhoCompromisso>()
  for (const linha of linhas) {
    if (!linha.chaveCompromisso || linha.categoriaId === IGNORAR) continue
    const atual = porChave.get(linha.chaveCompromisso)
    if (atual && (atual.parcelaAtual ?? 0) > (linha.parcelaAtual ?? 0)) continue
    porChave.set(linha.chaveCompromisso, compromissoDe(linha, tipoDoCompromisso(linha)))
  }
  return [...porChave.values()]
}

export function importarCsv(
  texto: string,
  contexto: {
    chavesExistentes?: Iterable<string>
    regras?: readonly RegraConhecida[]
    nomesTitular?: readonly string[]
  } = {},
): ResultadoImportacao {
  const tipo = detectarCsv(texto)
  const nomes = contexto.nomesTitular ?? ['JAIRO ANDRE MEYER SOARES']
  const brutos = tipo === 'cartao' ? parseCartao(texto) : parseConta(texto, nomes)
  if (brutos.length === 0) throw new Error('O CSV não tem lançamentos.')
  const todas = montar(brutos, contexto.regras ?? [])
  const lancamentos = selecionarNovos(todas, contexto.chavesExistentes ?? [])
  const ignorados = lancamentos.filter((linha) => linha.categoriaId === IGNORAR).length
  const datas = todas.map((linha) => linha.data).sort()
  return {
    tipo,
    lancamentos,
    compromissos: compromissosDas(lancamentos),
    resumo: {
      novos: lancamentos.length - ignorados,
      jaExistiam: todas.length - lancamentos.length,
      ignorados,
      semCategoria: lancamentos.filter((linha) => linha.categoriaId == null).length,
      inicio: datas[0],
      fim: datas[datas.length - 1],
    },
  }
}

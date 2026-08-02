import { chaveEstabelecimento, extrairParcela, nomeSemParcela } from './merchant'
import {
  deduplicarTxs,
  montarTxNubank,
  parseValorBR,
  type FaturaNubank,
  type TxNubank,
} from './nubankShared'

export type { FaturaNubank, TxNubank }

const MESES: Record<string, number> = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
}

function dataDaLinha(dia: number, mesAbrev: string, vencimento: string | null, periodoFim: string | null) {
  const mes = MESES[mesAbrev]
  if (!mes) return null

  let ano = new Date().getFullYear()
  if (vencimento) ano = Number(vencimento.slice(0, 4))
  else if (periodoFim) ano = Number(periodoFim.slice(0, 4))

  const ancora = periodoFim ?? vencimento
  if (ancora) {
    const mesAncora = Number(ancora.slice(5, 7))
    if (mes - mesAncora > 6) ano -= 1
    if (mesAncora - mes > 6) ano += 1
  }

  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function parseDataCabecalho(texto: string, padrao: RegExp) {
  const m = texto.match(padrao)
  if (!m) return null
  const dia = Number(m[1])
  const mes = MESES[m[2]]
  const ano = Number(m[3])
  if (!mes) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const LINHA_TX =
  /^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(?:••••\s+(\d{4})\s+)?(.+?)\s+(−?-?R\$\s*[\d.]+,\d{2})\s*$/i

const IGNORAR =
  /^(JAIRO|FATURA|TRANSAÇÕES|EMISSÃO|Alternativas|Pagamento total|RESUMO|VALOR MÁXIMO|\d+ de \d+|Olá,|Total a pagar:|Em cumprimento|Como assegurado|Composição|Nu Pagamentos)/i

/** Interpreta o texto já extraído (linhas) de uma fatura Nubank em PDF. */
export function parseFaturaNubank(texto: string): FaturaNubank {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const blob = linhas.join('\n')
  const vencimento = parseDataCabecalho(
    blob,
    /FATURA\s+(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/i,
  )
  const periodo = blob.match(
    /Per[ií]odo vigente:\s*(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+a\s+(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i,
  )

  let periodoInicio: string | null = null
  let periodoFim: string | null = null
  if (periodo && vencimento) {
    const ano = Number(vencimento.slice(0, 4))
    const mesFim = MESES[periodo[4].toUpperCase()]
    const mesIni = MESES[periodo[2].toUpperCase()]
    let anoIni = ano
    let anoFim = ano
    if (mesIni && mesFim && mesIni > mesFim) anoIni = ano - 1
    periodoInicio = `${anoIni}-${String(mesIni).padStart(2, '0')}-${periodo[1].padStart(2, '0')}`
    periodoFim = `${anoFim}-${String(mesFim).padStart(2, '0')}-${periodo[3].padStart(2, '0')}`
  }

  const totalMatch = blob.match(/(?:no valor de|Total a pagar)\s+R\$\s*([\d.]+,\d{2})/i)
  const total = totalMatch ? parseValorBR(totalMatch[1]) : null

  const transacoes: TxNubank[] = []
  let emTransacoes = false

  for (const linha of linhas) {
    if (/TRANSAÇÕES DE /i.test(linha) || /Pagamentos e Financiamentos/i.test(linha)) {
      emTransacoes = true
      continue
    }
    if (!emTransacoes) continue
    if (IGNORAR.test(linha)) continue
    if (/^BRL\s|Conversão:/i.test(linha)) continue

    const m = linha.match(LINHA_TX)
    if (!m) continue

    const dia = Number(m[1])
    const mesAbrev = m[2].toUpperCase()
    const cartaoFinal = m[3]
    const descricao = m[4].trim()
    const valorRaw = parseValorBR(m[5])
    if (valorRaw === null) continue

    const data = dataDaLinha(dia, mesAbrev, vencimento, periodoFim)
    if (!data) continue

    const tx = montarTxNubank({ data, titulo: descricao, valorAssinado: valorRaw, cartaoFinal })
    if (tx) transacoes.push(tx)
  }

  return {
    vencimento,
    periodoInicio,
    periodoFim,
    total: total ? Math.abs(total) : null,
    transacoes: deduplicarTxs(transacoes),
    formato: 'pdf',
  }
}

// Mantém exports usados indiretamente por testes/heurísticas.
export { chaveEstabelecimento, extrairParcela, nomeSemParcela }

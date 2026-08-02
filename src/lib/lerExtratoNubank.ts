import type { FaturaNubank } from './nubankShared'

/** Detecta PDF ou CSV da fatura Nubank e devolve o mesmo formato interno. */
export async function lerExtratoNubank(arquivo: File): Promise<FaturaNubank> {
  const nome = arquivo.name.toLowerCase()
  const tipo = arquivo.type

  const ehCsv =
    nome.endsWith('.csv') || tipo === 'text/csv' || tipo === 'application/vnd.ms-excel' || tipo === 'text/plain'
  const ehPdf = nome.endsWith('.pdf') || tipo === 'application/pdf'

  if (ehCsv) {
    const { parseFaturaNubankCsv } = await import('./nubankCsv')
    const texto = await arquivo.text()
    return parseFaturaNubankCsv(texto)
  }

  if (ehPdf) {
    const [{ textoDePdf }, { parseFaturaNubank }] = await Promise.all([
      import('./pdfTexto'),
      import('./nubankPdf'),
    ])
    const buffer = await arquivo.arrayBuffer()
    return parseFaturaNubank(await textoDePdf(buffer))
  }

  throw new Error('Envie o CSV ou o PDF da fatura do Nubank.')
}

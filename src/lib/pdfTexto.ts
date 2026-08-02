import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

type TextItem = { str: string; transform: number[] }

/** Extrai o texto do PDF agrupando tokens pela linha (coordenada Y). */
export async function textoDePdf(arquivo: ArrayBuffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(arquivo), useSystemFonts: true }).promise
  const paginas: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items = (content.items as TextItem[])
      .filter((it) => it.str?.trim())
      .map((it) => ({
        str: it.str,
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
      }))

    items.sort((a, b) => b.y - a.y || a.x - b.x)

    const linhas: string[] = []
    let linhaY: number | null = null
    let linha: typeof items = []

    const flush = () => {
      if (!linha.length) return
      linhas.push(
        linha
          .sort((a, b) => a.x - b.x)
          .map((t) => t.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      linha = []
    }

    for (const it of items) {
      if (linhaY === null || Math.abs(it.y - linhaY) <= 3) {
        linha.push(it)
        linhaY = linhaY === null ? it.y : linhaY
      } else {
        flush()
        linha = [it]
        linhaY = it.y
      }
    }
    flush()
    paginas.push(linhas.join('\n'))
  }

  return paginas.join('\n')
}

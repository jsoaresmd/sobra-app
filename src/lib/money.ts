const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const brlCurto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function formatBRL(valor: number) {
  return brl.format(valor)
}

/** Para números grandes em destaque, onde os centavos só poluem. */
export function formatBRLCurto(valor: number) {
  return brlCurto.format(valor)
}

export function formatNumero(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converte o texto digitado no teclado (em centavos) para reais. */
export function centavosParaReais(digitos: string) {
  const limpo = digitos.replace(/\D/g, '')
  if (!limpo) return 0
  return Number(limpo) / 100
}

export function reaisParaCentavos(valor: number) {
  return String(Math.round(valor * 100))
}

export function parseValor(texto: string) {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

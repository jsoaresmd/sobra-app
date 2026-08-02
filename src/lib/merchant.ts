/**
 * Normaliza o nome do estabelecimento para virar a "chave" da etiqueta.
 * "Mp *Patyy", "MP *PATYY " e "mp*patyy" caem na mesma regra.
 */
export function chaveEstabelecimento(nome: string) {
  let chave = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*-\s*parcela\s+\d+\s*\/\s*\d+/i, '')
    .replace(/\b(parcela|parc)\s*\d+\s*\/\s*\d+/gi, '')
    .replace(/^transacao de\s+/i, '')
    .replace(/\*{1,}/g, ' ')
    .replace(/[•·]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // PDF diz "Transação de NuTag"; CSV traz "NuTag*CODIGO".
  if (/\bnutag\b/.test(chave)) return 'nutag'

  return chave
}

/** Remove sufixo de parcela do nome exibido. */
export function nomeSemParcela(nome: string) {
  return nome.replace(/\s*-\s*Parcela\s+\d+\s*\/\s*\d+\s*$/i, '').trim()
}

export function extrairParcela(nome: string): { parcela?: number; totalParcelas?: number } {
  const m = nome.match(/Parcela\s+(\d+)\s*\/\s*(\d+)/i)
  if (!m) return {}
  return { parcela: Number(m[1]), totalParcelas: Number(m[2]) }
}

/**
 * Normaliza o nome do estabelecimento para virar a chave da regra.
 * "Mp *Patyy", "MP *PATYY" e "mp*patyy" caem na mesma chave.
 * Tira acento, prefixos de maquininha e número de pedido. O texto original fica guardado à parte.
 */
export function chaveEstabelecimento(nome: string) {
  let chave = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*-\s*parcela\s+\d+\s*\/\s*\d+/gi, '')
    .replace(/\b(parcela|parc)\s*\d+\s*\/\s*\d+/gi, '')
    .replace(/^transacao de\s+/i, '')
    .replace(/^boleto no credito\s*-\s*/i, '')
    .replace(/\*/g, ' ')
    .replace(/[•·]+/g, ' ')

  for (let i = 0; i < 3; i++) {
    const semPrefixo = chave.replace(/^(ifd|efi|asa|htm|jim\.com|mp|dl)\s+/, '')
    if (semPrefixo === chave) break
    chave = semPrefixo
  }

  chave = chave
    .replace(/^\d{4,}\s+/, '')
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/\bnutag\b/.test(chave)) return 'nutag'
  return chave
}

/** Remove sufixo de parcela do nome exibido. */
export function nomeSemParcela(nome: string) {
  return nome.replace(/\s*-\s*Parcela\s+\d+\s*\/\s*\d+\s*$/i, '').trim()
}

/** Nome que a tela mostra: sem parcela e sem o prefixo de boleto. */
export function textoEstabelecimento(nome: string) {
  return nomeSemParcela(nome)
    .replace(/^boleto no cr(?:é|e)dito\s*-\s*/i, '')
    .trim()
}

export function extrairParcela(nome: string): { parcela?: number; totalParcelas?: number } {
  const m = nome.match(/Parcela\s+(\d+)\s*\/\s*(\d+)/i)
  if (!m) return {}
  return { parcela: Number(m[1]), totalParcelas: Number(m[2]) }
}

import type { Lancamento, Recorrente } from './types'

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Uma conta fixa já paga não pode continuar sendo cobrada de novo: o saldo do
 * banco já caiu. O Open Finance não traz o vínculo com o recorrente, então
 * casamos pelo nome do estabelecimento ou pelo valor exato.
 */
export function contaFixaJaPaga(r: Recorrente, doCiclo: Lancamento[]) {
  const palavras = normalizar(r.descricao)
    .split(' ')
    .filter((p) => p.length >= 4)

  return doCiclo.some((l) => {
    if (l.tipo !== r.tipo) return false
    if (l.recorrenteId === r.id) return true
    if (palavras.some((p) => normalizar(l.descricao).includes(p))) return true
    return Math.abs(l.valor - r.valor) < 0.01
  })
}

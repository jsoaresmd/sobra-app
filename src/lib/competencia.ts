import type { Lancamento } from './types'

/**
 * Gasto que já aconteceu para o usuário: data de competência até hoje, ou
 * compra recente de cartão (à vista / 1ª parcela) ainda PENDING com data de fatura futura.
 */
export function jaAconteceu(l: Lancamento, hoje: string) {
  if (l.data <= hoje) return true
  if (!l.pendente) return false
  const parcela = l.parcela ?? 1
  const total = l.totalParcelas ?? 1
  return total <= 1 || parcela === 1
}

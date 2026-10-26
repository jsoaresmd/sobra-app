import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fromISO, toISO } from './dates'

/** Domingo da semana em que a compra aconteceu. A semana vai até o sábado. */
export function inicioDaSemana(iso: string) {
  const data = fromISO(iso)
  return toISO(addDays(data, -data.getDay()))
}

export function fimDaSemana(iso: string) {
  return toISO(addDays(fromISO(inicioDaSemana(iso)), 6))
}

export function naSemana(data: string, qualquerDiaDaSemana: string) {
  return data >= inicioDaSemana(qualquerDiaDaSemana) && data <= fimDaSemana(qualquerDiaDaSemana)
}

export function proximaSemana(inicioIso: string) {
  return toISO(addDays(fromISO(inicioDaSemana(inicioIso)), 7))
}

export function semanaAnterior(inicioIso: string) {
  return toISO(addDays(fromISO(inicioDaSemana(inicioIso)), -7))
}

/** Domingos de `inicio` até `fim`, inclusive. */
export function semanasEntre(inicio: string, fim: string) {
  const lista: string[] = []
  let cursor = inicioDaSemana(inicio)
  const limite = inicioDaSemana(fim)
  while (cursor <= limite) {
    lista.push(cursor)
    cursor = toISO(addDays(fromISO(cursor), 7))
  }
  return lista
}

export function rotuloSemana(inicioIso: string) {
  const inicio = fromISO(inicioDaSemana(inicioIso))
  const fim = addDays(inicio, 6)
  const mesmoMes = inicio.getMonth() === fim.getMonth()
  if (mesmoMes) {
    return `${format(inicio, 'd', { locale: ptBR })}–${format(fim, "d 'de' MMM", { locale: ptBR })}`
  }
  return `${format(inicio, "d 'de' MMM", { locale: ptBR })} – ${format(fim, "d 'de' MMM", { locale: ptBR })}`
}

/** Semanas ainda sem revisão, da primeira compra até a última data ou hoje. */
export function semanasPendentes(
  revisoes: readonly { semanaInicio: string }[],
  lancamentos: readonly { data: string }[],
  hoje: string,
) {
  const fechadas = new Set(revisoes.map((revisao) => revisao.semanaInicio))
  const datas = lancamentos.map((linha) => linha.data).filter(Boolean).sort()
  const inicio = datas[0] ?? hoje
  const fim = datas.length && datas[datas.length - 1] > hoje ? datas[datas.length - 1] : hoje
  return semanasEntre(inicio, fim).filter((semana) => !fechadas.has(semana))
}

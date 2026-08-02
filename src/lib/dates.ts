import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type Ciclo = {
  /** YYYY-MM-DD do primeiro dia do período. */
  inicio: string
  /** YYYY-MM-DD do último dia do período. */
  fim: string
  label: string
  diasTotais: number
  /** Quantos dias já correram, contando hoje (mínimo 1). */
  diasDecorridos: number
  /** Quantos dias ainda faltam, contando hoje (mínimo 1). */
  diasRestantes: number
  /** True quando o dia de hoje está dentro do período. */
  atual: boolean
}

export function toISO(data: Date) {
  return format(data, 'yyyy-MM-dd')
}

export function fromISO(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function hojeISO() {
  return toISO(new Date())
}

/** Ajusta o dia para caber no mês (dia 31 em fevereiro vira 28/29). */
function diaValido(ano: number, mes: number, dia: number) {
  const noMes = getDaysInMonth(new Date(ano, mes, 1))
  return Math.min(Math.max(dia, 1), noMes)
}

function inicioDoCiclo(ref: Date, diaInicio: number) {
  const ano = ref.getFullYear()
  const mes = ref.getMonth()
  const diaDeVirada = diaValido(ano, mes, diaInicio)
  if (ref.getDate() >= diaDeVirada) return new Date(ano, mes, diaDeVirada)
  const anterior = addMonths(new Date(ano, mes, 1), -1)
  return new Date(
    anterior.getFullYear(),
    anterior.getMonth(),
    diaValido(anterior.getFullYear(), anterior.getMonth(), diaInicio),
  )
}

function rotulo(inicio: Date, fim: Date, diaInicio: number) {
  if (diaInicio === 1) return format(inicio, "MMMM 'de' yyyy", { locale: ptBR })
  const mesInicio = format(inicio, 'dd/MM', { locale: ptBR })
  const mesFim = format(fim, 'dd/MM', { locale: ptBR })
  return `${mesInicio} a ${mesFim}`
}

export function cicloDe(ref: Date, diaInicio: number): Ciclo {
  const inicio = inicioDoCiclo(ref, diaInicio)
  const proximo = inicioDoCiclo(addMonths(inicio, 1), diaInicio)
  const inicioProximo = proximo <= inicio ? addMonths(inicio, 1) : proximo
  const fim = addDays(inicioProximo, -1)

  const hoje = new Date()
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const atual = hojeZero >= inicio && hojeZero <= fim

  const diasTotais = differenceInCalendarDays(fim, inicio) + 1
  const decorridosBrutos = differenceInCalendarDays(hojeZero, inicio) + 1
  const diasDecorridos = atual ? decorridosBrutos : diasTotais
  const diasRestantes = atual ? diasTotais - diasDecorridos + 1 : 0

  return {
    inicio: toISO(inicio),
    fim: toISO(fim),
    label: rotulo(inicio, fim, diaInicio),
    diasTotais,
    diasDecorridos: Math.max(1, diasDecorridos),
    diasRestantes: Math.max(atual ? 1 : 0, diasRestantes),
    atual,
  }
}

export function cicloAtual(diaInicio: number) {
  return cicloDe(new Date(), diaInicio)
}

export function cicloDeslocado(base: Ciclo, meses: number, diaInicio: number) {
  return cicloDe(addMonths(fromISO(base.inicio), meses), diaInicio)
}

export function dentroDo(ciclo: Ciclo, dataISO: string) {
  return dataISO >= ciclo.inicio && dataISO <= ciclo.fim
}

/** Data em que o dia do mês cai dentro deste ciclo (ex.: vencimento dia 10). */
export function diaDoCicloParaISO(ciclo: Ciclo, diaDoMes: number) {
  const inicio = fromISO(ciclo.inicio)
  const candidato = new Date(inicio.getFullYear(), inicio.getMonth(), diaValido(inicio.getFullYear(), inicio.getMonth(), diaDoMes))
  const candidatoISO = toISO(candidato)
  if (dentroDo(ciclo, candidatoISO)) return candidatoISO

  const seguinte = addMonths(inicio, 1)
  const alternativo = new Date(
    seguinte.getFullYear(),
    seguinte.getMonth(),
    diaValido(seguinte.getFullYear(), seguinte.getMonth(), diaDoMes),
  )
  const alternativoISO = toISO(alternativo)
  return dentroDo(ciclo, alternativoISO) ? alternativoISO : candidatoISO
}

export function formatarDia(iso: string) {
  return format(fromISO(iso), "dd 'de' MMM", { locale: ptBR })
}

export function formatarDiaSemana(iso: string) {
  return format(fromISO(iso), "EEEE, dd 'de' MMMM", { locale: ptBR })
}

export function formatarCurto(iso: string) {
  return format(fromISO(iso), 'dd/MM', { locale: ptBR })
}

/** Ex.: "sáb 01/08" */
export function formatarDiaCurto(iso: string) {
  return format(fromISO(iso), 'EEE dd/MM', { locale: ptBR })
}

/** Aceita HH:mm ou ISO com horário (mostra horário de Brasília). */
export function formatarHora(horaOuIso?: string | null) {
  if (!horaOuIso) return null
  if (/^\d{2}:\d{2}$/.test(horaOuIso)) return horaOuIso
  if (!horaOuIso.includes('T')) return null
  const d = new Date(horaOuIso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(d)
}

/** Extrai YYYY-MM-DD e HH:mm de um ISO da Pluggy/banco. */
export function partirDataHora(iso: string): { data: string; hora?: string } {
  const data = iso.slice(0, 10)
  const hora = formatarHora(iso) ?? undefined
  return hora ? { data, hora } : { data }
}

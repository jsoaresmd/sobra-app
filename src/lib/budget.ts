import type { Categoria, Config, Lancamento, Recorrente } from './types'
import { type Ciclo, diaDoCicloParaISO, dentroDo } from './dates'

export type Status = 'tranquilo' | 'atencao' | 'estourando'

/** Um compromisso que ainda não foi lançado mas que certamente vai pesar no ciclo. */
export type Previsto = {
  id: string
  descricao: string
  valor: number
  data: string
  categoriaId: string | null
  contaId: string | null
  origem: 'recorrente' | 'agendado'
  atrasado: boolean
}

export type ResumoCategoria = {
  categoria: Categoria
  gastoRealizado: number
  aindaVaiCair: number
  comprometido: number
  orcamento: number
  restante: number
  percentual: number
  projecao: number
  status: Status
}

export type Resumo = {
  ciclo: Ciclo
  receitaTotal: number
  metaPoupanca: number
  /** Quanto se pode gastar no ciclo inteiro. */
  teto: number

  gastoRealizado: number
  aindaVaiCair: number
  comprometido: number
  /** Teto menos tudo que já saiu e tudo que ainda vai sair. */
  disponivel: number
  /** Quanto dá para gastar por dia com o que sobrou. */
  porDia: number

  /** Gastos do dia a dia (fora fixos e parcelas) já realizados. */
  gastoLivre: number
  ritmoDiario: number
  projecao: number
  status: Status

  fixos: number
  parcelas: number
  previstos: Previsto[]
}

function ehFixo(l: Lancamento) {
  return l.origem === 'recorrente'
}

function ehParcela(l: Lancamento) {
  return (l.totalParcelas ?? 1) > 1
}

function somar(valores: number[]) {
  return valores.reduce((total, v) => total + v, 0)
}

function classificar(projecao: number, teto: number, disponivel: number, alertaEm: number): Status {
  if (teto <= 0) return 'atencao'
  if (disponivel < 0 || projecao > teto) return 'estourando'
  if (projecao > teto * alertaEm) return 'atencao'
  return 'tranquilo'
}

/**
 * Monta a foto do ciclo: o que já saiu, o que ainda vai sair e o que sobra
 * para gastar até o fim do período.
 */
export function calcularResumo(
  config: Config,
  ciclo: Ciclo,
  lancamentos: Lancamento[],
  recorrentes: Recorrente[],
  hoje: string,
): Resumo {
  const doCiclo = lancamentos.filter((l) => dentroDo(ciclo, l.data))
  const despesas = doCiclo.filter((l) => l.tipo === 'despesa')
  const receitas = doCiclo.filter((l) => l.tipo === 'receita')

  const ativos = recorrentes.filter((r) => r.ativo)
  const jaLancado = new Set(doCiclo.map((l) => l.recorrenteId).filter(Boolean) as string[])

  const previstos: Previsto[] = []

  for (const r of ativos.filter((r) => r.tipo === 'despesa')) {
    if (jaLancado.has(r.id)) continue
    const data = diaDoCicloParaISO(ciclo, r.diaDoMes)
    previstos.push({
      id: r.id,
      descricao: r.descricao,
      valor: r.valor,
      data,
      categoriaId: r.categoriaId,
      contaId: r.contaId,
      origem: 'recorrente',
      atrasado: ciclo.atual && data < hoje,
    })
  }

  for (const l of despesas.filter((l) => l.data > hoje)) {
    previstos.push({
      id: l.id,
      descricao: l.descricao || 'Lançamento agendado',
      valor: l.valor,
      data: l.data,
      categoriaId: l.categoriaId,
      contaId: l.contaId,
      origem: 'agendado',
      atrasado: false,
    })
  }

  previstos.sort((a, b) => a.data.localeCompare(b.data))

  const realizadas = despesas.filter((l) => l.data <= hoje)
  const gastoRealizado = somar(realizadas.map((l) => l.valor))
  const aindaVaiCair = somar(previstos.map((p) => p.valor))
  const comprometido = gastoRealizado + aindaVaiCair

  const receitasExtras = somar(receitas.map((l) => l.valor))
  const receitasRecorrentes = somar(
    ativos.filter((r) => r.tipo === 'receita' && !jaLancado.has(r.id)).map((r) => r.valor),
  )
  const receitaTotal = config.rendaMensal + receitasExtras + receitasRecorrentes
  const teto = Math.max(0, receitaTotal - config.metaPoupanca)

  const fixos = somar(despesas.filter(ehFixo).map((l) => l.valor)) + somar(previstos.filter((p) => p.origem === 'recorrente').map((p) => p.valor))
  const parcelas = somar(despesas.filter((l) => !ehFixo(l) && ehParcela(l)).map((l) => l.valor))

  const livres = despesas.filter((l) => !ehFixo(l) && !ehParcela(l))
  const gastoLivre = somar(livres.filter((l) => l.data <= hoje).map((l) => l.valor))
  const livreAgendado = somar(livres.filter((l) => l.data > hoje).map((l) => l.valor))

  const ritmoDiario = gastoLivre / ciclo.diasDecorridos
  const projecao = ciclo.atual
    ? fixos + parcelas + livreAgendado + ritmoDiario * ciclo.diasTotais
    : gastoRealizado + aindaVaiCair

  const disponivel = teto - comprometido
  const porDia = ciclo.diasRestantes > 0 ? disponivel / ciclo.diasRestantes : disponivel

  return {
    ciclo,
    receitaTotal,
    metaPoupanca: config.metaPoupanca,
    teto,
    gastoRealizado,
    aindaVaiCair,
    comprometido,
    disponivel,
    porDia,
    gastoLivre,
    ritmoDiario,
    projecao,
    status: classificar(projecao, teto, disponivel, config.alertaEm),
    fixos,
    parcelas,
    previstos,
  }
}

export function calcularCategorias(
  categorias: Categoria[],
  resumo: Resumo,
  lancamentos: Lancamento[],
  hoje: string,
  alertaEm: number,
): ResumoCategoria[] {
  const doCiclo = lancamentos.filter((l) => dentroDo(resumo.ciclo, l.data) && l.tipo === 'despesa')
  const fracaoDecorrida = resumo.ciclo.atual
    ? Math.min(1, resumo.ciclo.diasDecorridos / resumo.ciclo.diasTotais)
    : 1

  return categorias
    .filter((c) => !c.arquivada)
    .map((categoria) => {
      const gastoRealizado = somar(
        doCiclo.filter((l) => l.categoriaId === categoria.id && l.data <= hoje).map((l) => l.valor),
      )
      const aindaVaiCair = somar(
        resumo.previstos.filter((p) => p.categoriaId === categoria.id).map((p) => p.valor),
      )
      const comprometido = gastoRealizado + aindaVaiCair
      const orcamento = categoria.orcamento
      const projecao = fracaoDecorrida > 0 ? Math.max(comprometido, gastoRealizado / fracaoDecorrida + aindaVaiCair) : comprometido
      const restante = orcamento - comprometido

      return {
        categoria,
        gastoRealizado,
        aindaVaiCair,
        comprometido,
        orcamento,
        restante,
        percentual: orcamento > 0 ? comprometido / orcamento : 0,
        projecao,
        status: orcamento > 0 ? classificar(projecao, orcamento, restante, alertaEm) : 'tranquilo',
      }
    })
    .sort((a, b) => b.comprometido - a.comprometido)
}

export const ROTULO_STATUS: Record<Status, string> = {
  tranquilo: 'No ritmo certo',
  atencao: 'Atenção ao ritmo',
  estourando: 'Vai estourar',
}

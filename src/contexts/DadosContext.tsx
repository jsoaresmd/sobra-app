import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { garantirDadosIniciais } from '../lib/seed'
import { cicloAtual, cicloDeslocado, hojeISO } from '../lib/dates'
import { calcularCategorias, calcularResumo, type Resumo, type ResumoCategoria } from '../lib/budget'
import { calcularFatura, calcularTetoFatura, montarTermometro, type Fatura, type TermometroFatura } from '../lib/fatura'
import { calcularCaixa, type Caixa } from '../lib/caixa'
import { alocarCiclo, processarDebitosPendentes } from '../lib/envelopes'
import type { Categoria, Conta, Config, Envelope, Lancamento, Recorrente } from '../lib/types'

type DadosContextValue = {
  pronto: boolean
  hoje: string
  config: Config | undefined
  contas: Conta[]
  categorias: Categoria[]
  envelopes: Envelope[]
  lancamentos: Lancamento[]
  recorrentes: Recorrente[]
  resumo: Resumo | undefined
  categoriasResumo: ResumoCategoria[]
  faturas: Fatura[]
  termometros: TermometroFatura[]
  tetoFatura: number
  caixa: Caixa | undefined
  offsetCiclo: number
  mudarCiclo: (delta: number) => void
  voltarParaCicloAtual: () => void
}

const DadosContext = createContext<DadosContextValue | null>(null)

export function DadosProvider({ children }: { children: ReactNode }) {
  const [offsetCiclo, setOffsetCiclo] = useState(0)
  const [hoje, setHoje] = useState(hojeISO)
  const [seedPronto, setSeedPronto] = useState(false)

  useEffect(() => {
    void garantirDadosIniciais().then(() => setSeedPronto(true))
  }, [])

  useEffect(() => {
    const conferir = () => setHoje(hojeISO())
    const timer = window.setInterval(conferir, 60_000)
    document.addEventListener('visibilitychange', conferir)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', conferir)
    }
  }, [])

  const config = useLiveQuery(() => db.config.get('app'), [])
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.orderBy('ordem').toArray(), [], [])
  const envelopes = useLiveQuery(() => db.envelopes.orderBy('ordem').toArray(), [], [])
  const lancamentos = useLiveQuery(() => db.lancamentos.toArray(), [], [])
  const recorrentes = useLiveQuery(() => db.recorrentes.toArray(), [], [])

  const ciclo = useMemo(() => {
    const diaInicio = config?.diaInicioCiclo ?? 1
    const base = cicloAtual(diaInicio)
    return offsetCiclo === 0 ? base : cicloDeslocado(base, offsetCiclo, diaInicio)
  }, [config?.diaInicioCiclo, offsetCiclo, hoje])

  // No ciclo atual: deposita nos envelopes uma vez e debita parcelas que chegaram.
  useEffect(() => {
    if (!seedPronto || !config || offsetCiclo !== 0) return
    void alocarCiclo(ciclo)
  }, [seedPronto, config, offsetCiclo, ciclo.inicio])

  useEffect(() => {
    if (!seedPronto || offsetCiclo !== 0) return
    void processarDebitosPendentes(ciclo, hoje)
  }, [seedPronto, offsetCiclo, ciclo.inicio, hoje, lancamentos.length])

  const resumo = useMemo(() => {
    if (!config) return undefined
    return calcularResumo(config, ciclo, lancamentos, recorrentes, hoje)
  }, [config, ciclo, lancamentos, recorrentes, hoje])

  const categoriasResumo = useMemo(() => {
    if (!resumo || !config) return []
    return calcularCategorias(categorias, resumo, lancamentos, hoje, config.alertaEm)
  }, [categorias, resumo, lancamentos, hoje, config])

  const faturas = useMemo(() => {
    return contas
      .filter((c) => c.tipo === 'credito' && !c.arquivada)
      .map((c) => calcularFatura(c, lancamentos, hoje))
      .filter((f): f is Fatura => f !== null)
  }, [contas, lancamentos, hoje])

  const tetoFatura = useMemo(() => {
    if (!config) return 0
    return calcularTetoFatura(config, contas, recorrentes)
  }, [config, contas, recorrentes])

  const termometros = useMemo(
    () => faturas.map((f) => montarTermometro(f, tetoFatura)),
    [faturas, tetoFatura],
  )

  const caixa = useMemo(() => {
    if (!config) return undefined
    return calcularCaixa(config, contas, faturas, recorrentes, lancamentos, ciclo, hoje)
  }, [config, contas, faturas, recorrentes, lancamentos, ciclo, hoje])

  const valor: DadosContextValue = {
    pronto: seedPronto && config !== undefined,
    hoje,
    config,
    contas,
    categorias,
    envelopes,
    lancamentos,
    recorrentes,
    resumo,
    categoriasResumo,
    faturas,
    termometros,
    tetoFatura,
    caixa,
    offsetCiclo,
    mudarCiclo: (delta) => setOffsetCiclo((atual) => atual + delta),
    voltarParaCicloAtual: () => setOffsetCiclo(0),
  }

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>
}

export function useDados() {
  const contexto = useContext(DadosContext)
  if (!contexto) throw new Error('useDados precisa estar dentro de DadosProvider')
  return contexto
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { garantirDadosIniciais } from '../lib/dadosIniciais'
import type {
  Categoria,
  Compromisso,
  Config,
  Estabelecimento,
  Lancamento,
  MetaModelo,
  MetaSemana,
  Revisao,
} from '../lib/types'

type DadosContextValue = {
  pronto: boolean
  config: Config | undefined
  categorias: Categoria[]
  estabelecimentos: Estabelecimento[]
  lancamentos: Lancamento[]
  compromissos: Compromisso[]
  metasModelo: MetaModelo[]
  metasSemana: MetaSemana[]
  revisoes: Revisao[]
  temBackupLegado: boolean
}

const DadosContext = createContext<DadosContextValue | null>(null)

export function DadosProvider({ children }: { children: ReactNode }) {
  const [seedPronto, setSeedPronto] = useState(false)

  useEffect(() => {
    void garantirDadosIniciais().then(() => setSeedPronto(true))
  }, [])

  const config = useLiveQuery(() => db.config.get('app'), [])
  const categorias = useLiveQuery(() => db.categorias.orderBy('ordem').toArray(), [], [])
  const estabelecimentos = useLiveQuery(() => db.estabelecimentos.toArray(), [], [])
  const lancamentos = useLiveQuery(() => db.lancamentos.toArray(), [], [])
  const compromissos = useLiveQuery(() => db.compromissos.toArray(), [], [])
  const metasModelo = useLiveQuery(() => db.metasModelo.toArray(), [], [])
  const metasSemana = useLiveQuery(() => db.metasSemana.toArray(), [], [])
  const revisoes = useLiveQuery(() => db.revisoes.orderBy('semanaInicio').reverse().toArray(), [], [])
  const legado = useLiveQuery(() => db.backupLegado.get('pre-sobra-2'), [])

  const valor: DadosContextValue = {
    pronto: seedPronto && config !== undefined,
    config,
    categorias: categorias ?? [],
    estabelecimentos: estabelecimentos ?? [],
    lancamentos: lancamentos ?? [],
    compromissos: compromissos ?? [],
    metasModelo: metasModelo ?? [],
    metasSemana: metasSemana ?? [],
    revisoes: revisoes ?? [],
    temBackupLegado: Boolean(legado),
  }

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>
}

export function useDados() {
  const contexto = useContext(DadosContext)
  if (!contexto) throw new Error('useDados precisa estar dentro de DadosProvider')
  return contexto
}

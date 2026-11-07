import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { garantirDadosIniciais, resetarSeed } from '../lib/dadosIniciais'
import { db } from '../lib/db'
import { aoMudarDados } from '../lib/mudanca'
import { carregarTudo } from '../lib/repo'
import type {
  Categoria,
  Compromisso,
  Config,
  Estabelecimento,
  Lancamento,
  MetaModelo,
  MetaSemana,
  PlanoMes,
  Revisao,
} from '../lib/types'
import { useAuth } from './AuthContext'

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
  planosMes: PlanoMes[]
  temBackupLegado: boolean
  temDadosLocais: boolean
  recarregar: () => Promise<void>
}

const DadosContext = createContext<DadosContextValue | null>(null)

const vazio = {
  config: undefined as Config | undefined,
  categorias: [] as Categoria[],
  estabelecimentos: [] as Estabelecimento[],
  lancamentos: [] as Lancamento[],
  compromissos: [] as Compromisso[],
  metasModelo: [] as MetaModelo[],
  metasSemana: [] as MetaSemana[],
  revisoes: [] as Revisao[],
  planosMes: [] as PlanoMes[],
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [seedPronto, setSeedPronto] = useState(false)
  const [pacote, setPacote] = useState(vazio)
  const [temBackupLegado, setTemBackupLegado] = useState(false)
  const [temDadosLocais, setTemDadosLocais] = useState(false)
  const userId = user?.id
  const carregando = useRef(false)

  const aplicar = (dados: Awaited<ReturnType<typeof carregarTudo>>) => {
    setPacote({
      config: dados.config,
      categorias: dados.categorias,
      estabelecimentos: dados.estabelecimentos,
      lancamentos: dados.lancamentos,
      compromissos: dados.compromissos,
      metasModelo: dados.metasModelo,
      metasSemana: dados.metasSemana,
      revisoes: dados.revisoes,
      planosMes: dados.planosMes,
    })
  }

  const recarregar = async () => {
    if (!userId || carregando.current) return
    carregando.current = true
    try {
      aplicar(await carregarTudo())
    } finally {
      carregando.current = false
    }
  }

  useEffect(() => {
    if (!userId) {
      resetarSeed()
      setPacote(vazio)
      setSeedPronto(false)
      return
    }
    let cancelado = false
    setSeedPronto(false)
    void garantirDadosIniciais()
      .then(() => carregarTudo())
      .then((dados) => {
        if (cancelado) return
        aplicar(dados)
        setSeedPronto(true)
      })
      .catch((erro) => {
        console.error(erro)
        if (!cancelado) setSeedPronto(true)
      })
    return () => {
      cancelado = true
    }
  }, [userId])

  useEffect(() => {
    return aoMudarDados(() => {
      void recarregar()
    })
    // recarregar fecha sobre userId atual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    void (async () => {
      try {
        const legado = await db.backupLegado.get('pre-sobra-2')
        setTemBackupLegado(Boolean(legado))
        const contagem =
          (await db.lancamentos.count()) +
          (await db.estabelecimentos.count()) +
          (await db.categorias.count()) +
          (await db.compromissos.count())
        setTemDadosLocais(contagem > 0)
      } catch {
        setTemBackupLegado(false)
        setTemDadosLocais(false)
      }
    })()
  }, [userId, seedPronto, pacote.lancamentos.length])

  const valor: DadosContextValue = {
    pronto: Boolean(userId) && seedPronto && pacote.config !== undefined,
    ...pacote,
    temBackupLegado,
    temDadosLocais,
    recarregar,
  }

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>
}

export function useDados() {
  const contexto = useContext(DadosContext)
  if (!contexto) throw new Error('useDados precisa estar dentro de DadosProvider')
  return contexto
}

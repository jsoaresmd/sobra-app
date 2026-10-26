export type TipoCategoria = 'semanal' | 'mensal' | 'ignorar' | 'renda' | 'investimento'

export type TipoCompromisso = 'fixo' | 'parcelado' | 'financiamento'

export type OrigemLancamento = 'cartao' | 'conta' | 'manual'

export type SinalLancamento = 'saida' | 'entrada'

export type Config = {
  id: 'app'
  renda: number
  metaGuardarMes: number
  /** Nomes do titular, para ignorar transferência entre contas próprias. */
  nomesTitular: string[]
  versao: 2
}

export type Categoria = {
  id: string
  nome: string
  emoji: string
  cor: string
  tipo: TipoCategoria
  /** Teto do mês. O semanal é tetoMensal × 12 ÷ 52. */
  tetoMensal: number
  arquivada: boolean
  ordem: number
}

export type Estabelecimento = {
  id: string
  chaveNormalizada: string
  textoOriginal: string
  apelido: string
  nota: string
  categoriaId: string | null
  compromissoId?: string | null
}

export type Lancamento = {
  id: string
  origem: OrigemLancamento
  /** YYYY-MM-DD, data da compra. Nunca editada quando a origem não é manual. */
  data: string
  /** Sempre positivo. */
  valor: number
  sinal: SinalLancamento
  descricaoOriginal: string
  estabelecimentoChave: string
  categoriaId: string | null
  parcelaAtual?: number
  parcelasTotal?: number
  compromissoId?: string | null
  /** date|title|amount no cartão. Várias linhas iguais são compras distintas. */
  chaveDedup: string
  importadoEm: string
  /** UUID da linha da conta corrente. */
  idBanco?: string
  /** Entrada da conta que ainda precisa ser confirmada como renda ou reembolso. */
  confirmarEntrada?: boolean
}

export type Compromisso = {
  id: string
  nome: string
  apelido: string
  tipo: TipoCompromisso
  valor: number
  dia?: number
  parcelaAtual?: number
  parcelasTotal?: number
  /** YYYY-MM em que a última parcela cai. */
  mesFinal?: string
  categoriaId: string | null
  divida: boolean
  saldoDevedor?: number
  /** Percentual ao mês. Opcional. */
  jurosMes?: number
  parcelasRestantes?: number
  forma?: 'cartao' | 'boleto' | 'pix' | 'debito'
  /** Liga o parcelamento do CSV ao mesmo compromisso quando a parcela avança. */
  chaveVinculo?: string
}

export type TipoMeta =
  | 'zero-categoria'
  | 'limite-valor'
  | 'limite-quantidade'
  | 'zero-parcelamento-novo'
  | 'guardar'
  | 'livre'

export type MetaModelo = {
  id: string
  nome: string
  tipo: TipoMeta
  /** categoriaId, valor, quantidade, estabelecimentoChave — conforme o tipo. */
  parametros: Record<string, string | number>
  ativaPorPadrao: boolean
}

export type MetaSemana = {
  id: string
  modeloId: string
  /** Domingo da semana, YYYY-MM-DD. */
  semana: string
  ativa: boolean
  /** Preenchido quando a meta é livre ou quando a revisão fecha. */
  cumprida?: boolean
  detalhe?: string
}

export type Revisao = {
  id: string
  semanaInicio: string
  fechadaEm: string
  notas: string
  snapshot: Record<string, number>
}

export type Importacao = {
  id: string
  arquivo: string
  tipo: 'cartao' | 'conta'
  data: string
  novos: number
  jaExistiam: number
  ignorados: number
  semCategoria: number
}

export type BackupLegado = {
  id: 'pre-sobra-2'
  criadoEm: string
  json: string
}

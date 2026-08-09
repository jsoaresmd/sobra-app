export type TipoLancamento = 'despesa' | 'receita'

export type TipoConta = 'dinheiro' | 'debito' | 'credito'

export type Pessoa = {
  id: string
  nome: string
  cor: string
}

export type Config = {
  id: 'app'
  rendaMensal: number
  /** Dia em que o ciclo do orçamento vira (1 = mês civil, 5 = dia do salário). */
  diaInicioCiclo: number
  /** Valor que se quer poupar todo mês antes de considerar o resto gastável. */
  metaPoupanca: number
  /** Percentual do orçamento a partir do qual o app avisa (ex.: 0.85). */
  alertaEm: number
  /** Se preenchido, substitui o teto de fatura calculado a partir da renda. */
  tetoFaturaManual?: number
  /** ItemIds da Pluggy (Meu Pluggy / Open Finance) conectados a este aparelho. */
  pluggyItemIds?: string[]
  pluggyUltimaSync?: string
  /** Correções de dados já aplicadas, para não rodarem de novo a cada abertura. */
  migracoes?: string[]
  pessoas: Pessoa[]
  onboardingFeito: boolean
}

/** Fatura como o banco informa (produto Bills do Open Finance). */
export type FaturaBanco = {
  id: string
  /** YYYY-MM-DD */
  vence: string
  fechouEm: string | null
  total: number
  encargos: number
  /** Quanto já foi pago desta fatura (dá para pagar antes de fechar). */
  pago: number
}

export type Conta = {
  id: string
  nome: string
  tipo: TipoConta
  cor: string
  /** Cartão de crédito: dia em que a fatura fecha. */
  diaFechamento?: number
  /** Cartão de crédito: dia em que a fatura vence. */
  diaVencimento?: number
  limite?: number
  /** Conta ou dinheiro: saldo informado manualmente. */
  saldo?: number
  saldoEm?: string
  /**
   * Cartão: valor da fatura aberta conferido no app do banco. Serve de ponto de
   * partida, e só as compras lançadas depois dessa data são somadas por cima.
   */
  faturaInformada?: number
  faturaInformadaEm?: string
  /** Faturas que o próprio banco informou, da mais antiga para a mais nova. */
  faturasBanco?: FaturaBanco[]
  /** Limite ainda livre no cartão, direto do banco. */
  limiteDisponivel?: number
  /** Id da conta na Pluggy (Open Finance). */
  pluggyAccountId?: string
  pluggyItemId?: string
  ordem: number
  arquivada?: boolean
}

export type GrupoCategoria = 'essencial' | 'variavel' | 'objetivo'

export type Categoria = {
  id: string
  nome: string
  emoji: string
  cor: string
  grupo: GrupoCategoria
  /** Teto mensal em reais. 0 = sem teto definido. */
  orcamento: number
  ordem: number
  arquivada?: boolean
}

export type TipoEnvelope = 'fixo' | 'variavel' | 'investimento'

/**
 * Envelope = o setor onde o dinheiro mora, como no papel.
 * - fixo: valor certo (dízimo, internet). A sobra no fim do ciclo some (não investe).
 * - variavel: mercado, lazer. A sobra vai para o envelope de investimento.
 * - investimento: só recebe; acumula.
 */
export type Envelope = {
  id: string
  nome: string
  emoji: string
  cor: string
  tipo: TipoEnvelope
  /** Quanto entra no envelope a cada ciclo (0 no de investimento). */
  valorMensal: number
  /** Saldo atual dentro do envelope. */
  saldo: number
  /** Início do ciclo (YYYY-MM-DD) em que o valorMensal foi depositado pela última vez. */
  cicloAlocado: string | null
  /** Categoria ligada, para o lançamento escolher o envelope sozinho. */
  categoriaId: string | null
  /** Conta fixa ligada (opcional): ao marcar "caiu", desconta deste envelope. */
  recorrenteId: string | null
  ordem: number
  arquivado?: boolean
}

export type TipoMovimentoEnvelope =
  | 'alocacao'
  | 'gasto'
  | 'transferencia'
  | 'sobra'
  | 'ajuste'

export type MovimentoEnvelope = {
  id: string
  envelopeId: string
  tipo: TipoMovimentoEnvelope
  valor: number
  /** Positivo = entrou no envelope; negativo = saiu. */
  saldoDepois: number
  data: string
  descricao: string
  lancamentoId?: string
  /** Na transferência, o outro envelope envolvido. */
  envelopeParId?: string
  criadoEm: string
}

/**
 * Etiqueta aprendida: quando o Nubank traz "Mp *Patyy", o app lembra
 * em qual envelope/categoria você colocou da última vez.
 */
export type RegraImportacao = {
  id: string
  /** Chave normalizada do estabelecimento. */
  chave: string
  /** Nome legível mais recente visto. */
  nomeExibido: string
  envelopeId: string | null
  categoriaId: string | null
  /** Quantas vezes a regra foi aplicada. */
  usos: number
  atualizadoEm: string
}

export type Lancamento = {
  id: string
  tipo: TipoLancamento
  /** Sempre positivo; o sinal vem de `tipo`. */
  valor: number
  /** Data de competência (quando o gasto aconteceu), formato YYYY-MM-DD. */
  data: string
  /** Horário do gasto quando o banco informar (HH:mm). */
  hora?: string
  categoriaId: string | null
  contaId: string | null
  pessoaId: string | null
  envelopeId?: string | null
  /** True quando o valor já saiu do envelope. */
  envelopeDebitado?: boolean
  descricao: string
  /** Compras parceladas compartilham o mesmo grupo. */
  grupoParcelaId?: string
  parcela?: number
  totalParcelas?: number
  origem: 'manual' | 'recorrente' | 'importado'
  /** Cartão: mês da fatura que vai cobrar este gasto (YYYY-MM), informado pelo banco. */
  faturaMes?: string
  /** Compra ainda não faturada (aparece no app do banco, mas não na fatura fechada). */
  pendente?: boolean
  recorrenteId?: string
  /** Fingerprint do extrato Nubank, para não importar duas vezes. */
  importFingerprint?: string
  criadoEm: string
}

/** Compromisso que se repete todo mês (aluguel, escola, assinatura, salário). */
export type Recorrente = {
  id: string
  descricao: string
  tipo: TipoLancamento
  valor: number
  diaDoMes: number
  categoriaId: string | null
  contaId: string | null
  pessoaId: string | null
  ativo: boolean
  criadoEm: string
}

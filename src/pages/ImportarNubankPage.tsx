import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { db } from '../lib/db'
import { fingerprintsJaImportados, sugerirEnvelope } from '../lib/regrasImportacao'
import { confirmarImportacao, type ItemImportacao } from '../lib/importacao'
import { formatBRL } from '../lib/money'
import { formatarCurto } from '../lib/dates'

export function ImportarNubankPage() {
  const navigate = useNavigate()
  const { envelopes, categorias, contas, hoje } = useDados()
  const regras = useLiveQuery(() => db.regrasImportacao.toArray(), [], [])

  const [itens, setItens] = useState<ItemImportacao[] | null>(null)
  const [meta, setMeta] = useState<{ vencimento: string | null; total: number | null; arquivo: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'sem-etiqueta' | 'novos'>('novos')

  const contaNubank =
    contas.find((c) => c.tipo === 'credito' && /nubank/i.test(c.nome) && !c.arquivada) ??
    contas.find((c) => c.tipo === 'credito' && !c.arquivada) ??
    null

  const envelopesAtivos = useMemo(
    () => envelopes.filter((e) => !e.arquivado && e.tipo !== 'investimento'),
    [envelopes],
  )

  const lerArquivo = async (arquivo: File) => {
    setErro(null)
    setResultado(null)
    setCarregando(true)
    try {
      const { lerExtratoNubank } = await import('../lib/lerExtratoNubank')
      const fatura = await lerExtratoNubank(arquivo)
      if (fatura.transacoes.length === 0) {
        throw new Error('Não achei transações neste arquivo. Confirme que é a fatura do Nubank (CSV ou PDF).')
      }

      const fps = fatura.transacoes.map((t) => t.fingerprint)
      const jaTem = await fingerprintsJaImportados(fps)

      const montados: ItemImportacao[] = fatura.transacoes
        .filter((t) => t.origem !== 'pagamento')
        .map((tx) => {
          const sugestao = sugerirEnvelope(tx, envelopes, regras, categorias)
          return {
            tx,
            incluir: !jaTem.has(tx.fingerprint) && tx.origem === 'compra',
            envelopeId: sugestao.envelopeId,
            categoriaId: sugestao.categoriaId,
            duplicado: jaTem.has(tx.fingerprint),
            sugestao: sugestao.origem,
          }
        })

      setItens(montados)
      setMeta({
        vencimento: fatura.vencimento,
        total: fatura.total,
        arquivo: `${arquivo.name}${fatura.formato === 'csv' ? ' · CSV' : ' · PDF'}`,
      })
      setFiltro('novos')
    } catch (e) {
      setItens(null)
      setMeta(null)
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo.')
    } finally {
      setCarregando(false)
    }
  }

  const visiveis = useMemo(() => {
    if (!itens) return []
    if (filtro === 'sem-etiqueta') return itens.filter((i) => i.incluir && !i.envelopeId && i.tx.origem === 'compra')
    if (filtro === 'novos') return itens.filter((i) => i.incluir)
    return itens
  }, [itens, filtro])

  const atualizarItem = (fingerprint: string, mudancas: Partial<ItemImportacao>) => {
    setItens((atual) =>
      atual?.map((i) => {
        if (i.tx.fingerprint !== fingerprint) return i
        const proximo = { ...i, ...mudancas }
        if (mudancas.envelopeId !== undefined) {
          const env = envelopesAtivos.find((e) => e.id === mudancas.envelopeId)
          if (env?.categoriaId) proximo.categoriaId = env.categoriaId
        }
        return proximo
      }) ?? null,
    )
  }

  const aplicarEmTodosIguais = (item: ItemImportacao) => {
    if (!item.envelopeId) return
    setItens(
      (atual) =>
        atual?.map((i) => {
          if (i.tx.chave !== item.tx.chave || i.duplicado) return i
          const env = envelopesAtivos.find((e) => e.id === item.envelopeId)
          return {
            ...i,
            envelopeId: item.envelopeId,
            categoriaId: env?.categoriaId ?? item.categoriaId,
            incluir: true,
            sugestao: 'regra',
          }
        }) ?? null,
    )
  }

  const salvar = async () => {
    if (!itens) return
    setSalvando(true)
    setErro(null)
    try {
      const { criados, regras: qtdRegras } = await confirmarImportacao(itens, contaNubank?.id ?? null, hoje)
      setResultado(
        criados === 0
          ? 'Nada novo para importar.'
          : `Importei ${criados} lançamento${criados === 1 ? '' : 's'} e atualizei ${qtdRegras} etiqueta${qtdRegras === 1 ? '' : 's'}.`,
      )
      setItens(null)
      setMeta(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar a importação.')
    } finally {
      setSalvando(false)
    }
  }

  const semEtiqueta = itens?.filter((i) => i.incluir && !i.envelopeId && i.tx.origem === 'compra').length ?? 0
  const novos = itens?.filter((i) => i.incluir).length ?? 0
  const totalNovos = itens?.filter((i) => i.incluir).reduce((s, i) => s + i.tx.valor, 0) ?? 0

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ ajustes
        </button>
        <h1>Importar fatura Nubank</h1>
        <p className="muted small">
          Prefira o <strong>CSV</strong> (mais limpo). O PDF também funciona. Você etiqueta o estabelecimento uma vez;
          nas próximas faturas o Sobra reconhece e joga no envelope certo.
        </p>
      </header>

      <section className="panel stack">
        <label className="arquivo-label">
          <span>Escolher CSV ou PDF da fatura</span>
          <input
            type="file"
            accept=".csv,text/csv,.pdf,application/pdf"
            disabled={carregando}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void lerArquivo(file)
              e.target.value = ''
            }}
          />
        </label>
        {carregando && <p className="muted small">Lendo a fatura…</p>}
        {erro && <p className="error">{erro}</p>}
        {resultado && <p className="ok">{resultado}</p>}
        {meta && (
          <p className="muted small">
            {meta.arquivo}
            {meta.vencimento ? ` · vence ${formatarCurto(meta.vencimento)}` : ''}
            {meta.total != null ? ` · total da fatura ${formatBRL(meta.total)}` : ''}
            {contaNubank ? ` · conta ${contaNubank.nome}` : ''}
          </p>
        )}
      </section>

      {itens && (
        <>
          <section className="stat-grid tres">
            <div className="stat">
              <span className="stat-num">{novos}</span>
              <span className="stat-lbl">novos</span>
            </div>
            <div className="stat">
              <span className="stat-num">{semEtiqueta}</span>
              <span className="stat-lbl">sem etiqueta</span>
            </div>
            <div className="stat">
              <span className="stat-num">{formatBRL(totalNovos).replace(/\s/g, '\u00a0')}</span>
              <span className="stat-lbl">a importar</span>
            </div>
          </section>

          <div className="chips">
            {(
              [
                ['novos', 'Só novos'],
                ['sem-etiqueta', 'Sem etiqueta'],
                ['todos', 'Todos'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={`chip ${filtro === id ? 'on' : ''}`} onClick={() => setFiltro(id)}>
                {label}
              </button>
            ))}
          </div>

          {semEtiqueta > 0 && (
            <p className="ritmo-msg">
              Há {semEtiqueta} gasto{semEtiqueta === 1 ? '' : 's'} sem envelope. Escolha um e toque em{' '}
              <strong>aplicar iguais</strong> para etiquetar todas as ocorrências desse estabelecimento de uma vez.
            </p>
          )}

          <ul className="lista-import">
            {visiveis.map((item) => {
              const env = envelopesAtivos.find((e) => e.id === item.envelopeId)
              return (
                <li key={item.tx.fingerprint} className={`import-card ${item.duplicado ? 'duplicado' : ''}`}>
                  <label className="check import-check">
                    <input
                      type="checkbox"
                      checked={item.incluir}
                      disabled={item.duplicado}
                      onChange={(e) => atualizarItem(item.tx.fingerprint, { incluir: e.target.checked })}
                    />
                  </label>
                  <div className="import-corpo">
                    <div className="row-between">
                      <strong>{item.tx.descricao}</strong>
                      <span className={`previsto-valor ${item.tx.tipo === 'receita' ? 'receita' : ''}`}>
                        {item.tx.tipo === 'receita' ? '+' : '−'} {formatBRL(item.tx.valor)}
                      </span>
                    </div>
                    <p className="muted small">
                      {formatarCurto(item.tx.data)}
                      {item.duplicado
                        ? ' · já importado'
                        : item.sugestao === 'regra'
                          ? ' · etiqueta lembrada'
                          : item.sugestao === 'heuristica'
                            ? ' · sugestão automática'
                            : ' · precisa de etiqueta'}
                    </p>
                    {item.tx.origem === 'compra' && !item.duplicado && (
                      <div className="import-acoes">
                        <select
                          value={item.envelopeId ?? ''}
                          onChange={(e) =>
                            atualizarItem(item.tx.fingerprint, { envelopeId: e.target.value || null, sugestao: 'regra' })
                          }
                        >
                          <option value="">Sem envelope</option>
                          {envelopesAtivos.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.emoji} {e.nome}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.categoriaId ?? ''}
                          onChange={(e) => atualizarItem(item.tx.fingerprint, { categoriaId: e.target.value || null })}
                        >
                          <option value="">Sem categoria</option>
                          {categorias
                            .filter((c) => !c.arquivada)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.emoji} {c.nome}
                              </option>
                            ))}
                        </select>
                        {item.envelopeId && (
                          <button type="button" className="mini-btn" onClick={() => aplicarEmTodosIguais(item)}>
                            aplicar iguais
                            {env ? ` → ${env.emoji}` : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <button type="button" className="primary-btn" disabled={salvando || novos === 0} onClick={() => void salvar()}>
            {salvando ? 'Importando…' : `Importar ${novos} lançamento${novos === 1 ? '' : 's'}`}
          </button>
        </>
      )}

      <section className="panel stack">
        <h2>Etiquetas aprendidas</h2>
        {regras.length === 0 ? (
          <p className="muted small">Ainda nenhuma. Depois da primeira importação elas aparecem aqui.</p>
        ) : (
          <ul className="lista-simples">
            {regras
              .slice()
              .sort((a, b) => b.usos - a.usos)
              .slice(0, 30)
              .map((r) => {
                const env = envelopes.find((e) => e.id === r.envelopeId)
                return (
                  <li key={r.id}>
                    <span>
                      {r.nomeExibido}
                      <span className="muted small"> · {r.usos}x</span>
                    </span>
                    <strong>{env ? `${env.emoji} ${env.nome}` : '—'}</strong>
                  </li>
                )
              })}
          </ul>
        )}
        <Link to="/envelopes" className="cta">
          ver envelopes
        </Link>
      </section>
    </div>
  )
}

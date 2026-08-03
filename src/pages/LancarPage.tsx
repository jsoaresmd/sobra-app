import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { Numpad } from '../components/Numpad'
import { centavosParaReais, formatBRL, reaisParaCentavos } from '../lib/money'
import { hojeISO } from '../lib/dates'
import { atualizarLancamento, criarLancamento, removerGrupoParcelas, removerLancamento } from '../lib/acoes'
import { envelopePorCategoria } from '../lib/envelopes'
import type { TipoLancamento } from '../lib/types'

export function LancarPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { categorias, contas, config, lancamentos, envelopes, hoje } = useDados()

  const emEdicao = useMemo(() => lancamentos.find((l) => l.id === id), [lancamentos, id])
  const envelopesAtivos = useMemo(() => envelopes.filter((e) => !e.arquivado && e.tipo !== 'investimento'), [envelopes])

  const [digitos, setDigitos] = useState('')
  const [tipo, setTipo] = useState<TipoLancamento>('despesa')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [envelopeId, setEnvelopeId] = useState<string | null>(null)
  const [contaId, setContaId] = useState<string | null>(null)
  const [pessoaId, setPessoaId] = useState<string | null>(null)
  const [data, setData] = useState(hojeISO)
  const [descricao, setDescricao] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [campoAtivo, setCampoAtivo] = useState<'valor' | 'texto'>('valor')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!emEdicao) return
    setDigitos(reaisParaCentavos(emEdicao.valor))
    setTipo(emEdicao.tipo)
    setCategoriaId(emEdicao.categoriaId)
    setEnvelopeId(emEdicao.envelopeId ?? null)
    setContaId(emEdicao.contaId)
    setPessoaId(emEdicao.pessoaId)
    setData(emEdicao.data)
    setDescricao(emEdicao.descricao)
    setParcelas(emEdicao.totalParcelas ?? 1)
  }, [emEdicao])

  useEffect(() => {
    if (id || contaId) return
    const padrao = contas.find((c) => c.tipo === 'credito' && !c.arquivada) ?? contas[0]
    if (padrao) setContaId(padrao.id)
  }, [contas, contaId, id])

  useEffect(() => {
    if (id || pessoaId) return
    const primeira = config?.pessoas[0]
    if (primeira) setPessoaId(primeira.id)
  }, [config, pessoaId, id])

  const escolherCategoria = (idCat: string | null) => {
    setCategoriaId(idCat)
    if (!idCat) return
    const ligado = envelopePorCategoria(envelopesAtivos, idCat)
    if (ligado) setEnvelopeId(ligado.id)
  }

  const valor = centavosParaReais(digitos)
  const podeSalvar = valor > 0 && !salvando
  const envelopeSelecionado = envelopesAtivos.find((e) => e.id === envelopeId)

  const voltar = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  const teclar = (tecla: string) => {
    setCampoAtivo('valor')
    setDigitos((atual) => {
      if (tecla === '←') return atual.slice(0, -1)
      const proximo = (atual + tecla).replace(/^0+/, '')
      return proximo.slice(0, 9)
    })
  }

  const salvar = async () => {
    if (!podeSalvar) return
    setSalvando(true)
    try {
      if (emEdicao) {
        await atualizarLancamento(
          emEdicao.id,
          { valor, tipo, categoriaId, contaId, pessoaId, envelopeId, data, descricao: descricao.trim() },
          hoje,
        )
      } else {
        await criarLancamento({
          tipo,
          valor,
          data,
          categoriaId,
          contaId,
          pessoaId,
          envelopeId: tipo === 'despesa' ? envelopeId : null,
          descricao,
          parcelas,
          valorEhTotal: true,
          hoje,
        })
      }
      voltar()
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!emEdicao) return
    if (emEdicao.grupoParcelaId) {
      const tudo = confirm('Apagar todas as parcelas dessa compra? Cancele para apagar só esta.')
      if (tudo) await removerGrupoParcelas(emEdicao.grupoParcelaId)
      else await removerLancamento(emEdicao.id)
    } else {
      await removerLancamento(emEdicao.id)
    }
    voltar()
  }

  const contaSelecionada = contas.find((c) => c.id === contaId)
  const mostrarParcelas = !emEdicao && tipo === 'despesa' && contaSelecionada?.tipo === 'credito'

  return (
    <div className="lancar-screen">
      <header className="lancar-head">
        <button type="button" className="back" onClick={voltar}>
          ‹ voltar
        </button>
        {emEdicao && (
          <button type="button" className="link-btn danger-link" onClick={() => void excluir()}>
            excluir
          </button>
        )}
      </header>

      <div className="segmented">
        <button type="button" className={tipo === 'despesa' ? 'active' : ''} onClick={() => setTipo('despesa')}>
          Gasto
        </button>
        <button type="button" className={tipo === 'receita' ? 'active' : ''} onClick={() => setTipo('receita')}>
          Entrada
        </button>
      </div>

      <button type="button" className={`valor-tile ${campoAtivo === 'valor' ? 'active' : ''}`} onClick={() => setCampoAtivo('valor')}>
        <span className="tile-label">{tipo === 'despesa' ? 'Quanto gastou' : 'Quanto entrou'}</span>
        <span className="tile-value">{formatBRL(valor)}</span>
        {mostrarParcelas && parcelas > 1 && (
          <span className="tile-hint">
            {parcelas}x de {formatBRL(valor / parcelas)}
          </span>
        )}
        {tipo === 'despesa' && envelopeSelecionado && (
          <span className="tile-hint">
            sai de {envelopeSelecionado.emoji} {envelopeSelecionado.nome} ({formatBRL(envelopeSelecionado.saldo)})
          </span>
        )}
      </button>

      {tipo === 'despesa' && envelopesAtivos.length > 0 && (
        <section className="campo">
          <span className="campo-label">Envelope</span>
          <div className="chips">
            {envelopesAtivos.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`chip ${envelopeId === e.id ? 'on' : ''}`}
                style={envelopeId === e.id ? { borderColor: e.cor, color: e.cor } : undefined}
                onClick={() => {
                  setEnvelopeId(envelopeId === e.id ? null : e.id)
                  if (e.categoriaId) setCategoriaId(e.categoriaId)
                }}
              >
                <span aria-hidden="true">{e.emoji}</span> {e.nome}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="campo">
        <span className="campo-label">Categoria</span>
        <div className="chips">
          {categorias
            .filter((c) => !c.arquivada)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${categoriaId === c.id ? 'on' : ''}`}
                style={categoriaId === c.id ? { borderColor: c.cor, color: c.cor } : undefined}
                onClick={() => escolherCategoria(categoriaId === c.id ? null : c.id)}
              >
                <span aria-hidden="true">{c.emoji}</span> {c.nome}
              </button>
            ))}
        </div>
      </section>

      <section className="campo">
        <span className="campo-label">Onde pagou</span>
        <div className="chips">
          {contas
            .filter((c) => !c.arquivada)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${contaId === c.id ? 'on' : ''}`}
                style={contaId === c.id ? { borderColor: c.cor, color: c.cor } : undefined}
                onClick={() => setContaId(c.id)}
              >
                {c.nome}
              </button>
            ))}
        </div>
      </section>

      {(config?.pessoas.length ?? 0) > 1 && (
        <section className="campo">
          <span className="campo-label">Quem</span>
          <div className="chips">
            {config?.pessoas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${pessoaId === p.id ? 'on' : ''}`}
                style={pessoaId === p.id ? { borderColor: p.cor, color: p.cor } : undefined}
                onClick={() => setPessoaId(p.id)}
              >
                {p.nome}
              </button>
            ))}
          </div>
        </section>
      )}

      {mostrarParcelas && (
        <section className="campo">
          <span className="campo-label">Parcelas</span>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
              <button key={n} type="button" className={`chip ${parcelas === n ? 'on' : ''}`} onClick={() => setParcelas(n)}>
                {n}x
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="campo">
        <span className="campo-label">Quando</span>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} onFocus={() => setCampoAtivo('texto')} />
      </section>

      <section className="campo">
        <span className="campo-label">Descrição</span>
        <input
          type="text"
          value={descricao}
          placeholder="Opcional: padaria, farmácia…"
          onChange={(e) => setDescricao(e.target.value)}
          onFocus={() => setCampoAtivo('texto')}
        />
      </section>

      <div className="lancar-dock">
        {campoAtivo === 'valor' && <Numpad onTecla={teclar} />}
        <button type="button" className="primary-btn save-dock" disabled={!podeSalvar} onClick={() => void salvar()}>
          {emEdicao ? 'Salvar alterações' : 'Lançar'}
        </button>
      </div>
    </div>
  )
}

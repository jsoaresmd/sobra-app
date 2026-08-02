import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db, novoId } from '../lib/db'
import { removerRecorrente } from '../lib/acoes'
import { formatBRL } from '../lib/money'
import type { Recorrente, TipoLancamento } from '../lib/types'

export function FixosPage() {
  const navigate = useNavigate()
  const { recorrentes, categorias, contas } = useDados()
  const [novo, setNovo] = useState<Omit<Recorrente, 'id' | 'criadoEm'>>({
    descricao: '',
    tipo: 'despesa',
    valor: 0,
    diaDoMes: 10,
    categoriaId: null,
    contaId: null,
    pessoaId: null,
    ativo: true,
  })

  const despesas = recorrentes.filter((r) => r.tipo === 'despesa')
  const receitas = recorrentes.filter((r) => r.tipo === 'receita')
  const totalFixo = despesas.filter((r) => r.ativo).reduce((s, r) => s + r.valor, 0)

  const atualizar = (id: string, mudancas: Partial<Recorrente>) => {
    void db.recorrentes.update(id, mudancas)
  }

  const criar = () => {
    if (!novo.descricao.trim() || novo.valor <= 0) return
    void db.recorrentes.put({ ...novo, id: novoId(), criadoEm: new Date().toISOString() })
    setNovo({ ...novo, descricao: '', valor: 0 })
  }

  const renderLista = (lista: Recorrente[]) => (
    <ul className="stack">
      {lista.map((r) => (
        <li key={r.id} className="panel stack">
          <div className="orc-linha">
            <input className="orc-nome" value={r.descricao} onChange={(e) => atualizar(r.id, { descricao: e.target.value })} />
            <CampoMoeda className="orc-valor" valor={r.valor} onChange={(v) => atualizar(r.id, { valor: v })} />
          </div>
          <div className="dupla">
            <label>
              Dia do mês
              <input
                type="number"
                min={1}
                max={31}
                value={r.diaDoMes}
                onChange={(e) => atualizar(r.id, { diaDoMes: Number(e.target.value) || 1 })}
              />
            </label>
            <label>
              Categoria
              <select value={r.categoriaId ?? ''} onChange={(e) => atualizar(r.id, { categoriaId: e.target.value || null })}>
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Onde cai
            <select value={r.contaId ?? ''} onChange={(e) => atualizar(r.id, { contaId: e.target.value || null })}>
              <option value="">Não definido</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="orc-acoes">
            <label className="check">
              <input type="checkbox" checked={r.ativo} onChange={(e) => atualizar(r.id, { ativo: e.target.checked })} />
              ativo
            </label>
            <button type="button" className="mini-btn" onClick={() => void removerRecorrente(r.id)}>
              excluir
            </button>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ ajustes
        </button>
        <h1>Contas fixas</h1>
        <p className="muted small">
          É o que o app usa para dizer quanto ainda vai cair. Aluguel, escola, assinaturas, financiamento.
        </p>
      </header>

      <section className="panel stack">
        <h2>Adicionar</h2>
        <div className="segmented">
          {(['despesa', 'receita'] as TipoLancamento[]).map((t) => (
            <button key={t} type="button" className={novo.tipo === t ? 'active' : ''} onClick={() => setNovo({ ...novo, tipo: t })}>
              {t === 'despesa' ? 'Conta a pagar' : 'Renda extra'}
            </button>
          ))}
        </div>
        <label>
          Descrição
          <input value={novo.descricao} placeholder="Aluguel, Netflix…" onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
        </label>
        <div className="dupla">
          <label>
            Valor
            <CampoMoeda valor={novo.valor} onChange={(v) => setNovo({ ...novo, valor: v })} />
          </label>
          <label>
            Dia do mês
            <input
              type="number"
              min={1}
              max={31}
              value={novo.diaDoMes}
              onChange={(e) => setNovo({ ...novo, diaDoMes: Number(e.target.value) || 1 })}
            />
          </label>
        </div>
        <label>
          Categoria
          <select value={novo.categoriaId ?? ''} onChange={(e) => setNovo({ ...novo, categoriaId: e.target.value || null })}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.nome}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary-btn" onClick={criar} disabled={!novo.descricao.trim() || novo.valor <= 0}>
          Adicionar
        </button>
      </section>

      {despesas.length > 0 && (
        <section className="stack">
          <div className="row-between">
            <h2 className="secao-titulo">A pagar todo mês</h2>
            <span className="muted small">{formatBRL(totalFixo)}</span>
          </div>
          {renderLista(despesas)}
        </section>
      )}

      {receitas.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Rendas recorrentes</h2>
          {renderLista(receitas)}
        </section>
      )}
    </div>
  )
}

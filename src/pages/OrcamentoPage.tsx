import { useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db, novoId } from '../lib/db'
import { formatBRL } from '../lib/money'
import type { Categoria } from '../lib/types'

const CORES = ['#2f9e6e', '#e8734a', '#3f7ec4', '#8a6cc4', '#d4557f', '#c9821f', '#2c8fa6', '#b4529c']

export function OrcamentoPage() {
  const navigate = useNavigate()
  const { categorias, resumo } = useDados()

  const totalTetos = categorias.reduce((soma, c) => soma + c.orcamento, 0)

  const atualizar = (id: string, mudancas: Partial<Categoria>) => {
    void db.categorias.update(id, mudancas)
  }

  const adicionar = () => {
    const nome = prompt('Nome da categoria')?.trim()
    if (!nome) return
    const emoji = prompt('Um emoji para ela', '✨')?.trim() || '✨'
    const nova: Categoria = {
      id: novoId(),
      nome,
      emoji,
      cor: CORES[categorias.length % CORES.length],
      grupo: 'variavel',
      orcamento: 0,
      ordem: categorias.length,
    }
    void db.categorias.put(nova)
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ ajustes
        </button>
        <h1>Tetos por categoria</h1>
        <p className="muted small">
          Defina quanto quer gastar em cada coisa. Deixe zerado para acompanhar sem limite.
        </p>
      </header>

      <section className="panel stack">
        <div className="linha-resumo">
          <span>Soma dos tetos</span>
          <strong>{formatBRL(totalTetos)}</strong>
        </div>
        {resumo && (
          <div className="linha-resumo">
            <span>Disponível para gastar</span>
            <strong className={totalTetos > resumo.teto ? 'negativo' : 'positivo'}>{formatBRL(resumo.teto)}</strong>
          </div>
        )}
        {resumo && totalTetos > resumo.teto && (
          <p className="alerta-inline">A soma dos tetos passa do que entra. Reveja algum valor.</p>
        )}
      </section>

      <ul className="lista-orcamento">
        {categorias
          .filter((c) => !c.arquivada)
          .map((categoria) => (
            <li key={categoria.id} className="panel">
              <div className="orc-linha">
                <span className="cat-emoji" aria-hidden="true">
                  {categoria.emoji}
                </span>
                <input
                  className="orc-nome"
                  value={categoria.nome}
                  onChange={(e) => atualizar(categoria.id, { nome: e.target.value })}
                />
                <CampoMoeda
                  className="orc-valor"
                  valor={categoria.orcamento}
                  onChange={(v) => atualizar(categoria.id, { orcamento: v })}
                />
              </div>
              <div className="orc-acoes">
                <div className="segmented pequeno">
                  {(['essencial', 'variavel', 'objetivo'] as const).map((grupo) => (
                    <button
                      key={grupo}
                      type="button"
                      className={categoria.grupo === grupo ? 'active' : ''}
                      onClick={() => atualizar(categoria.id, { grupo })}
                    >
                      {grupo === 'essencial' ? 'Essencial' : grupo === 'variavel' ? 'Variável' : 'Objetivo'}
                    </button>
                  ))}
                </div>
                <button type="button" className="mini-btn" onClick={() => atualizar(categoria.id, { arquivada: true })}>
                  ocultar
                </button>
              </div>
            </li>
          ))}
      </ul>

      <button type="button" className="secondary-btn" onClick={adicionar}>
        Nova categoria
      </button>

      {categorias.some((c) => c.arquivada) && (
        <section className="panel stack">
          <h2>Ocultas</h2>
          <ul className="lista-simples">
            {categorias
              .filter((c) => c.arquivada)
              .map((c) => (
                <li key={c.id}>
                  <span>
                    {c.emoji} {c.nome}
                  </span>
                  <button type="button" className="mini-btn" onClick={() => atualizar(c.id, { arquivada: false })}>
                    restaurar
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

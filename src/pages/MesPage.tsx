import { Link } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { SeletorCiclo } from '../components/SeletorCiclo'
import { formatBRL, formatBRLCurto } from '../lib/money'

export function MesPage() {
  const { resumo, categoriasResumo } = useDados()
  if (!resumo) return null

  const comTeto = categoriasResumo.filter((c) => c.orcamento > 0)
  const semTeto = categoriasResumo.filter((c) => c.orcamento === 0 && c.comprometido > 0)

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Orçamento do período</p>
        <SeletorCiclo />
      </header>

      <section className="panel resumo-panel">
        <div className="linha-resumo">
          <span>Entra</span>
          <strong>{formatBRL(resumo.receitaTotal)}</strong>
        </div>
        {resumo.metaPoupanca > 0 && (
          <div className="linha-resumo">
            <span>Guardar</span>
            <strong className="poupanca">− {formatBRL(resumo.metaPoupanca)}</strong>
          </div>
        )}
        <div className="linha-resumo destaque">
          <span>Pode gastar</span>
          <strong>{formatBRL(resumo.teto)}</strong>
        </div>
        <hr />
        <div className="linha-resumo">
          <span>Contas fixas</span>
          <strong>{formatBRL(resumo.fixos)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Parcelas do mês</span>
          <strong>{formatBRL(resumo.parcelas)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Dia a dia</span>
          <strong>{formatBRL(resumo.gastoLivre)}</strong>
        </div>
        <div className="linha-resumo destaque">
          <span>Sobra</span>
          <strong className={resumo.disponivel < 0 ? 'negativo' : 'positivo'}>{formatBRL(resumo.disponivel)}</strong>
        </div>
      </section>

      <section className="stack">
        <div className="row-between">
          <h2 className="secao-titulo">Por categoria</h2>
          <Link to="/ajustes/orcamento" className="cta">
            definir tetos
          </Link>
        </div>

        {comTeto.length === 0 && semTeto.length === 0 && (
          <p className="muted small">Nenhum gasto neste período ainda.</p>
        )}

        <ul className="lista-categorias">
          {comTeto.map((item) => {
            const largura = Math.min(100, item.percentual * 100)
            return (
              <li key={item.categoria.id} className={`cat-card status-${item.status}`}>
                <div className="cat-topo">
                  <span className="cat-emoji" aria-hidden="true">
                    {item.categoria.emoji}
                  </span>
                  <span className="cat-nome">{item.categoria.nome}</span>
                  <span className="cat-valores">
                    <strong>{formatBRLCurto(item.comprometido)}</strong>
                    <span className="muted small">de {formatBRLCurto(item.orcamento)}</span>
                  </span>
                </div>
                <div className="cat-track" aria-hidden="true">
                  <span className="cat-fill" style={{ width: `${largura}%`, background: item.categoria.cor }} />
                </div>
                <p className="cat-legenda muted small">
                  {item.restante >= 0
                    ? `faltam ${formatBRL(item.restante)}`
                    : `${formatBRL(Math.abs(item.restante))} acima do teto`}
                  {item.aindaVaiCair > 0 ? ` · ${formatBRL(item.aindaVaiCair)} ainda vai cair` : ''}
                </p>
              </li>
            )
          })}
        </ul>

        {semTeto.length > 0 && (
          <div className="panel">
            <h2>Sem teto definido</h2>
            <ul className="lista-simples">
              {semTeto.map((item) => (
                <li key={item.categoria.id}>
                  <span>
                    {item.categoria.emoji} {item.categoria.nome}
                  </span>
                  <strong>{formatBRL(item.comprometido)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

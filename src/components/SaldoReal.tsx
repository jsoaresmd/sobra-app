import { useState } from 'react'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from './CampoMoeda'
import { db } from '../lib/db'
import { formatBRL } from '../lib/money'
import { formatarCurto } from '../lib/dates'

export function SaldoReal() {
  const { caixa, contas, hoje } = useDados()
  const [editando, setEditando] = useState(false)

  if (!caixa) return null

  const contaPrincipal = contas.find((c) => !c.arquivada && c.tipo === 'debito') ?? contas.find((c) => c.tipo !== 'credito')
  const negativo = caixa.sobraReal < 0
  const semSaldo = caixa.saldoBanco === 0 && !caixa.conferidoEm

  const salvarSaldo = (valor: number) => {
    if (!contaPrincipal) return
    void db.contas.update(contaPrincipal.id, { saldo: valor, saldoEm: hoje })
  }

  return (
    <section className={`hero-card ${negativo ? 'status-estourando' : 'status-tranquilo'}`}>
      <p className="hero-label">{negativo ? 'Falta dinheiro para os compromissos' : 'Dinheiro de verdade'}</p>
      <strong className="hero-num">{formatBRL(Math.abs(caixa.sobraReal))}</strong>
      <p className="hero-sub">
        até {formatarCurto(caixa.proximoSalario)}, quando a renda entra · {caixa.diasAteSalario} dia
        {caixa.diasAteSalario === 1 ? '' : 's'}
      </p>

      <div className="verdade">
        <div className="verdade-linha">
          <span>
            No banco
            {caixa.conferidoEm && caixa.diasSemConferir !== null && caixa.diasSemConferir > 2 && (
              <em> · conferido há {caixa.diasSemConferir} dias</em>
            )}
          </span>
          <span className="verdade-valor">
            {formatBRL(caixa.saldoBanco)}
            <button type="button" className="verdade-editar" onClick={() => setEditando((v) => !v)}>
              {editando ? 'fechar' : 'atualizar'}
            </button>
          </span>
        </div>

        {editando && contaPrincipal && (
          <div className="verdade-editor">
            <CampoMoeda valor={contaPrincipal.saldo ?? 0} onChange={salvarSaldo} />
          </div>
        )}

        {caixa.compromissos.map((c) => (
          <div key={c.id} className="verdade-linha">
            <span>
              {c.descricao} <em>· {formatarCurto(c.data)}</em>
            </span>
            <span className="verdade-valor">− {formatBRL(c.valor)}</span>
          </div>
        ))}

        <div className="verdade-linha total">
          <span>Sobra até a próxima renda</span>
          <span className="verdade-valor">{formatBRL(caixa.sobraReal)}</span>
        </div>
      </div>

      {!semSaldo && !negativo && (
        <p className="hero-status">dá {formatBRL(caixa.porDia)} por dia até lá</p>
      )}
      {!semSaldo && negativo && (
        <p className="hero-status">compromissos passam do que há em conta</p>
      )}
    </section>
  )
}

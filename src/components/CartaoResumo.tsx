import { Link } from 'react-router-dom'
import { formatBRL } from '../lib/money'
import { formatarCurto } from '../lib/dates'
import type { Fatura } from '../lib/fatura'

/**
 * Só três números, sem repetir dívida: o que se paga agora, o que já entrou na
 * próxima fatura e o que está parcelado para as seguintes.
 */
export function CartaoResumo({ fatura }: { fatura: Fatura }) {
  const fechada = fatura.fechada > 0
  const proxima = fechada ? fatura.aberta : 0
  const vence = fechada ? fatura.venceEmFechada : fatura.venceEmAberta

  return (
    <section className="panel stack resumo-panel">
      <div className="row-between">
        <h2>
          <span className="conta-bolinha" style={{ background: fatura.conta.cor }} aria-hidden="true" />{' '}
          {fatura.conta.nome}
        </h2>
        <span className="muted small">vence {formatarCurto(vence)}</span>
      </div>

      <div className="termometro-num">
        <strong>{formatBRL(fatura.atual)}</strong>
        <span className="muted small">{fechada ? 'fatura fechada, a pagar' : 'fatura aberta'}</span>
      </div>

      {(proxima > 0 || fatura.futuras > 0) && <hr />}
      {proxima > 0 && (
        <p className="linha-resumo">
          <span>Já na próxima fatura</span>
          <strong>{formatBRL(proxima)}</strong>
        </p>
      )}
      {fatura.futuras > 0 && (
        <p className="linha-resumo">
          <span>Parcelas nas seguintes</span>
          <strong>{formatBRL(fatura.futuras)}</strong>
        </p>
      )}

      <div className="termometro-rodape muted small">
        <span>{fatura.usandoValorInformado ? 'valor conferido no banco' : 'somado dos lançamentos'}</span>
        <Link to="/ajustes/contas" className="cta">
          ajustar valor
        </Link>
      </div>
    </section>
  )
}

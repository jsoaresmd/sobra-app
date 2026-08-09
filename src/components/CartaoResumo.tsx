import { Link } from 'react-router-dom'
import { formatBRL } from '../lib/money'
import { formatarCurto } from '../lib/dates'
import type { Fatura } from '../lib/fatura'

const FONTE: Record<Fatura['fonte'], string> = {
  banco: 'valor informado pelo banco',
  app: 'somado dos lançamentos',
  informado: 'valor que você conferiu',
}

/**
 * Três números, sem repetir dívida: o que se paga agora, o que já entrou na
 * próxima fatura e o que está parcelado para as seguintes.
 */
export function CartaoResumo({ fatura }: { fatura: Fatura }) {
  return (
    <section className="panel stack resumo-panel">
      <div className="row-between">
        <h2>
          <span className="conta-bolinha" style={{ background: fatura.conta.cor }} aria-hidden="true" />{' '}
          {fatura.conta.nome}
        </h2>
        <span className="muted small">vence {formatarCurto(fatura.vence)}</span>
      </div>

      <div className="termometro-num">
        <strong>{formatBRL(fatura.atual)}</strong>
        <span className="muted small">{fatura.fechada ? 'fatura fechada, a pagar' : 'fatura aberta'}</span>
      </div>

      <hr />
      {fatura.pago > 0 && (
        <p className="linha-resumo">
          <span>Já pago desta fatura</span>
          <strong>{formatBRL(fatura.pago)}</strong>
        </p>
      )}
      {fatura.proxima > 0 && (
        <p className="linha-resumo">
          <span>Já na próxima fatura</span>
          <strong>{formatBRL(fatura.proxima)}</strong>
        </p>
      )}
      {fatura.futuras > 0 && (
        <p className="linha-resumo">
          <span>Parcelas nas seguintes</span>
          <strong>{formatBRL(fatura.futuras)}</strong>
        </p>
      )}
      {fatura.limiteDisponivel !== null && (
        <p className="linha-resumo">
          <span>Limite disponível</span>
          <strong>{formatBRL(fatura.limiteDisponivel)}</strong>
        </p>
      )}

      <div className="termometro-rodape muted small">
        <span>{FONTE[fatura.fonte]}</span>
        <Link to="/ajustes/contas" className="cta">
          ajustar valor
        </Link>
      </div>
    </section>
  )
}

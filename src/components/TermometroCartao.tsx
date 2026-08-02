import { Link } from 'react-router-dom'
import { formatBRL, formatBRLCurto } from '../lib/money'
import { formatarCurto } from '../lib/dates'
import type { TermometroFatura } from '../lib/fatura'

export function TermometroCartao({ termometro }: { termometro: TermometroFatura }) {
  const { fatura, teto, espaco, porDia, percentual, estourou } = termometro
  const largura = Math.min(100, Math.max(0, percentual * 100))
  const dias = fatura.diasParaFechar

  const quandoFecha = dias <= 0 ? 'fecha hoje' : dias === 1 ? 'fecha amanhã' : `fecha em ${dias} dias`

  return (
    <section className={`termometro ${estourou ? 'estourou' : ''}`}>
      <div className="row-between">
        <h2>
          <span className="conta-bolinha" style={{ background: fatura.conta.cor }} aria-hidden="true" /> Fatura{' '}
          {fatura.conta.nome}
        </h2>
        <span className="muted small">
          {quandoFecha} · {formatarCurto(fatura.fechaEm)}
        </span>
      </div>

      <div className="termometro-num">
        <strong className={estourou ? 'negativo' : 'positivo'}>{formatBRL(Math.abs(espaco))}</strong>
        <span className="muted small">{estourou ? 'acima do teto' : 'ainda cabem nesta fatura'}</span>
      </div>

      <div className="cat-track" aria-hidden="true">
        <span className={`cat-fill ${estourou ? 'fill-danger' : 'fill-ok'}`} style={{ width: `${largura}%` }} />
      </div>

      <div className="row-between small muted">
        <span>{formatBRLCurto(fatura.aberta)} lançados</span>
        <span>teto {formatBRLCurto(teto)}</span>
      </div>

      <p className="termometro-msg">
        {estourou
          ? `Esta fatura já passou do que a renda cobre. Cada compra até ${formatarCurto(fatura.fechaEm)} aumenta o buraco do mês que vem.`
          : `Dá para gastar ${formatBRL(Math.max(0, porDia))} por dia até fechar sem apertar o próximo mês.`}
      </p>

      <div className="termometro-rodape muted small">
        <span>vence {formatarCurto(fatura.venceEmAberta)}</span>
        {fatura.futuras > 0 && <span>{formatBRL(fatura.futuras)} em parcelas nas próximas</span>}
        {!fatura.usandoValorInformado && (
          <Link to="/ajustes/contas" className="cta">
            informar valor real
          </Link>
        )}
      </div>
    </section>
  )
}

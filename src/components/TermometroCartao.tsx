import { Link } from 'react-router-dom'
import { formatBRL, formatBRLCurto } from '../lib/money'
import { formatarCurto } from '../lib/dates'
import type { TermometroFatura } from '../lib/fatura'

export function TermometroCartao({ termometro }: { termometro: TermometroFatura }) {
  const { fatura, teto, espaco, percentual, estourou } = termometro
  const largura = Math.min(100, Math.max(0, percentual * 100))
  const dias = fatura.diasParaFechar
  const quandoFecha = dias <= 0 ? 'fecha hoje' : dias === 1 ? 'fecha amanhã' : `fecha em ${dias} dias`
  const rotulo = fatura.fechada > 0 ? 'Fatura fechada' : 'Fatura aberta'

  return (
    <section className={`termometro ${estourou ? 'estourou' : ''}`}>
      <div className="row-between">
        <h2>
          <span className="conta-bolinha" style={{ background: fatura.conta.cor }} aria-hidden="true" /> {rotulo}
        </h2>
        <span className="muted small">{quandoFecha}</span>
      </div>

      <div className="termometro-num">
        <strong>{formatBRL(fatura.atual)}</strong>
        <span className="muted small">no Nubank agora</span>
      </div>

      {teto > 0 && (
        <>
          <div className="cat-track" aria-hidden="true">
            <span className={`cat-fill ${estourou ? 'fill-danger' : 'fill-ok'}`} style={{ width: `${largura}%` }} />
          </div>
          <div className="row-between small muted">
            <span>{estourou ? `passou ${formatBRLCurto(Math.abs(espaco))}` : `cabem ${formatBRLCurto(espaco)}`}</span>
            <span>teto {formatBRLCurto(teto)}</span>
          </div>
        </>
      )}

      <div className="termometro-rodape muted small">
        <span>vence {formatarCurto(fatura.fechada > 0 ? fatura.venceEmFechada : fatura.venceEmAberta)}</span>
        <Link to="/ajustes/contas" className="cta">
          ajustar valor
        </Link>
      </div>
    </section>
  )
}

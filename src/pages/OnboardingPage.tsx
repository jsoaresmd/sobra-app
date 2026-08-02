import { useState } from 'react'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db } from '../lib/db'
import { formatBRL } from '../lib/money'

export function OnboardingPage() {
  const { config } = useDados()
  const [renda, setRenda] = useState(0)
  const [poupanca, setPoupanca] = useState(0)
  const [diaInicio, setDiaInicio] = useState(1)

  if (!config) return null

  const teto = Math.max(0, renda - poupanca)

  const concluir = () => {
    void db.config.update('app', {
      rendaMensal: renda,
      metaPoupanca: poupanca,
      diaInicioCiclo: diaInicio,
      onboardingFeito: true,
    })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card stack gap-lg">
        <header className="stack">
          <p className="eyebrow">Bem-vindo ao Sobra</p>
          <h1>Quanto ainda dá para gastar?</h1>
          <p className="muted small">
            Diferente dos outros apps, aqui a conta é feita para o futuro do mês. Só preciso de três informações para
            começar — dá para mudar tudo depois.
          </p>
        </header>

        <label>
          Quanto entra por mês
          <CampoMoeda valor={renda} onChange={setRenda} />
        </label>

        <label>
          Quanto quer guardar
          <CampoMoeda valor={poupanca} onChange={setPoupanca} />
          <span className="ajuda">Fica reservado antes de qualquer gasto. Pode deixar zero.</span>
        </label>

        <label>
          O mês começa no dia
          <input
            type="number"
            min={1}
            max={28}
            value={diaInicio}
            onChange={(e) => setDiaInicio(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
          />
          <span className="ajuda">Use 1 para o mês normal, ou o dia em que o salário cai.</span>
        </label>

        {renda > 0 && (
          <p className="onboarding-previa">
            Você terá <strong>{formatBRL(teto)}</strong> por mês para gastar.
          </p>
        )}

        <button type="button" className="primary-btn" onClick={concluir} disabled={renda <= 0}>
          Começar
        </button>
        <button type="button" className="link-btn" onClick={() => void db.config.update('app', { onboardingFeito: true })}>
          Configurar depois
        </button>
      </div>
    </div>
  )
}

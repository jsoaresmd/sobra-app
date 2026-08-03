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
          <p className="eyebrow">Sobra</p>
          <h1>Começar</h1>
        </header>

        <label>
          Renda mensal
          <CampoMoeda valor={renda} onChange={setRenda} />
        </label>

        <label>
          Guardar por mês
          <CampoMoeda valor={poupanca} onChange={setPoupanca} />
        </label>

        <label>
          Mês começa no dia
          <input
            type="number"
            min={1}
            max={28}
            value={diaInicio}
            onChange={(e) => setDiaInicio(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
          />
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

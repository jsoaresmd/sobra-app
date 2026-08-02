import { useDados } from '../contexts/DadosContext'

export function SeletorCiclo() {
  const { resumo, offsetCiclo, mudarCiclo, voltarParaCicloAtual } = useDados()
  if (!resumo) return null

  return (
    <div className="seletor-ciclo">
      <button type="button" onClick={() => mudarCiclo(-1)} aria-label="Período anterior">
        ‹
      </button>
      <button type="button" className="seletor-label" onClick={voltarParaCicloAtual} disabled={offsetCiclo === 0}>
        <span className="capitalize">{resumo.ciclo.label}</span>
        {offsetCiclo !== 0 && <span className="voltar-hoje">voltar para o atual</span>}
      </button>
      <button type="button" onClick={() => mudarCiclo(1)} aria-label="Próximo período">
        ›
      </button>
    </div>
  )
}

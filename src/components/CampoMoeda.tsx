import { centavosParaReais, formatBRL } from '../lib/money'

type Props = {
  valor: number
  onChange: (valor: number) => void
  placeholder?: string
  className?: string
}

/** Campo de dinheiro que sempre mostra o valor formatado em reais. */
export function CampoMoeda({ valor, onChange, placeholder = 'R$ 0,00', className }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={valor > 0 ? formatBRL(valor) : ''}
      placeholder={placeholder}
      onChange={(e) => onChange(centavosParaReais(e.target.value))}
    />
  )
}

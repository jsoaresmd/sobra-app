import { useEffect, useRef, useState } from 'react'
import { centavosParaReais, formatBRL } from '../lib/money'

type Props = {
  valor: number
  onChange: (valor: number) => void
  /** Se true, só chama onChange ao sair do campo — evita salvar a cada tecla no Supabase. */
  defer?: boolean
  placeholder?: string
  className?: string
}

/** Campo de dinheiro que sempre mostra o valor formatado em reais. */
export function CampoMoeda({ valor, onChange, defer = false, placeholder = 'R$ 0,00', className }: Props) {
  const [rascunho, setRascunho] = useState(valor)
  const rascunhoRef = useRef(valor)
  const focado = useRef(false)
  const atual = defer ? rascunho : valor

  useEffect(() => {
    if (defer && !focado.current) {
      setRascunho(valor)
      rascunhoRef.current = valor
    }
  }, [valor, defer])

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={atual > 0 ? formatBRL(atual) : ''}
      placeholder={placeholder}
      onFocus={() => {
        focado.current = true
      }}
      onChange={(e) => {
        const reais = centavosParaReais(e.target.value)
        if (defer) {
          rascunhoRef.current = reais
          setRascunho(reais)
        } else onChange(reais)
      }}
      onBlur={() => {
        focado.current = false
        if (defer) onChange(rascunhoRef.current)
      }}
    />
  )
}

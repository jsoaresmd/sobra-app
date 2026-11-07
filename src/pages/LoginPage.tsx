import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    setOcupado(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui entrar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="boot login">
      <form className="panel stack" onSubmit={(e) => void enviar(e)}>
        <p className="eyebrow">Sobra</p>
        <h1>Entrar</h1>
        <p className="muted small">Uma conta para os dois celulares. Os dados ficam no Supabase.</p>
        <label>
          E-mail
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>
        {erro && <p className="error">{erro}</p>}
        <button type="submit" className="primary-btn" disabled={ocupado || !email.trim() || !senha}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
  pronto: boolean
  session: Session | null
  user: User | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setPronto(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setSession(sessao)
      setPronto(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const valor: AuthContextValue = {
    pronto,
    session,
    user: session?.user ?? null,
    async entrar(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) throw error
    },
    async sair() {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return contexto
}

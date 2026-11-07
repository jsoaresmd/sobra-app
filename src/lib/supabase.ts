import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function lerEnv(chave: string) {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.[chave] ?? ''
}

const url = lerEnv('VITE_SUPABASE_URL')
/** Prefer publishable (sb_publishable_…); anon JWT legado ainda funciona. */
const chave = lerEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || lerEnv('VITE_SUPABASE_ANON_KEY')

if (!url || !chave) {
  console.warn('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env')
}

export const supabase: SupabaseClient = createClient(url || 'http://localhost', chave || 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export async function userIdAtual() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const id = data.user?.id
  if (!id) throw new Error('Faça login para continuar.')
  return id
}

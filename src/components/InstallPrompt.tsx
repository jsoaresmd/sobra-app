import { useEffect, useState } from 'react'

type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CHAVE_ADIADO = 'sobra:instalacao-adiada'

export function InstallPrompt() {
  const [evento, setEvento] = useState<PromptEvent | null>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(CHAVE_ADIADO) === '1') return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const aoReceber = (e: Event) => {
      e.preventDefault()
      setEvento(e as PromptEvent)
      setVisivel(true)
    }

    window.addEventListener('beforeinstallprompt', aoReceber)
    return () => window.removeEventListener('beforeinstallprompt', aoReceber)
  }, [])

  if (!visivel) return null

  const adiar = () => {
    localStorage.setItem(CHAVE_ADIADO, '1')
    setVisivel(false)
  }

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    await evento.userChoice
    setVisivel(false)
  }

  return (
    <div className="install-overlay" role="dialog" aria-label="Instalar o app">
      <div className="install-sheet">
        <h2>Deixe o Sobra na tela inicial</h2>
        <p className="muted small">
          Instalado, ele abre em tela cheia e funciona sem internet — os dados ficam só neste celular.
        </p>
        <button type="button" className="primary-btn" onClick={() => void instalar()}>
          Instalar agora
        </button>
        <button type="button" className="link-btn" onClick={adiar}>
          Agora não
        </button>
      </div>
    </div>
  )
}

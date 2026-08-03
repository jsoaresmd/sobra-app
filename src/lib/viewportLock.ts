const VIEWPORT =
  'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'

function metaViewport() {
  return document.querySelector('meta[name="viewport"]')
}

function escalaAtual() {
  return window.visualViewport?.scale ?? 1
}

/** Reaplica o meta viewport. Só faz o “tranco” 1.0001 se a escala estiver > 1. */
export function resetarViewport(forcar = false) {
  const meta = metaViewport()
  if (!(meta instanceof HTMLMetaElement)) return

  if (!forcar && escalaAtual() <= 1.01) {
    meta.setAttribute('content', VIEWPORT)
    return
  }

  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0001, minimum-scale=1, maximum-scale=1.0001, user-scalable=no, viewport-fit=cover',
  )
  requestAnimationFrame(() => {
    meta.setAttribute('content', VIEWPORT)
  })
}

/** Instala travas globais de zoom (pinch e foco em inputs). */
export function instalarTravasZoom() {
  const meta = metaViewport()
  if (meta instanceof HTMLMetaElement) meta.setAttribute('content', VIEWPORT)

  const bloquearGesto = (evento: Event) => {
    evento.preventDefault()
  }

  document.addEventListener('gesturestart', bloquearGesto, { passive: false })
  document.addEventListener('gesturechange', bloquearGesto, { passive: false })
  document.addEventListener('gestureend', bloquearGesto, { passive: false })

  document.addEventListener(
    'touchmove',
    (evento) => {
      if (evento.touches.length > 1) evento.preventDefault()
    },
    { passive: false },
  )

  document.addEventListener('focusin', (evento) => {
    const alvo = evento.target
    if (!(alvo instanceof HTMLElement)) return
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return
    const tamanho = parseFloat(getComputedStyle(alvo).fontSize)
    if (tamanho < 16) alvo.style.fontSize = '16px'
  })

  document.addEventListener('focusout', () => {
    window.setTimeout(() => resetarViewport(true), 300)
  })

  let resizeTimer = 0
  window.visualViewport?.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      if (escalaAtual() > 1.05) resetarViewport(true)
    }, 150)
  })

  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => resetarViewport(true), 300)
  })
}

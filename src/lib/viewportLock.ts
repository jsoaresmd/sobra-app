const VIEWPORT =
  'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'

function metaViewport() {
  return document.querySelector('meta[name="viewport"]')
}

/** Força o meta viewport de volta a 1× (útil quando o teclado/iOS deixa o zoom preso). */
export function resetarViewport() {
  const meta = metaViewport()
  if (!(meta instanceof HTMLMetaElement)) return

  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0001, minimum-scale=1, maximum-scale=1.0001, user-scalable=no, viewport-fit=cover',
  )
  requestAnimationFrame(() => {
    meta.setAttribute('content', VIEWPORT)
  })

  const html = document.documentElement
  const body = document.body
  html.style.setProperty('zoom', '1')
  body.style.setProperty('zoom', '1')
  if (html.style.transform) html.style.transform = ''
  if (body.style.transform) body.style.transform = ''
}

/** Instala travas globais de zoom (pinch, duplo toque, foco em inputs). */
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
    window.setTimeout(resetarViewport, 50)
    window.setTimeout(resetarViewport, 350)
  })

  window.visualViewport?.addEventListener('resize', () => {
    const escala = window.visualViewport?.scale ?? 1
    if (escala > 1.01) resetarViewport()
  })

  window.visualViewport?.addEventListener('scroll', () => {
    const escala = window.visualViewport?.scale ?? 1
    if (escala > 1.01) resetarViewport()
  })

  window.addEventListener('orientationchange', () => {
    window.setTimeout(resetarViewport, 250)
  })

  window.addEventListener('pageshow', () => resetarViewport())
}

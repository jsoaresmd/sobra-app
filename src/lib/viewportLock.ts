/** Mantém o meta viewport estável. Sem “trancos” de escala (eles bagunçavam Hoje/Extrato). */
const VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'

export function instalarTravasZoom() {
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta instanceof HTMLMetaElement) meta.setAttribute('content', VIEWPORT)

  document.addEventListener(
    'touchmove',
    (evento) => {
      if (evento.touches.length > 1) evento.preventDefault()
    },
    { passive: false },
  )

  document.addEventListener(
    'gesturestart',
    (evento) => {
      evento.preventDefault()
    },
    { passive: false },
  )
}

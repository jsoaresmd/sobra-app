const ouvintes = new Set<() => void>()
let pausado = 0
let pendente = false

export function aoMudarDados(fn: () => void) {
  ouvintes.add(fn)
  return () => {
    ouvintes.delete(fn)
  }
}

export function avisarMudanca() {
  if (pausado > 0) {
    pendente = true
    return
  }
  pendente = false
  for (const fn of ouvintes) fn()
}

/** Agrupa várias gravações num único refresh no final. */
export async function semAvisar<T>(fn: () => Promise<T>): Promise<T> {
  pausado += 1
  try {
    return await fn()
  } finally {
    pausado -= 1
    if (pausado === 0 && pendente) avisarMudanca()
  }
}

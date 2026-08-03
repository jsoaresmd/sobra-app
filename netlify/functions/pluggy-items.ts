import { cors, metodo, type Handler } from './_pluggy'

/**
 * A Pluggy não expõe listagem de items (segurança) — GET /items → 401.
 * Mantemos este endpoint só para explicar isso ao app e evitar chamada inútil.
 */
export const handler: Handler = async (event) => {
  if (metodo(event) === 'OPTIONS') return cors(204, {})
  return cors(400, {
    error:
      'A Pluggy não permite listar conexões. Use “Recuperar conexão” (abre o MeuPluggy de novo) ou cole o Item ID do dashboard.',
    code: 'ITEMS_LIST_UNSUPPORTED',
  })
}

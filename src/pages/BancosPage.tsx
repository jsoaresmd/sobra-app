import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { db } from '../lib/db'
import {
  criarConnectToken,
  abrirPluggyConnect,
  removerItensPluggy,
  statusItensPluggy,
  itensInexistentes,
} from '../lib/pluggyClient'
import { sincronizarBancosAbertos } from '../lib/sincronizarBancos'
import { formatarCurto } from '../lib/dates'
import { formatBRL } from '../lib/money'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function BancosPage() {
  const navigate = useNavigate()
  const { config, envelopes, hoje, contas, categorias, faturas } = useDados()
  const regras = useLiveQuery(() => db.regrasImportacao.toArray(), [], [])

  const [busy, setBusy] = useState<'conectar' | 'sync' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [itemIdManual, setItemIdManual] = useState('')

  const itemIds = config?.pluggyItemIds ?? []
  const contasPluggy = contas.filter((c) => c.pluggyAccountId && !c.arquivada)

  const salvarIds = async (ids: string[]) => {
    await db.config.update('app', {
      pluggyItemIds: [...new Set(ids)],
      pluggyUltimaSync: '',
    })
  }

  /** Só grava ids que a Pluggy desta aplicação realmente reconhece. */
  const filtrarVivos = async (candidatos: string[]) => {
    if (candidatos.length === 0) return [] as string[]
    try {
      const status = await statusItensPluggy(candidatos)
      return status.filter((s) => !s.falhou).map((s) => s.itemId)
    } catch (e) {
      const mortos = itensInexistentes(e, candidatos)
      if (mortos.length > 0) return candidatos.filter((id) => !mortos.includes(id))
      throw e
    }
  }

  /**
   * Zera a lista local, abre o widget e grava só o que a Pluggy confirmar.
   * Assim um id morto (de outra aplicação / demo) não volta a entrar.
   */
  const conectarDeNovo = async () => {
    setErro(null)
    setOk(null)
    setBusy('conectar')
    try {
      if (itemIds.length > 0) {
        try {
          await removerItensPluggy(itemIds)
        } catch {
          // Ignora: o importante é limpar o aparelho.
        }
        await salvarIds([])
      }

      const token = await criarConnectToken()
      const { itemIds: ids, nova } = await abrirPluggyConnect(token)
      const vivos = await filtrarVivos(ids)

      if (vivos.length === 0) {
        await salvarIds([])
        throw new Error(
          'A Pluggy devolveu uma conexão que esta aplicação não enxerga. ' +
            'No widget, use MeuPluggy com as mesmas credenciais do Netlify — não cole id de outro dashboard.',
        )
      }

      await salvarIds(vivos)
      setOk(nova ? `Conectado · ${vivos[0].slice(0, 8)}…` : `Conexão ok · ${vivos[0].slice(0, 8)}…`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir a conexão.')
    } finally {
      setBusy(null)
    }
  }

  const removerItem = async (id: string) => {
    if (!confirm('Remover esta conexão? Os lançamentos já baixados continuam no app.')) return
    setErro(null)
    setOk(null)
    try {
      await removerItensPluggy([id])
    } catch {
      // Tirar daqui já basta.
    }
    await salvarIds(itemIds.filter((i) => i !== id))
    setOk('Conexão removida.')
  }

  const salvarItemManual = async () => {
    const id = itemIdManual.trim()
    if (!UUID_RE.test(id)) {
      setErro('Item ID inválido.')
      return
    }
    setErro(null)
    setBusy('conectar')
    try {
      const vivos = await filtrarVivos([id])
      if (vivos.length === 0) {
        throw new Error('Esse Item ID não existe nesta aplicação Pluggy. Conecte pelo botão, não cole id de outro lugar.')
      }
      await salvarIds([...itemIds, ...vivos])
      setItemIdManual('')
      setOk('Item ID salvo.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Item ID inválido.')
    } finally {
      setBusy(null)
    }
  }

  const sincronizar = async () => {
    if (itemIds.length === 0) {
      setErro('Conecte o banco antes.')
      return
    }
    setErro(null)
    setOk(null)
    setBusy('sync')
    try {
      if (!config) throw new Error('Config ainda não carregou.')
      const r = await sincronizarBancosAbertos(config, envelopes, regras, hoje, categorias, {
        forcarCompleto: true,
        onProgresso: setOk,
      })
      setOk(
        `${r.novas} novo${r.novas === 1 ? '' : 's'}${
          r.corrigidas ? ` · ${r.corrigidas} corrigido${r.corrigidas === 1 ? '' : 's'}` : ''
        }`,
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na sincronização.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ ajustes
        </button>
        <h1>Bancos</h1>
      </header>

      <section className="panel stack">
        <h2>Conexão</h2>
        <p className="muted small">
          {itemIds.length === 0
            ? 'Nenhum banco conectado.'
            : `${itemIds.length} conexão${itemIds.length === 1 ? '' : 'ões'}${
                config?.pluggyUltimaSync ? ` · ${formatarCurto(config.pluggyUltimaSync.slice(0, 10))}` : ''
              }`}
        </p>

        {itemIds.length > 0 && (
          <ul className="lista-simples">
            {itemIds.map((id) => (
              <li key={id}>
                <span className="muted small id-conexao">{id}</span>
                <button type="button" className="mini-btn" onClick={() => void removerItem(id)}>
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}

        {contasPluggy.length > 0 && (
          <ul className="lista-simples">
            {contasPluggy.map((c) => (
              <li key={c.id}>
                <span>
                  <span className="conta-bolinha" style={{ background: c.cor }} aria-hidden="true" /> {c.nome}
                </span>
                <strong className="muted small">
                  {c.tipo === 'credito'
                    ? formatBRL(faturas.find((f) => f.conta.id === c.id)?.atual ?? 0)
                    : formatBRL(c.saldo ?? 0)}
                </strong>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="primary-btn"
          disabled={busy !== null}
          onClick={() => void conectarDeNovo()}
        >
          {busy === 'conectar' ? 'Abrindo…' : itemIds.length ? 'Conectar de novo' : 'Conectar banco'}
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={busy !== null || itemIds.length === 0}
          onClick={() => void sincronizar()}
        >
          {busy === 'sync' ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>

        <label className="etiqueta-campo">
          <span>Item ID (só se a Pluggy te der um desta aplicação)</span>
          <input
            value={itemIdManual}
            onChange={(e) => setItemIdManual(e.target.value.trim())}
            placeholder="UUID da conexão"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="mini-btn"
          disabled={!itemIdManual || busy !== null}
          onClick={() => void salvarItemManual()}
        >
          Salvar Item ID
        </button>

        {ok && <p className="ok">{ok}</p>}
        {erro && <p className="error">{erro}</p>}

        {itemIds.length > 0 && (
          <button
            type="button"
            className="link-btn danger-link"
            onClick={() => {
              if (confirm('Desconectar bancos neste aparelho?')) void salvarIds([])
            }}
          >
            Desconectar
          </button>
        )}
      </section>

      <section className="panel stack">
        <Link to="/ajustes/etiquetar" className="cta">
          Etiquetar gastos sem envelope
        </Link>
        <Link to="/ajustes/diagnostico" className="cta">
          Ver o que o banco envia
        </Link>
      </section>
    </div>
  )
}

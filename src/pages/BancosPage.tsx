import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { db } from '../lib/db'
import { criarConnectToken, abrirPluggyConnect } from '../lib/pluggyClient'
import { sincronizarBancosAbertos } from '../lib/sincronizarBancos'
import { formatarCurto } from '../lib/dates'
import { formatBRL } from '../lib/money'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function BancosPage() {
  const navigate = useNavigate()
  const { config, envelopes, hoje, contas, categorias } = useDados()
  const regras = useLiveQuery(() => db.regrasImportacao.toArray(), [], [])

  const [busy, setBusy] = useState<'conectar' | 'sync' | 'recuperar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [itemIdManual, setItemIdManual] = useState('')

  const itemIds = config?.pluggyItemIds ?? []
  const contasPluggy = contas.filter((c) => c.pluggyAccountId && !c.arquivada)

  const salvarIds = (ids: string[]) => {
    void db.config.update('app', {
      pluggyItemIds: [...new Set(ids)],
      pluggyUltimaSync: '',
    })
  }

  const conectarOuRecuperar = async (modo: 'conectar' | 'recuperar') => {
    setErro(null)
    setOk(null)
    setBusy(modo)
    try {
      const token = await criarConnectToken()
      const { itemIds: ids, nova } = await abrirPluggyConnect(token)
      salvarIds([...itemIds, ...ids])
      setOk(nova ? 'Conectado.' : 'Conexão recuperada.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui abrir a conexão.'
      if (/already exists|ITEM_USER_ALREADY_EXISTS|item_user_already_exists/i.test(msg)) {
        setErro('Conexão já existe. Cole o Item ID abaixo.')
      } else {
        setErro(msg)
      }
    } finally {
      setBusy(null)
    }
  }

  const salvarItemManual = () => {
    const id = itemIdManual.trim()
    if (!UUID_RE.test(id)) {
      setErro('Item ID inválido.')
      return
    }
    setErro(null)
    salvarIds([...itemIds, id])
    setItemIdManual('')
    setOk('Item ID salvo.')
  }

  const sincronizar = async () => {
    if (itemIds.length === 0) {
      setErro('Conecte ou cole o Item ID antes.')
      return
    }
    setErro(null)
    setOk(null)
    setBusy('sync')
    try {
      if (!config) throw new Error('Config ainda não carregou.')
      const r = await sincronizarBancosAbertos(config, envelopes, regras, hoje, categorias)
      const saldos = r.resumoContas.map((c) => `${c.nome} ${formatBRL(c.valor)}`).join(' · ')
      setOk(`${saldos || `${r.contas} contas`} · ${r.novas} novo${r.novas === 1 ? '' : 's'}`)
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

        {contasPluggy.length > 0 && (
          <ul className="lista-simples">
            {contasPluggy.map((c) => (
              <li key={c.id}>
                <span>
                  <span className="conta-bolinha" style={{ background: c.cor }} aria-hidden="true" /> {c.nome}
                </span>
                <strong className="muted small">
                  {c.tipo === 'credito'
                    ? formatBRL(c.faturaInformada ?? 0)
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
          onClick={() => void conectarOuRecuperar('conectar')}
        >
          {busy === 'conectar' ? 'Abrindo…' : itemIds.length ? 'Conectar outro banco' : 'Conectar banco'}
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={busy !== null}
          onClick={() => void conectarOuRecuperar('recuperar')}
        >
          {busy === 'recuperar' ? 'Abrindo…' : 'Recuperar conexão'}
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
          <span>Item ID</span>
          <input
            value={itemIdManual}
            onChange={(e) => setItemIdManual(e.target.value.trim())}
            placeholder="UUID da conexão"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button type="button" className="mini-btn" disabled={!itemIdManual || busy !== null} onClick={salvarItemManual}>
          Salvar Item ID
        </button>

        {ok && <p className="ok">{ok}</p>}
        {erro && <p className="error">{erro}</p>}

        {itemIds.length > 0 && (
          <button
            type="button"
            className="link-btn danger-link"
            onClick={() => {
              if (confirm('Desconectar bancos neste aparelho?')) salvarIds([])
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
      </section>
    </div>
  )
}

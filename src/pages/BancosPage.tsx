import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { db } from '../lib/db'
import { criarConnectToken, abrirPluggyConnect } from '../lib/pluggyClient'
import { sincronizarBancosAbertos } from '../lib/sincronizarBancos'
import { formatarCurto } from '../lib/dates'

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
    void db.config.update('app', { pluggyItemIds: [...new Set(ids)] })
  }

  const conectarOuRecuperar = async (modo: 'conectar' | 'recuperar') => {
    setErro(null)
    setOk(null)
    setBusy(modo)
    try {
      const token = await criarConnectToken()
      const { itemIds: ids, nova } = await abrirPluggyConnect(token)
      salvarIds([...itemIds, ...ids])
      if (nova) {
        setOk('Banco conectado. Agora toque em Sincronizar.')
      } else {
        setOk(
          `Conexão já existia — recuperei ${ids.length} item${ids.length === 1 ? '' : 's'} neste aparelho. Toque em Sincronizar.`,
        )
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui abrir a conexão.'
      if (/already exists|ITEM_USER_ALREADY_EXISTS|item_user_already_exists/i.test(msg)) {
        setErro(
          'A conexão já existe, mas o widget não devolveu o ID. Cole o Item ID abaixo (dashboard Pluggy → Demo → ⋮ → Copiar Item ID) ou restaure um backup.',
        )
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
      setErro('Item ID inválido. Deve ser um UUID (ex.: 4cce5c6d-b83e-…).')
      return
    }
    setErro(null)
    salvarIds([...itemIds, id])
    setItemIdManual('')
    setOk('Item ID salvo neste aparelho. Toque em Sincronizar.')
  }

  const sincronizar = async () => {
    if (itemIds.length === 0) {
      setErro('Conecte / recupere a conexão (ou cole o Item ID) antes de sincronizar.')
      return
    }
    setErro(null)
    setOk(null)
    setBusy('sync')
    try {
      if (!config) throw new Error('Config ainda não carregou.')
      const resultado = await sincronizarBancosAbertos(config, envelopes, regras, hoje, categorias)
      setOk(
        `Sync ok: ${resultado.novas} lançamento${resultado.novas === 1 ? '' : 's'} novo${resultado.novas === 1 ? '' : 's'}, ${resultado.etiquetadas} no envelope, ${resultado.semEtiqueta} sem etiqueta (${resultado.contas} conta${resultado.contas === 1 ? '' : 's'}).`,
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
        <h1>Bancos (Open Finance)</h1>
        <p className="muted small">
          O Nubank entra pelo{' '}
          <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer">
            Meu Pluggy
          </a>
          . Depois, neste app, no widget você escolhe <strong>MeuPluggy</strong> — não o Nubank com CPF.
        </p>
      </header>

      <section className="panel stack">
        <h2>Conexão</h2>
        <p className="muted small">
          {itemIds.length === 0
            ? 'Nenhum banco conectado ainda neste aparelho.'
            : `${itemIds.length} conexão${itemIds.length === 1 ? '' : 'ões'} · última sync ${
                config?.pluggyUltimaSync ? formatarCurto(config.pluggyUltimaSync.slice(0, 10)) : 'nunca'
              }`}
        </p>

        {contasPluggy.length > 0 && (
          <ul className="lista-simples">
            {contasPluggy.map((c) => (
              <li key={c.id}>
                <span>
                  <span className="conta-bolinha" style={{ background: c.cor }} aria-hidden="true" /> {c.nome}
                </span>
                <strong className="muted small">{c.tipo === 'credito' ? 'crédito' : 'débito'}</strong>
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
          {busy === 'recuperar' ? 'Abrindo…' : 'Recuperar conexão neste aparelho'}
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={busy !== null || itemIds.length === 0}
          onClick={() => void sincronizar()}
        >
          {busy === 'sync' ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>

        <p className="muted small">
          Já conectou no PC? Toque em <strong>Recuperar</strong>, escolha <strong>MeuPluggy</strong> de novo. Se a
          Pluggy disser que já existe, o app guarda o ID sozinho. Alternativa: restaurar backup ou colar o Item ID.
        </p>

        <label className="etiqueta-campo">
          <span>Colar Item ID (opcional)</span>
          <input
            value={itemIdManual}
            onChange={(e) => setItemIdManual(e.target.value.trim())}
            placeholder="ex.: 4cce5c6d-b83e-4741-90b4-…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button type="button" className="mini-btn" disabled={!itemIdManual || busy !== null} onClick={salvarItemManual}>
          Salvar Item ID
        </button>
        <p className="muted small">
          No{' '}
          <a href="https://dashboard.pluggy.ai" target="_blank" rel="noreferrer">
            dashboard.pluggy.ai
          </a>
          : Demo → conexão → menu ⋮ → <strong>Copiar Item ID</strong>.
        </p>

        {ok && <p className="ok">{ok}</p>}
        {erro && <p className="error">{erro}</p>}

        {itemIds.length > 0 && (
          <button
            type="button"
            className="link-btn danger-link"
            onClick={() => {
              if (confirm('Remover as conexões Open Finance deste aparelho? Os lançamentos já importados ficam.')) {
                salvarIds([])
              }
            }}
          >
            Desconectar bancos
          </button>
        )}
      </section>

      <section className="panel stack">
        <h2>Etiquetas</h2>
        <p className="muted small">
          Gastos importados sem envelope ficam no extrato até você marcar o estabelecimento uma vez.
        </p>
        <Link to="/ajustes/etiquetar" className="cta">
          Etiquetar gastos sem envelope
        </Link>
      </section>

      <section className="panel stack">
        <h2>Backup</h2>
        <p className="muted small">
          Limpar dados do site apaga a conexão neste aparelho. Exporte o backup com frequência.
        </p>
        <Link to="/ajustes" className="cta">
          ir para backup em Ajustes
        </Link>
      </section>
    </div>
  )
}

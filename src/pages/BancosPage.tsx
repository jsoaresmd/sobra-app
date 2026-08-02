import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDados } from '../contexts/DadosContext'
import { db } from '../lib/db'
import { criarConnectToken, abrirPluggyConnect } from '../lib/pluggyClient'
import { sincronizarBancosAbertos } from '../lib/sincronizarBancos'
import { formatarCurto } from '../lib/dates'

export function BancosPage() {
  const navigate = useNavigate()
  const { config, envelopes, hoje, contas } = useDados()
  const regras = useLiveQuery(() => db.regrasImportacao.toArray(), [], [])

  const [busy, setBusy] = useState<'conectar' | 'sync' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const itemIds = config?.pluggyItemIds ?? []
  const contasPluggy = contas.filter((c) => c.pluggyAccountId && !c.arquivada)

  const salvarIds = (ids: string[]) => {
    void db.config.update('app', { pluggyItemIds: [...new Set(ids)] })
  }

  const conectar = async () => {
    setErro(null)
    setOk(null)
    setBusy('conectar')
    try {
      const token = await criarConnectToken()
      const itemId = await abrirPluggyConnect(token)
      salvarIds([...itemIds, itemId])
      setOk('Banco conectado. Agora toque em Sincronizar.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir a conexão.')
    } finally {
      setBusy(null)
    }
  }

  const sincronizar = async () => {
    if (itemIds.length === 0) {
      setErro('Conecte um banco antes de sincronizar.')
      return
    }
    setErro(null)
    setOk(null)
    setBusy('sync')
    try {
      if (!config) throw new Error('Config ainda não carregou.')
      const resultado = await sincronizarBancosAbertos(config, envelopes, regras, hoje)
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
          . Depois, neste app, no widget você escolhe <strong>MeuPluggy</strong> — não o Nubank com CPF (isso só vale em
          produção liberada).
        </p>
      </header>

      <section className="panel stack">
        <h2>Como ativar (uma vez)</h2>
        <ol className="passos">
          <li>
            Em{' '}
            <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer">
              meu.pluggy.ai
            </a>
            , conecte o <strong>Nubank</strong> (conta e/ou cartão).
          </li>
          <li>
            No Netlify: <code>PLUGGY_CLIENT_ID</code> e <code>PLUGGY_CLIENT_SECRET</code> (já feito).
          </li>
          <li>
            Aqui: <strong>Conectar banco</strong> → no widget escolha <strong>MeuPluggy</strong> (não Nubank) → autorize.
          </li>
          <li>
            Se tiver mais de um banco no Meu Pluggy, repita a conexão uma vez por banco.
          </li>
        </ol>
      </section>

      <section className="panel stack">
        <h2>Conexão</h2>
        <p className="muted small">
          {itemIds.length === 0
            ? 'Nenhum banco conectado ainda.'
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

        <button type="button" className="primary-btn" disabled={busy !== null} onClick={() => void conectar()}>
          {busy === 'conectar' ? 'Abrindo…' : itemIds.length ? 'Conectar outro banco' : 'Conectar banco'}
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={busy !== null || itemIds.length === 0}
          onClick={() => void sincronizar()}
        >
          {busy === 'sync' ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>

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
        <h2>Enquanto isso</h2>
        <p className="muted small">
          Sem as chaves da Pluggy no Netlify, o caminho automático de transição é importar o CSV da fatura — já usa as
          mesmas etiquetas de envelope.
        </p>
        <Link to="/ajustes/importar-nubank" className="cta">
          Importar CSV/PDF Nubank
        </Link>
      </section>
    </div>
  )
}

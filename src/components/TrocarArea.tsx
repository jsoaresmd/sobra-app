import { useMemo, useState } from 'react'
import { useDados } from '../contexts/DadosContext'
import { atualizarLancamento } from '../lib/acoes'
import { salvarRegraImportacao } from '../lib/regrasImportacao'
import { chaveEstabelecimento, nomeSemParcela } from '../lib/merchant'
import { formatBRL } from '../lib/money'
import { formatarDiaCurto } from '../lib/dates'
import type { Lancamento } from '../lib/types'

/**
 * Corrige a área de um gasto sem tocar em valor ou data, e guarda a lição:
 * o mesmo lugar cai sozinho na área certa nas próximas sincronizações.
 */
export function TrocarArea({ lancamento, onFechar }: { lancamento: Lancamento; onFechar: () => void }) {
  const { envelopes, lancamentos, hoje } = useDados()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const nome = nomeSemParcela(lancamento.descricao || 'Lançamento')
  const chave = chaveEstabelecimento(nome)

  const ativos = useMemo(
    () => envelopes.filter((e) => !e.arquivado && e.tipo !== 'investimento'),
    [envelopes],
  )

  const irmaos = useMemo(() => {
    if (!chave) return []
    return lancamentos.filter(
      (l) =>
        l.id !== lancamento.id &&
        l.tipo === 'despesa' &&
        chaveEstabelecimento(nomeSemParcela(l.descricao || '')) === chave,
    )
  }, [lancamentos, chave, lancamento.id])

  const [tambemIrmaos, setTambemIrmaos] = useState(true)

  const escolher = async (envelopeId: string) => {
    const envelope = ativos.find((e) => e.id === envelopeId)
    if (!envelope) return
    setSalvando(true)
    setErro(null)
    try {
      const alvos = tambemIrmaos ? [lancamento, ...irmaos] : [lancamento]
      for (const l of alvos) {
        await atualizarLancamento(
          l.id,
          { envelopeId: envelope.id, categoriaId: envelope.categoriaId ?? l.categoriaId },
          hoje,
        )
      }
      if (chave) await salvarRegraImportacao(chave, nome, envelope.id, envelope.categoriaId)
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui mudar a área.')
      setSalvando(false)
    }
  }

  return (
    <div className="folha-fundo" role="dialog" aria-modal="true" onClick={onFechar}>
      <div className="folha" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>{nome}</h2>
          <button type="button" className="mini-btn" onClick={onFechar}>
            fechar
          </button>
        </div>
        <p className="muted small">
          {formatarDiaCurto(lancamento.data)} · {formatBRL(lancamento.valor)}
        </p>

        {irmaos.length > 0 && (
          <label className="folha-check">
            <input type="checkbox" checked={tambemIrmaos} onChange={(e) => setTambemIrmaos(e.target.checked)} />
            <span>
              aplicar nos outros {irmaos.length} gasto{irmaos.length === 1 ? '' : 's'} deste lugar
            </span>
          </label>
        )}

        {erro && <p className="error">{erro}</p>}

        <ul className="folha-opcoes">
          {ativos.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={`folha-opcao ${e.id === lancamento.envelopeId ? 'on' : ''}`}
                disabled={salvando}
                onClick={() => void escolher(e.id)}
              >
                <span aria-hidden="true">{e.emoji}</span>
                <span>{e.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

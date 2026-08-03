import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db, novoId } from '../lib/db'
import { apagarTudo, baixarBackup, restaurarBackup } from '../lib/backup'
import { formatBRL } from '../lib/money'

const CORES = ['#4f52d6', '#c9821f', '#2f9e6e', '#d4557f', '#3f7ec4', '#8a6cc4']

export function AjustesPage() {
  const { config, resumo, tetoFatura } = useDados()
  const inputArquivo = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  if (!config) return null

  const salvar = (mudancas: Partial<typeof config>) => {
    void db.config.update('app', mudancas)
  }

  const adicionarPessoa = () => {
    const nome = prompt('Nome da pessoa')?.trim()
    if (!nome) return
    const cor = CORES[config.pessoas.length % CORES.length]
    salvar({ pessoas: [...config.pessoas, { id: novoId(), nome, cor }] })
  }

  const renomearPessoa = (id: string, atual: string) => {
    const nome = prompt('Novo nome', atual)?.trim()
    if (!nome) return
    salvar({ pessoas: config.pessoas.map((p) => (p.id === id ? { ...p, nome } : p)) })
  }

  const removerPessoa = (id: string) => {
    if (config.pessoas.length <= 1) return
    salvar({ pessoas: config.pessoas.filter((p) => p.id !== id) })
  }

  const importar = async (arquivo: File | undefined) => {
    if (!arquivo) return
    try {
      await restaurarBackup(arquivo)
      setAviso('Backup restaurado.')
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : 'Não consegui ler esse arquivo.')
    }
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Ajustes</p>
        <h1>Configuração</h1>
      </header>

      <section className="panel stack">
        <h2>Dinheiro do mês</h2>
        <label>
          Renda mensal
          <CampoMoeda valor={config.rendaMensal} onChange={(v) => salvar({ rendaMensal: v })} />
        </label>
        <label>
          Guardar por mês
          <CampoMoeda valor={config.metaPoupanca} onChange={(v) => salvar({ metaPoupanca: v })} />
        </label>
        {resumo && (
          <p className="muted small">
            Teto: <strong>{formatBRL(resumo.teto)}</strong>
          </p>
        )}
      </section>

      <section className="panel stack">
        <h2>Teto da fatura</h2>
        <p className="muted small">
          Calculado: <strong>{formatBRL(tetoFatura)}</strong>
        </p>
        <label>
          Manual (opcional)
          <CampoMoeda
            valor={config.tetoFaturaManual ?? 0}
            onChange={(v) => salvar({ tetoFaturaManual: v > 0 ? v : undefined })}
          />
        </label>
      </section>

      <section className="panel stack">
        <h2>Período</h2>
        <label>
          Mês começa no dia
          <input
            type="number"
            min={1}
            max={28}
            value={config.diaInicioCiclo}
            onChange={(e) => salvar({ diaInicioCiclo: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
        <label>
          Avisar a partir de (%)
          <input
            type="number"
            min={50}
            max={100}
            value={Math.round(config.alertaEm * 100)}
            onChange={(e) => salvar({ alertaEm: Math.min(1, Math.max(0.5, (Number(e.target.value) || 85) / 100)) })}
          />
        </label>
      </section>

      <section className="panel stack">
        <h2>Quem gasta</h2>
        <ul className="lista-simples">
          {config.pessoas.map((p) => (
            <li key={p.id}>
              <button type="button" className="link-btn" onClick={() => renomearPessoa(p.id, p.nome)}>
                <span className="conta-bolinha" style={{ background: p.cor }} aria-hidden="true" /> {p.nome}
              </button>
              {config.pessoas.length > 1 && (
                <button type="button" className="mini-btn" onClick={() => removerPessoa(p.id)}>
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="secondary-btn" onClick={adicionarPessoa}>
          Adicionar pessoa
        </button>
      </section>

      <section className="panel stack">
        <h2>Configurações</h2>
        <Link className="linha-link" to="/envelopes">
          Envelopes <span>›</span>
        </Link>
        <Link className="linha-link" to="/ajustes/bancos">
          Bancos <span>›</span>
        </Link>
        <Link className="linha-link" to="/ajustes/etiquetar">
          Etiquetar gastos sem envelope <span>›</span>
        </Link>
        <Link className="linha-link" to="/ajustes/importar-nubank">
          Importar fatura Nubank (CSV/PDF) <span>›</span>
        </Link>
        <Link className="linha-link" to="/ajustes/orcamento">
          Tetos por categoria <span>›</span>
        </Link>
        <Link className="linha-link" to="/ajustes/contas">
          Contas e cartões <span>›</span>
        </Link>
        <Link className="linha-link" to="/ajustes/fixos">
          Contas fixas do mês <span>›</span>
        </Link>
      </section>

      <section className="panel stack">
        <h2>Backup</h2>
        <button type="button" className="secondary-btn" onClick={() => void baixarBackup()}>
          Exportar dados
        </button>
        <button type="button" className="secondary-btn" onClick={() => inputArquivo.current?.click()}>
          Restaurar de um arquivo
        </button>
        <input
          ref={inputArquivo}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => void importar(e.target.files?.[0])}
        />
        {aviso && <p className="ok">{aviso}</p>}
        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            if (confirm('Apagar todos os dados deste aparelho? Não dá para desfazer.')) void apagarTudo()
          }}
        >
          Apagar tudo
        </button>
      </section>
    </div>
  )
}

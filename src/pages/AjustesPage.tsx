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
        <h1>Como o app calcula</h1>
      </header>

      <section className="panel stack">
        <h2>Dinheiro do mês</h2>
        <label>
          Renda mensal
          <CampoMoeda valor={config.rendaMensal} onChange={(v) => salvar({ rendaMensal: v })} />
          <span className="ajuda">Sua renda fixa. Entradas extras você lança normalmente.</span>
        </label>
        <label>
          Quero guardar por mês
          <CampoMoeda valor={config.metaPoupanca} onChange={(v) => salvar({ metaPoupanca: v })} />
          <span className="ajuda">Esse valor sai do teto antes de tudo, então o app já o protege.</span>
        </label>
        {resumo && (
          <p className="muted small">
            Teto atual: <strong>{formatBRL(resumo.teto)}</strong> por período.
          </p>
        )}
      </section>

      <section className="panel stack">
        <h2>Teto da fatura</h2>
        <p className="muted small">
          É o quanto a fatura pode custar sem apertar o mês seguinte: a renda menos o que você paga fora do cartão
          (contas fixas em débito, dízimo) e menos o que quer guardar.
        </p>
        <p className="muted small">
          Calculado hoje: <strong>{formatBRL(tetoFatura)}</strong>
        </p>
        <label>
          Definir na mão (opcional)
          <CampoMoeda
            valor={config.tetoFaturaManual ?? 0}
            onChange={(v) => salvar({ tetoFaturaManual: v > 0 ? v : undefined })}
          />
          <span className="ajuda">Deixe zerado para o app calcular sozinho a partir das contas fixas.</span>
        </label>
      </section>

      <section className="panel stack">
        <h2>Período</h2>
        <label>
          O mês começa no dia
          <input
            type="number"
            min={1}
            max={28}
            value={config.diaInicioCiclo}
            onChange={(e) => salvar({ diaInicioCiclo: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
          />
          <span className="ajuda">Use 1 para o mês normal, ou o dia em que o salário cai.</span>
        </label>
        <label>
          Avisar quando passar de
          <input
            type="number"
            min={50}
            max={100}
            value={Math.round(config.alertaEm * 100)}
            onChange={(e) => salvar({ alertaEm: Math.min(1, Math.max(0.5, (Number(e.target.value) || 85) / 100)) })}
          />
          <span className="ajuda">Percentual do orçamento em que o app começa a alertar.</span>
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
          Bancos · Open Finance <span>›</span>
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
        <p className="muted small">
          Tudo fica guardado só neste aparelho. Exporte de vez em quando e salve o arquivo no Drive ou no e-mail.
        </p>
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

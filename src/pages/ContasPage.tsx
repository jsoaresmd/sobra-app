import { useNavigate } from 'react-router-dom'
import { useDados } from '../contexts/DadosContext'
import { CampoMoeda } from '../components/CampoMoeda'
import { db, novoId } from '../lib/db'
import { formatBRL } from '../lib/money'
import { formatarCurto } from '../lib/dates'
import type { Conta, TipoConta } from '../lib/types'

const TIPOS: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'credito', rotulo: 'Cartão de crédito' },
  { valor: 'debito', rotulo: 'Conta / débito' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
]

export function ContasPage() {
  const navigate = useNavigate()
  const { contas, faturas, hoje } = useDados()

  const atualizar = (id: string, mudancas: Partial<Conta>) => {
    void db.contas.update(id, mudancas)
  }

  const adicionar = () => {
    const nome = prompt('Nome da conta ou cartão')?.trim()
    if (!nome) return
    const nova: Conta = {
      id: novoId(),
      nome,
      tipo: 'credito',
      cor: '#4f52d6',
      diaFechamento: 1,
      diaVencimento: 10,
      ordem: contas.length,
    }
    void db.contas.put(nova)
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ ajustes
        </button>
        <h1>Contas e cartões</h1>
        <p className="muted small">
          No cartão, o fechamento define em qual fatura a compra cai — é o que permite prever quanto ainda vem.
        </p>
      </header>

      <ul className="stack">
        {contas
          .filter((c) => !c.arquivada)
          .map((conta) => {
            const fatura = faturas.find((f) => f.conta.id === conta.id)
            return (
              <li key={conta.id} className="panel stack">
                <div className="orc-linha">
                  <span className="conta-bolinha grande" style={{ background: conta.cor }} aria-hidden="true" />
                  <input
                    className="orc-nome"
                    value={conta.nome}
                    onChange={(e) => atualizar(conta.id, { nome: e.target.value })}
                  />
                </div>

                <div className="segmented tres">
                  {TIPOS.map((t) => (
                    <button
                      key={t.valor}
                      type="button"
                      className={conta.tipo === t.valor ? 'active' : ''}
                      onClick={() => atualizar(conta.id, { tipo: t.valor })}
                    >
                      {t.rotulo}
                    </button>
                  ))}
                </div>

                {conta.tipo === 'credito' && (
                  <>
                    <div className="dupla">
                      <label>
                        Fecha dia
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={conta.diaFechamento ?? 1}
                          onChange={(e) => atualizar(conta.id, { diaFechamento: Number(e.target.value) || 1 })}
                        />
                      </label>
                      <label>
                        Vence dia
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={conta.diaVencimento ?? 10}
                          onChange={(e) => atualizar(conta.id, { diaVencimento: Number(e.target.value) || 10 })}
                        />
                      </label>
                    </div>
                    <label>
                      Limite (opcional)
                      <CampoMoeda valor={conta.limite ?? 0} onChange={(v) => atualizar(conta.id, { limite: v })} />
                    </label>
                    <label>
                      Fatura de hoje, conferida no app do banco
                      <CampoMoeda
                        valor={conta.faturaInformada ?? 0}
                        onChange={(v) => atualizar(conta.id, { faturaInformada: v, faturaInformadaEm: hoje })}
                      />
                      <span className="ajuda">
                        Ponto de partida para não precisar cadastrar o que já foi gasto. Daqui em diante só o que você
                        lançar entra por cima.
                        {conta.faturaInformadaEm && ` Informado em ${formatarCurto(conta.faturaInformadaEm)}.`}
                      </span>
                    </label>
                    {fatura && (
                      <p className="muted small">
                        Fatura aberta: <strong>{formatBRL(fatura.aberta)}</strong> · fecha {formatarCurto(fatura.fechaEm)} ·
                        vence {formatarCurto(fatura.venceEmAberta)}
                        {fatura.futuras > 0 && ` · ${formatBRL(fatura.futuras)} em faturas seguintes`}
                      </p>
                    )}
                  </>
                )}

                {conta.tipo !== 'credito' && (
                  <label>
                    Saldo de hoje
                    <CampoMoeda
                      valor={conta.saldo ?? 0}
                      onChange={(v) => atualizar(conta.id, { saldo: v, saldoEm: hoje })}
                    />
                    <span className="ajuda">
                      {conta.saldoEm
                        ? `Conferido em ${formatarCurto(conta.saldoEm)}.`
                        : 'É esse valor que alimenta o “dinheiro de verdade” da tela Hoje.'}
                    </span>
                  </label>
                )}

                <button type="button" className="mini-btn" onClick={() => atualizar(conta.id, { arquivada: true })}>
                  ocultar conta
                </button>
              </li>
            )
          })}
      </ul>

      <button type="button" className="secondary-btn" onClick={adicionar}>
        Nova conta ou cartão
      </button>
    </div>
  )
}

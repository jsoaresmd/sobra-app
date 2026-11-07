import { useEffect, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CampoMoeda } from '../components/CampoMoeda'
import { BarraGasto } from '../components/Placar'
import { useDados } from '../contexts/DadosContext'
import { faltaPagar, previsaoTermino, valeNoMes } from '../lib/compromissos'
import { hojeISO } from '../lib/dates'
import { novoId } from '../lib/ids'
import { resumoDoMes } from '../lib/mesResumo'
import { formatBRL } from '../lib/money'
import { garantirPlanoMes, planoDoMes, salvarPlanoMes } from '../lib/planoMes'
import { deleteCompromisso, insertCompromisso, updateEstabelecimento } from '../lib/repo'
import { tom } from '../lib/tetos'
import type { Compromisso, TipoCompromisso } from '../lib/types'

export function MesPage() {
  const dados = useDados()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [form, setForm] = useState(false)
  const plano = planoDoMes(dados.planosMes, mes, dados.config)
  const resumo = resumoDoMes(
    mes,
    dados.categorias,
    dados.lancamentos,
    dados.compromissos,
    dados.config?.renda ?? 0,
    plano,
  )
  const dividas = dados.compromissos
    .filter((item) => item.divida)
    .sort((a, b) => (b.jurosMes ?? 0) - (a.jurosMes ?? 0) || (b.saldoDevedor ?? 0) - (a.saldoDevedor ?? 0))
  const demais = dados.compromissos.filter((item) => !item.divida)
  const falta = dados.compromissos.reduce((total, item) => total + (faltaPagar(item) ?? 0), 0)
  const rotulo = format(new Date(`${mes}-01T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })
  const creditoEstado = tom(resumo.creditoGasto, resumo.tetoCredito)
  const temPlanoSalvo = dados.planosMes.some((item) => item.mes === mes || item.id === mes)

  useEffect(() => {
    void garantirPlanoMes(mes)
  }, [mes])

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Mês</p>
        <h1 className="capitalize">{rotulo}</h1>
      </header>
      <div className="seletor-ciclo">
        <button type="button" onClick={() => setMes(deslocar(mes, -1))} aria-label="Mês anterior">
          ‹
        </button>
        <span className="seletor-label capitalize">{rotulo}</span>
        <button type="button" onClick={() => setMes(deslocar(mes, 1))} aria-label="Próximo mês">
          ›
        </button>
      </div>

      <section className="panel stack">
        <h2>Plano deste mês</h2>
        {!temPlanoSalvo && <p className="muted small">Ainda sem plano salvo — usando o padrão de Ajustes.</p>}
        <div className="chips">
          <button
            type="button"
            className={plano.modo === 'sair-atraso' ? 'chip ativo' : 'chip'}
            onClick={() => void salvarPlanoMes({ mes, modo: 'sair-atraso' })}
          >
            Sair do atraso
          </button>
          <button
            type="button"
            className={plano.modo === 'guardar' ? 'chip ativo' : 'chip'}
            onClick={() => void salvarPlanoMes({ mes, modo: 'guardar' })}
          >
            Guardar
          </button>
        </div>
        {plano.modo === 'sair-atraso' ? (
          <>
            <label>
              Teto no crédito este mês
              <CampoMoeda
                valor={plano.tetoCredito}
                onChange={(tetoCredito) => void salvarPlanoMes({ mes, tetoCredito })}
              />
            </label>
            <label>
              Fatura que o salário paga (opcional)
              <CampoMoeda
                valor={plano.faturaAPagar ?? 0}
                onChange={(faturaAPagar) => void salvarPlanoMes({ mes, faturaAPagar })}
              />
            </label>
          </>
        ) : (
          <label>
            Meta de guardar
            <CampoMoeda
              valor={plano.metaGuardar}
              onChange={(metaGuardar) => void salvarPlanoMes({ mes, metaGuardar })}
            />
          </label>
        )}
        <label>
          Nota
          <textarea
            rows={2}
            value={plano.notas}
            onChange={(e) => void salvarPlanoMes({ mes, notas: e.target.value })}
            placeholder="Combinado do mês"
          />
        </label>
      </section>

      {resumo.modo === 'sair-atraso' ? (
        <section className="panel stack">
          <h2>Crédito do mês</h2>
          <div className="row-between">
            <span>Já no cartão</span>
            <strong className={`valor-${creditoEstado}`}>{formatBRL(resumo.creditoGasto)}</strong>
          </div>
          <BarraGasto gasto={resumo.creditoGasto} teto={resumo.tetoCredito} />
          <p className="muted small">
            Teto {formatBRL(resumo.tetoCredito)}
            {resumo.creditoSobra >= 0
              ? ` · ainda pode ${formatBRL(resumo.creditoSobra)}`
              : ` · passou ${formatBRL(-resumo.creditoSobra)}`}
          </p>
          {resumo.faturaAPagar > 0 && (
            <p className="muted small">Salário deste mês cobre fatura de {formatBRL(resumo.faturaAPagar)}.</p>
          )}
          <Linha nome="Renda" valor={resumo.renda} />
          <Linha nome="Compromissos" valor={resumo.compromissos} />
          <Linha nome="Gasto semanal" valor={resumo.semanal} />
          <Linha nome="Outras do mês" valor={resumo.mensais} />
        </section>
      ) : (
        <section className="panel">
          <Linha nome="Renda" valor={resumo.renda} detalhe={resumo.extras > 0 ? `fixa ${formatBRL(resumo.rendaFixa)} + extra ${formatBRL(resumo.extras)}` : 'fixa'} />
          <Linha nome="Compromissos" valor={resumo.compromissos} />
          <Linha nome="Gasto semanal" valor={resumo.semanal} />
          <Linha nome="Outras do mês" valor={resumo.mensais} />
          <Linha nome="Sobra" valor={resumo.sobra} destaque />
          <p className={resumo.sobra >= resumo.meta ? 'valor-ok' : 'valor-estouro'}>
            Meta {formatBRL(resumo.meta)}
            {resumo.sobra >= resumo.meta ? ' · a sobra cobre' : ` · faltam ${formatBRL(resumo.meta - resumo.sobra)}`}
          </p>
          <p>Guardado {formatBRL(resumo.guardado)}</p>
        </section>
      )}

      <section className="stack">
        <div className="row-between">
          <h2 className="secao-titulo">Compromissos</h2>
          <button type="button" className="link-btn" onClick={() => setForm((aberto) => !aberto)}>
            {form ? 'Fechar' : 'Novo'}
          </button>
        </div>
        <p className="muted small">
          Comprometido {formatBRL(resumo.compromissos)} · falta {formatBRL(falta)}
        </p>
        {form && <FormCompromisso onSalvo={() => setForm(false)} />}
        <ul className="lista-simples">
          {demais.map((item) => (
            <CompromissoLinha key={item.id} item={item} mes={mes} pago={pago(item.id, mes, dados.lancamentos)} />
          ))}
        </ul>
        {dados.compromissos.length === 0 && <p className="muted">Nenhum compromisso.</p>}
      </section>

      {dividas.length > 0 && (
        <section className="stack">
          <h2 className="secao-titulo">Dívidas</h2>
          <ul className="lista-simples">
            {dividas.map((item) => (
              <CompromissoLinha key={item.id} item={item} mes={mes} pago={pago(item.id, mes, dados.lancamentos)} />
            ))}
          </ul>
        </section>
      )}

      <LinhaDoTempo compromissos={dados.compromissos} />
    </div>
  )
}

function deslocar(mes: string, delta: number) {
  return format(addMonths(new Date(`${mes}-01T12:00:00`), delta), 'yyyy-MM')
}

function pago(id: string, mes: string, lancamentos: { compromissoId?: string | null; data: string; sinal: string }[]) {
  return lancamentos.some((linha) => linha.compromissoId === id && linha.data.startsWith(mes) && linha.sinal === 'saida')
}

function Linha({ nome, valor, detalhe, destaque }: { nome: string; valor: number; detalhe?: string; destaque?: boolean }) {
  return (
    <div className="row-between">
      <span>
        {destaque ? <strong>{nome}</strong> : nome}
        {detalhe && <span className="muted small"> · {detalhe}</span>}
      </span>
      <strong className={destaque ? (valor >= 0 ? 'valor-ok' : 'valor-estouro') : undefined}>{formatBRL(valor)}</strong>
    </div>
  )
}

function CompromissoLinha({ item, mes, pago: foiPago }: { item: Compromisso; mes: string; pago: boolean }) {
  const falta = faltaPagar(item)
  const vale = valeNoMes(item, mes)
  const previsao = item.divida ? previsaoTermino(item) : null
  return (
    <li className="panel">
      <div className="row-between">
        <strong>{item.apelido || item.nome}</strong>
        <span>{formatBRL(item.valor)}</span>
      </div>
      <p className="muted small">
        {item.tipo}
        {item.parcelaAtual && item.parcelasTotal ? ` · ${item.parcelaAtual}/${item.parcelasTotal}` : ''}
        {item.dia ? ` · dia ${item.dia}` : ''}
        {vale ? (foiPago ? ' · pago este mês' : ' · ainda não apareceu') : ''}
      </p>
      {falta != null && <p className="small">Falta {formatBRL(falta)}</p>}
      {previsao && (
        <p className="muted small">{previsao.quita ? `Quita em ${previsao.meses} meses` : 'A parcela não cobre os juros'}</p>
      )}
      <button
        type="button"
        className="link-btn danger-link"
        onClick={() => void apagarCompromisso(item.id)}
      >
        Apagar
      </button>
    </li>
  )
}

async function apagarCompromisso(id: string) {
  await deleteCompromisso(id)
}

function FormCompromisso({ onSalvo }: { onSalvo: () => void }) {
  const { categorias, estabelecimentos } = useDados()
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [valor, setValor] = useState(0)
  const [dia, setDia] = useState('10')
  const [tipo, setTipo] = useState<TipoCompromisso>('fixo')
  const [categoriaId, setCategoriaId] = useState('cat-moradia')
  const [forma, setForma] = useState<NonNullable<Compromisso['forma']>>('boleto')
  const [divida, setDivida] = useState(false)
  const [saldo, setSaldo] = useState(0)
  const [juros, setJuros] = useState('')
  const [restantes, setRestantes] = useState('')
  const [parcelaAtual, setParcelaAtual] = useState('1')
  const [parcelasTotal, setParcelasTotal] = useState('')
  const [lojaId, setLojaId] = useState('')

  return (
    <form
      className="panel stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!nome.trim() || valor <= 0) return
        const id = novoId()
        const atual = Number(parcelaAtual) || undefined
        const total = Number(parcelasTotal) || undefined
        const compromisso: Compromisso = {
          id,
          nome: nome.trim(),
          apelido: apelido.trim(),
          tipo: divida && tipo === 'fixo' ? 'financiamento' : tipo,
          valor,
          dia: Number(dia) || undefined,
          categoriaId,
          divida,
          forma,
          saldoDevedor: divida ? saldo : undefined,
          jurosMes: juros ? Number(juros.replace(',', '.')) : undefined,
          parcelasRestantes: restantes ? Number(restantes) : undefined,
          parcelaAtual: atual,
          parcelasTotal: total,
          mesFinal:
            atual && total ? format(addMonths(new Date(), Math.max(0, total - atual)), 'yyyy-MM') : undefined,
        }
        void insertCompromisso(compromisso).then(async () => {
          if (lojaId) await updateEstabelecimento(lojaId, { compromissoId: id })
          onSalvo()
        })
      }}
    >
      <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <input placeholder="Apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} />
      <CampoMoeda valor={valor} onChange={setValor} />
      <label>
        Dia
        <input inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} />
      </label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCompromisso)}>
        <option value="fixo">Fixo sem fim</option>
        <option value="parcelado">Parcelado</option>
        <option value="financiamento">Financiamento</option>
      </select>
      <select value={forma} onChange={(e) => setForma(e.target.value as NonNullable<Compromisso['forma']>)}>
        <option value="cartao">Cartão</option>
        <option value="boleto">Boleto</option>
        <option value="pix">Pix</option>
        <option value="debito">Débito</option>
      </select>
      <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
        {categorias
          .filter((categoria) => !categoria.arquivada && categoria.tipo !== 'ignorar')
          .map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.emoji} {categoria.nome}
            </option>
          ))}
      </select>
      {tipo !== 'fixo' && (
        <div className="row-between">
          <label>
            Parcela atual
            <input inputMode="numeric" value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} />
          </label>
          <label>
            Total
            <input inputMode="numeric" value={parcelasTotal} onChange={(e) => setParcelasTotal(e.target.value)} />
          </label>
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={divida} onChange={(e) => setDivida(e.target.checked)} /> Dívida
      </label>
      {divida && (
        <>
          <label>
            Saldo devedor
            <CampoMoeda valor={saldo} onChange={setSaldo} />
          </label>
          <label>
            Juros ao mês (%)
            <input inputMode="decimal" value={juros} onChange={(e) => setJuros(e.target.value)} placeholder="opcional" />
          </label>
          <label>
            Parcelas restantes
            <input inputMode="numeric" value={restantes} onChange={(e) => setRestantes(e.target.value)} />
          </label>
        </>
      )}
      <label>
        Ligar a um estabelecimento
        <select value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
          <option value="">Nenhum</option>
          {estabelecimentos.map((loja) => (
            <option key={loja.id} value={loja.id}>
              {loja.apelido || loja.textoOriginal}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary-btn" disabled={!nome.trim() || valor <= 0}>
        Salvar
      </button>
    </form>
  )
}

function LinhaDoTempo({ compromissos }: { compromissos: Compromisso[] }) {
  const itens = compromissos
    .map((item) => ({ item, fim: item.mesFinal }))
    .filter((entrada) => entrada.fim && entrada.item.tipo !== 'fixo')
    .sort((a, b) => (a.fim ?? '').localeCompare(b.fim ?? ''))
  if (itens.length === 0) return null
  return (
    <section className="stack">
      <h2 className="secao-titulo">Quando termina</h2>
      <ul className="lista-simples">
        {itens.map(({ item, fim }) => (
          <li key={item.id} className="row-between">
            <span>
              {item.apelido || item.nome}
              <span className="muted small"> · {fim}</span>
            </span>
            <span>libera {formatBRL(item.valor)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

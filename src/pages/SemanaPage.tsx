import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CampoMoeda } from '../components/CampoMoeda'
import { Placar } from '../components/Placar'
import { useDados } from '../contexts/DadosContext'
import { apagarManual, classificarEstabelecimento, salvarManual } from '../lib/gravar'
import { nomeVisivel } from '../lib/exibir'
import { formatBRL } from '../lib/money'
import { hojeISO } from '../lib/dates'
import { idsDoGrupo } from '../lib/categorias'
import { gastoCreditoNoMes, planoDoMes } from '../lib/planoMes'
import { fimDaSemana, inicioDaSemana, rotuloSemana } from '../lib/semana'
import { placarDaSemana } from '../lib/tetos'
import type { Categoria, Lancamento } from '../lib/types'

export function SemanaPage() {
  const dados = useDados()
  const [params, setParams] = useSearchParams()
  const categoriaId = params.get('cat')
  const semana = inicioDaSemana(hojeISO())
  const mes = hojeISO().slice(0, 7)
  const linhas = useMemo(
    () => placarDaSemana(dados.categorias, dados.lancamentos, semana),
    [dados.categorias, dados.lancamentos, semana],
  )
  const abertos = dados.lancamentos.filter((linha) => linha.categoriaId == null || linha.confirmarEntrada).length
  const semTeto = dados.categorias.some(
    (categoria) =>
      categoria.tipo === 'semanal' && !categoria.arquivada && !categoria.paiId && categoria.tetoMensal <= 0,
  )
  const plano = planoDoMes(dados.planosMes, mes, dados.config)
  const temPlano = dados.planosMes.some((item) => item.mes === mes || item.id === mes)
  const creditoGasto = gastoCreditoNoMes(dados.lancamentos, mes)

  if (categoriaId) {
    return (
      <ListaCategoria
        categoriaId={categoriaId}
        semana={semana}
        onVoltar={() => setParams({})}
      />
    )
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Semana</p>
        <h1>{rotuloSemana(semana)}</h1>
      </header>
      {abertos > 0 && (
        <Link className="aviso" to="/revisar">
          {abertos} {abertos === 1 ? 'lançamento sem categoria' : 'lançamentos sem categoria'}
        </Link>
      )}
      {!temPlano && (
        <Link className="aviso" to="/mes">
          Defina o plano de {mes.slice(5, 7)}/{mes.slice(0, 4)} no Mês
        </Link>
      )}
      {plano.modo === 'sair-atraso' && (
        <Link className="panel" to="/mes">
          <div className="row-between">
            <strong>Crédito no mês</strong>
            <span>
              {formatBRL(creditoGasto)} de {formatBRL(plano.tetoCredito)}
            </span>
          </div>
        </Link>
      )}
      {semTeto && <p className="muted small">Tem categoria sem teto. Dá para definir na revisão ou em Ajustes.</p>}
      <Placar
        linhas={linhas}
        categorias={dados.categorias}
        lancamentos={dados.lancamentos}
        semana={semana}
        onAbrir={(id) => setParams({ cat: id })}
      />
      <Link className="primary-btn full centro" to="/revisar">
        Revisar
      </Link>
    </div>
  )
}

function ListaCategoria({
  categoriaId,
  semana,
  onVoltar,
}: {
  categoriaId: string
  semana: string
  onVoltar: () => void
}) {
  const { categorias, lancamentos, estabelecimentos } = useDados()
  const categoria = categorias.find((item) => item.id === categoriaId)
  const fim = fimDaSemana(semana)
  const ids = new Set(idsDoGrupo(categoriaId, categorias))
  const linhas = lancamentos
    .filter((linha) => linha.categoriaId && ids.has(linha.categoriaId) && linha.data >= semana && linha.data <= fim)
    .sort((a, b) => b.data.localeCompare(a.data) || b.valor - a.valor)

  return (
    <div className="stack gap-lg">
      <button type="button" className="back" onClick={onVoltar}>
        ← Semana
      </button>
      <header className="page-head">
        <p className="eyebrow">{rotuloSemana(semana)}</p>
        <h1>
          {categoria?.emoji} {categoria?.nome}
        </h1>
        {categoria?.paiId && (
          <p className="muted small">
            Sub de {categorias.find((item) => item.id === categoria.paiId)?.nome}
          </p>
        )}
      </header>
      {linhas.length === 0 && <p className="muted">Nada nesta categoria nesta semana.</p>}
      <ul className="lista-lancamentos">
        {linhas.map((linha) => (
          <ItemLinha key={linha.id} linha={linha} categorias={categorias} nome={nomeVisivel(linha, estabelecimentos)} />
        ))}
      </ul>
    </div>
  )
}

function ItemLinha({
  linha,
  categorias,
  nome,
}: {
  linha: Lancamento
  categorias: readonly Categoria[]
  nome: string
}) {
  const manual = linha.origem === 'manual'
  return (
    <li className="stack">
      <div className="row-between">
        <div>
          <strong>{nome}</strong>
          <div className="muted small">
            {linha.data.slice(8, 10)}/{linha.data.slice(5, 7)}
            {manual ? ' · dinheiro' : ' · Nubank'}
            {linha.sinal === 'entrada' ? ' · entrou' : ''}
            {(() => {
              const cat = categorias.find((item) => item.id === linha.categoriaId)
              if (!cat?.paiId) return ''
              return ` · ${cat.emoji} ${cat.nome}`
            })()}
          </div>
        </div>
        <strong>{formatBRL(linha.valor)}</strong>
      </div>
      {manual && (
        <div className="stack">
          <input
            type="date"
            value={linha.data}
            onChange={(e) =>
              void salvarManual({
                id: linha.id,
                tipo: linha.categoriaId === 'cat-investimento' ? 'aporte' : linha.sinal === 'entrada' ? 'entrada' : 'gasto',
                valor: linha.valor,
                data: e.target.value,
                descricao: linha.descricaoOriginal,
                categoriaId: linha.categoriaId,
              })
            }
          />
          <CampoMoeda
            valor={linha.valor}
            onChange={(valor) =>
              void salvarManual({
                id: linha.id,
                tipo: linha.categoriaId === 'cat-investimento' ? 'aporte' : linha.sinal === 'entrada' ? 'entrada' : 'gasto',
                valor,
                data: linha.data,
                descricao: linha.descricaoOriginal,
                categoriaId: linha.categoriaId,
              })
            }
          />
          <button type="button" className="danger-btn" onClick={() => void apagarManual(linha.id)}>
            Apagar
          </button>
        </div>
      )}
      <label>
        Categoria
        <select
          value={linha.categoriaId ?? ''}
          onChange={(e) => void classificarEstabelecimento(linha.estabelecimentoChave, e.target.value)}
        >
          {categorias
            .filter((categoria) => !categoria.arquivada)
            .map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.emoji} {categoria.nome}
              </option>
            ))}
        </select>
      </label>
    </li>
  )
}

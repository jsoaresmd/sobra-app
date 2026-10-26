import { useMemo, useState } from 'react'
import { CampoMoeda } from '../components/CampoMoeda'
import { EscolherCategoria } from '../components/EscolherCategoria'
import { Placar } from '../components/Placar'
import { useDados } from '../contexts/DadosContext'
import { db, novoId } from '../lib/db'
import { maioresCrescimentos, maioresGastos, serieOitoSemanas } from '../lib/comparar'
import { formatarCurto, hojeISO } from '../lib/dates'
import { nomeVisivel } from '../lib/exibir'
import { classificarEstabelecimento, confirmarEntrada, gravarCsv, salvarManual, type ResumoGravado } from '../lib/gravar'
import { avaliarMeta } from '../lib/metas'
import { formatBRL } from '../lib/money'
import { proximaSemana, rotuloSemana, semanaAnterior, semanasPendentes } from '../lib/semana'
import { sugestoesDaSemana } from '../lib/sugestoes'
import { placarDaSemana } from '../lib/tetos'
import { baixarBackup } from '../lib/backup'

type Passo =
  | { tipo: 'importar' }
  | { tipo: 'classificar' }
  | { tipo: 'manual' }
  | { tipo: 'placar'; semana: string }
  | { tipo: 'metas'; semana: string }
  | { tipo: 'comparar'; semana: string }
  | { tipo: 'cortes'; semana: string }
  | { tipo: 'proxima'; semana: string }
  | { tipo: 'fechar' }

function montarPassos(semanas: string[]): Passo[] {
  const passos: Passo[] = [{ tipo: 'importar' }, { tipo: 'classificar' }, { tipo: 'manual' }]
  for (const semana of semanas) passos.push({ tipo: 'placar', semana })
  for (const semana of semanas) passos.push({ tipo: 'metas', semana })
  const ultima = semanas[semanas.length - 1]
  if (ultima) {
    passos.push({ tipo: 'comparar', semana: ultima })
    passos.push({ tipo: 'cortes', semana: ultima })
    passos.push({ tipo: 'proxima', semana: proximaSemana(ultima) })
  }
  passos.push({ tipo: 'fechar' })
  return passos
}

export function RevisarPage() {
  const dados = useDados()
  const [indice, setIndice] = useState(0)
  const [resumos, setResumos] = useState<ResumoGravado[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState('')
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null)
  const [fechou, setFechou] = useState(false)
  const hoje = hojeISO()
  const pendentes = useMemo(
    () => semanasPendentes(dados.revisoes, dados.lancamentos, hoje),
    [dados.revisoes, dados.lancamentos, hoje],
  )
  const passos = useMemo(() => montarPassos(pendentes), [pendentes])
  const passo = passos[Math.min(indice, passos.length - 1)] ?? passos[0]
  const semCategoria = dados.lancamentos.filter((linha) => linha.categoriaId == null)
  const entradas = dados.lancamentos.filter((linha) => linha.confirmarEntrada)
  const bloqueado = passo.tipo === 'classificar' && (semCategoria.length > 0 || entradas.length > 0)
  const seguinte = passo.tipo === 'proxima' ? passo.semana : pendentes.length ? proximaSemana(pendentes[pendentes.length - 1]) : proximaSemana(hoje)

  const subir = async (arquivos: File[]) => {
    if (!arquivos.length) return
    setErro(null)
    setOcupado(true)
    try {
      const saida: ResumoGravado[] = []
      for (const arquivo of arquivos) saida.push(await gravarCsv(await arquivo.text(), arquivo.name))
      setResumos(saida)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o arquivo.')
    } finally {
      setOcupado(false)
    }
  }

  const fechar = async () => {
    if (semCategoria.length || entradas.length) return
    const agora = new Date().toISOString()
    const metasDaProxima = escolhidas ?? []
    await db.transaction('rw', [db.revisoes, db.metasSemana], async () => {
      for (const semana of pendentes) {
        const linhas = placarDaSemana(dados.categorias, dados.lancamentos, semana)
        const snapshot: Record<string, number> = {
          gasto: linhas.reduce((total, linha) => total + linha.gasto, 0),
          teto: linhas.reduce((total, linha) => total + linha.teto, 0),
          sobra: linhas.reduce((total, linha) => total + linha.sobra, 0),
        }
        for (const linha of linhas) snapshot[linha.categoriaId] = linha.gasto
        await db.revisoes.add({
          id: novoId(),
          semanaInicio: semana,
          fechadaEm: agora,
          notas: nota,
          snapshot,
        })
        for (const meta of dados.metasSemana.filter((item) => item.semana === semana && item.ativa)) {
          const modelo = dados.metasModelo.find((item) => item.id === meta.modeloId)
          if (!modelo || modelo.tipo === 'livre') continue
          const resultado = avaliarMeta(modelo, meta, semana, dados.lancamentos)
          await db.metasSemana.update(meta.id, { cumprida: resultado.cumprida, detalhe: resultado.detalhe })
        }
      }
      await db.metasSemana.where('semana').equals(seguinte).delete()
      if (metasDaProxima.length) {
        await db.metasSemana.bulkAdd(
          metasDaProxima.map((modeloId) => ({
            id: novoId(),
            modeloId,
            semana: seguinte,
            ativa: true,
          })),
        )
      }
    })
    setFechou(true)
  }

  if (fechou) {
    return (
      <div className="stack gap-lg">
        <header className="page-head">
          <p className="eyebrow">Revisão</p>
          <h1>Semana fechada</h1>
        </header>
        <p>Os números ficaram salvos neste celular.</p>
        <button type="button" className="primary-btn full" onClick={() => void baixarBackup()}>
          Exportar backup
        </button>
        <button
          type="button"
          className="secondary-btn full"
          onClick={() => {
            setFechou(false)
            setIndice(0)
          }}
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">
          Passo {Math.min(indice, passos.length - 1) + 1} de {passos.length}
        </p>
        <h1>{titulo(passo)}</h1>
      </header>

      {passo.tipo === 'importar' && (
        <section className="stack">
          <p className="muted">Cartão e conta, juntos ou um de cada vez.</p>
          <label className="primary-btn full centro">
            {ocupado ? 'Lendo…' : 'Subir CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={(e) => {
                const arquivos = [...(e.target.files ?? [])]
                e.target.value = ''
                void subir(arquivos)
              }}
            />
          </label>
          {erro && <p className="valor-estouro">{erro}</p>}
          {resumos.map((resumo) => (
            <article key={resumo.arquivo} className="panel">
              <strong>{resumo.arquivo}</strong>
              <p>
                {resumo.novos} novos · {resumo.jaExistiam} já existiam · {resumo.ignorados} ignorados ·{' '}
                {resumo.semCategoria} sem categoria
              </p>
              <p className="muted small">
                {formatarCurto(resumo.inicio)} a {formatarCurto(resumo.fim)}
              </p>
            </article>
          ))}
          <Historico />
        </section>
      )}

      {passo.tipo === 'classificar' && (
        <Classificar semCategoria={semCategoria} entradas={entradas} />
      )}

      {passo.tipo === 'manual' && <Manual />}

      {passo.tipo === 'placar' && (
        <Placar
          linhas={placarDaSemana(dados.categorias, dados.lancamentos, passo.semana)}
          categorias={dados.categorias}
        />
      )}

      {passo.tipo === 'metas' && <ResultadoMetas semana={passo.semana} />}

      {passo.tipo === 'comparar' && <Comparativo semana={passo.semana} />}

      {passo.tipo === 'cortes' && <Cortes semana={passo.semana} />}

      {passo.tipo === 'proxima' && (
        <Proxima
          semana={passo.semana}
          escolhidas={escolhidas ?? dados.metasSemana.filter((meta) => meta.semana === passo.semana && meta.ativa).map((meta) => meta.modeloId)}
          onEscolhidas={setEscolhidas}
          nota={nota}
          onNota={setNota}
        />
      )}

      {passo.tipo === 'fechar' && (
        <section className="stack">
          {pendentes.length === 0 && <p>Não há semana pendente.</p>}
          {pendentes.length > 0 && (
            <p>
              Fechar {pendentes.map((semana) => rotuloSemana(semana)).join(', ')}.
            </p>
          )}
          {(semCategoria.length > 0 || entradas.length > 0) && (
            <p className="valor-estouro">Ainda há lançamento sem categoria.</p>
          )}
          <button type="button" className="primary-btn full" disabled={!pendentes.length || semCategoria.length > 0 || entradas.length > 0} onClick={() => void fechar()}>
            Fechar revisão
          </button>
        </section>
      )}

      {passo.tipo !== 'fechar' && (
        <div className="row-between">
          <button type="button" className="secondary-btn" disabled={indice === 0} onClick={() => setIndice((atual) => Math.max(0, atual - 1))}>
            Voltar
          </button>
          <button type="button" className="primary-btn" disabled={bloqueado} onClick={() => setIndice((atual) => atual + 1)}>
            Próximo
          </button>
        </div>
      )}
    </div>
  )
}

function titulo(passo: Passo) {
  if (passo.tipo === 'importar') return 'Importar'
  if (passo.tipo === 'classificar') return 'Classificar'
  if (passo.tipo === 'manual') return 'Por fora'
  if (passo.tipo === 'placar') return rotuloSemana(passo.semana)
  if (passo.tipo === 'metas') return 'Metas'
  if (passo.tipo === 'comparar') return 'Comparativo'
  if (passo.tipo === 'cortes') return 'Onde cortar'
  if (passo.tipo === 'proxima') return 'Próxima semana'
  return 'Fechar'
}

function Classificar({
  semCategoria,
  entradas,
}: {
  semCategoria: { estabelecimentoChave: string; descricaoOriginal: string; valor: number; id: string }[]
  entradas: { id: string; estabelecimentoChave: string; descricaoOriginal: string; valor: number }[]
}) {
  const { categorias, estabelecimentos } = useDados()
  const [apelidos, setApelidos] = useState<Record<string, string>>({})
  const [reembolso, setReembolso] = useState<string | null>(null)
  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof semCategoria>()
    for (const linha of semCategoria) {
      const lista = mapa.get(linha.estabelecimentoChave) ?? []
      lista.push(linha)
      mapa.set(linha.estabelecimentoChave, lista)
    }
    return [...mapa.entries()]
  }, [semCategoria])

  if (grupos.length === 0 && entradas.length === 0) return <p>Tudo classificado.</p>

  return (
    <div className="stack">
      {grupos.map(([chave, linhas]) => (
        <article key={chave} className="panel">
          <strong>{nomeVisivel(linhas[0], estabelecimentos)}</strong>
          <p className="muted small">
            {linhas.length} · {formatBRL(linhas.reduce((total, linha) => total + linha.valor, 0))}
          </p>
          <input
            placeholder="Apelido"
            value={apelidos[chave] ?? ''}
            onChange={(e) => setApelidos((atual) => ({ ...atual, [chave]: e.target.value }))}
          />
          <EscolherCategoria
            categorias={categorias}
            onEscolher={(categoriaId) => void classificarEstabelecimento(chave, categoriaId, apelidos[chave])}
          />
        </article>
      ))}
      {entradas.map((linha) => (
        <article key={linha.id} className="panel">
          <strong>{nomeVisivel(linha, estabelecimentos)}</strong>
          <p>{formatBRL(linha.valor)} entrou. Renda ou reembolso?</p>
          <button type="button" className="secondary-btn" onClick={() => void confirmarEntrada(linha.id, 'cat-renda')}>
            Renda
          </button>
          <button type="button" className="secondary-btn" onClick={() => setReembolso(linha.id)}>
            Reembolso
          </button>
          {reembolso === linha.id && (
            <EscolherCategoria categorias={categorias} onEscolher={(categoriaId) => void confirmarEntrada(linha.id, categoriaId)} />
          )}
        </article>
      ))}
    </div>
  )
}

function Manual() {
  const { categorias, lancamentos } = useDados()
  const recentes = lancamentos.filter((linha) => linha.origem === 'manual').slice(-5).reverse()
  return (
    <div className="stack">
      <p className="muted">Dinheiro vivo, entrada ou aporte. Pode pular.</p>
      <FormManual tipo="gasto" categorias={categorias.filter((categoria) => categoria.tipo === 'semanal' || categoria.tipo === 'mensal')} />
      <FormManual tipo="entrada" categorias={categorias.filter((categoria) => categoria.tipo === 'renda')} />
      <FormManual tipo="aporte" categorias={[]} />
      {recentes.length > 0 && (
        <ul className="lista-lancamentos">
          {recentes.map((linha) => (
            <li key={linha.id} className="row-between">
              <span>{linha.descricaoOriginal}</span>
              <span>{formatBRL(linha.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormManual({
  tipo,
  categorias,
}: {
  tipo: 'gasto' | 'entrada' | 'aporte'
  categorias: { id: string; nome: string }[]
}) {
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(hojeISO())
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? 'cat-renda')
  const titulo = tipo === 'gasto' ? 'Gasto em dinheiro' : tipo === 'entrada' ? 'Entrada em dinheiro' : 'Aporte'
  return (
    <form
      className="panel stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (valor <= 0) return
        void salvarManual({ tipo, valor, data, descricao, categoriaId }).then(() => {
          setValor(0)
          setDescricao('')
        })
      }}
    >
      <h2>{titulo}</h2>
      <CampoMoeda valor={valor} onChange={setValor} />
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
      <input placeholder="O quê" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      {tipo !== 'aporte' && (
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="secondary-btn" disabled={valor <= 0}>
        Lançar
      </button>
    </form>
  )
}

function ResultadoMetas({ semana }: { semana: string }) {
  const { metasModelo, metasSemana, lancamentos } = useDados()
  const ativas = metasSemana.filter((meta) => meta.semana === semana && meta.ativa)
  if (ativas.length === 0) return <p className="muted">Nenhuma meta nesta semana.</p>
  return (
    <ul className="lista-simples">
      {ativas.map((meta) => {
        const modelo = metasModelo.find((item) => item.id === meta.modeloId)
        if (!modelo) return null
        const resultado = avaliarMeta(modelo, meta, semana, lancamentos)
        return (
          <li key={meta.id} className="panel">
            <div className="row-between">
              <strong>{modelo.nome}</strong>
              <span className={resultado.cumprida ? 'valor-ok' : 'valor-estouro'}>{resultado.cumprida ? 'Cumpriu' : 'Não cumpriu'}</span>
            </div>
            <p className="muted small">{resultado.detalhe}</p>
            {resultado.manual && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void db.metasSemana.update(meta.id, { cumprida: !meta.cumprida })}
              >
                {meta.cumprida ? 'Desmarcar' : 'Marcar como feita'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Comparativo({ semana }: { semana: string }) {
  const { lancamentos, estabelecimentos, categorias } = useDados()
  const [categoriaId, setCategoriaId] = useState<string>('')
  const serie = serieOitoSemanas(lancamentos, semana, categoriaId || undefined)
  const maximo = Math.max(1, ...serie.map((item) => item.total))
  const top = maioresGastos(lancamentos, semana)
  const cresceu = maioresCrescimentos(lancamentos, semana)
  return (
    <div className="stack">
      <div className="chips">
        <button type="button" className={categoriaId === '' ? 'chip ativo' : 'chip'} onClick={() => setCategoriaId('')}>
          Total
        </button>
        {categorias
          .filter((categoria) => categoria.tipo === 'semanal' && !categoria.arquivada)
          .map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              className={categoriaId === categoria.id ? 'chip ativo' : 'chip'}
              onClick={() => setCategoriaId(categoria.id)}
            >
              {categoria.emoji} {categoria.nome}
            </button>
          ))}
      </div>
      <div className="colunas" aria-hidden="true">
        {serie.map((item) => (
          <div key={item.semana} className="coluna" title={item.rotulo}>
            <span style={{ height: `${Math.max(4, (item.total / maximo) * 100)}%` }} />
          </div>
        ))}
      </div>
      <p className="muted small">Últimas 8 semanas. A da direita é esta.</p>
      <h2 className="secao-titulo">Maiores gastos</h2>
      <ul className="lista-lancamentos">
        {top.map((linha) => (
          <li key={linha.id} className="row-between">
            <span>{nomeVisivel(linha, estabelecimentos)}</span>
            <strong>{formatBRL(linha.valor)}</strong>
          </li>
        ))}
        {top.length === 0 && <li className="muted">Nenhum gasto nesta semana.</li>}
      </ul>
      <h2 className="secao-titulo">Onde cresceu</h2>
      <ul className="lista-simples">
        {cresceu.map((item) => (
          <li key={item.chave} className="row-between">
            <span>{nomeVisivel({ estabelecimentoChave: item.chave, descricaoOriginal: item.chave }, estabelecimentos)}</span>
            <span>+{formatBRL(item.delta)}</span>
          </li>
        ))}
        {cresceu.length === 0 && <li className="muted">Nenhum estabelecimento cresceu.</li>}
      </ul>
    </div>
  )
}

function Cortes({ semana }: { semana: string }) {
  const { categorias, lancamentos } = useDados()
  const textos = sugestoesDaSemana(
    semana,
    placarDaSemana(categorias, lancamentos, semana),
    placarDaSemana(categorias, lancamentos, semanaAnterior(semana)),
    lancamentos,
    categorias,
  )
  if (textos.length === 0) return <p>Nada a cortar nesta semana.</p>
  return (
    <ul className="lista-simples">
      {textos.map((texto) => (
        <li key={texto} className="panel">
          {texto}
        </li>
      ))}
    </ul>
  )
}

function Proxima({
  semana,
  escolhidas,
  onEscolhidas,
  nota,
  onNota,
}: {
  semana: string
  escolhidas: string[]
  onEscolhidas: (ids: string[]) => void
  nota: string
  onNota: (nota: string) => void
}) {
  const { metasModelo, categorias } = useDados()
  const semanais = categorias.filter((categoria) => categoria.tipo === 'semanal' && !categoria.arquivada)
  return (
    <div className="stack">
      <p className="muted">{rotuloSemana(semana)}</p>
      {metasModelo.map((modelo) => {
        const ativo = escolhidas.includes(modelo.id)
        return (
          <button
            key={modelo.id}
            type="button"
            className={ativo ? 'secondary-btn' : 'ghost-linha'}
            onClick={() => onEscolhidas(ativo ? escolhidas.filter((id) => id !== modelo.id) : [...escolhidas, modelo.id])}
          >
            {ativo ? '✓ ' : ''}
            {modelo.nome}
          </button>
        )
      })}
      <h2 className="secao-titulo">Tetos do mês</h2>
      {semanais.map((categoria) => (
        <label key={categoria.id}>
          {categoria.emoji} {categoria.nome}
          <CampoMoeda valor={categoria.tetoMensal} onChange={(tetoMensal) => void db.categorias.update(categoria.id, { tetoMensal })} />
        </label>
      ))}
      <label>
        Anotação
        <textarea rows={3} value={nota} onChange={(e) => onNota(e.target.value)} placeholder="Combinado do casal" />
      </label>
    </div>
  )
}

function Historico() {
  const { revisoes } = useDados()
  if (revisoes.length === 0) return null
  return (
    <section className="stack">
      <h2 className="secao-titulo">Histórico</h2>
      <ul className="lista-simples">
        {revisoes.map((revisao) => (
          <li key={revisao.id} className="panel">
            <div className="row-between">
              <strong>{rotuloSemana(revisao.semanaInicio)}</strong>
              <button type="button" className="link-btn" onClick={() => void db.revisoes.delete(revisao.id)}>
                Reabrir
              </button>
            </div>
            {revisao.notas && <p className="muted small">{revisao.notas}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

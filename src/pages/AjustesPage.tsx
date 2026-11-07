import { useMemo, useRef, useState } from 'react'
import { CampoMoeda } from '../components/CampoMoeda'
import { useDados } from '../contexts/DadosContext'
import { apagarTudo, baixarBackup, baixarBackupLegado, restaurarBackup } from '../lib/backup'
import { db, novoId } from '../lib/db'
import type { Categoria, Config, MetaModelo, TipoCategoria, TipoMeta } from '../lib/types'

type Secao = 'inicio' | 'categorias' | 'estabelecimentos' | 'metas'

export function AjustesPage() {
  const [secao, setSecao] = useState<Secao>('inicio')
  if (secao === 'categorias') return <Categorias onVoltar={() => setSecao('inicio')} />
  if (secao === 'estabelecimentos') return <Lojas onVoltar={() => setSecao('inicio')} />
  if (secao === 'metas') return <Metas onVoltar={() => setSecao('inicio')} />
  return <Inicio onAbrir={setSecao} />
}

function Inicio({ onAbrir }: { onAbrir: (secao: Secao) => void }) {
  const { config, temBackupLegado } = useDados()
  const inputArquivo = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  if (!config) return null

  const salvar = (mudancas: Partial<Config>) => {
    void db.config.update('app', mudancas)
  }

  return (
    <div className="stack gap-lg">
      <header className="page-head">
        <p className="eyebrow">Ajustes</p>
        <h1>Configuração</h1>
      </header>
      <nav className="stack">
        <button type="button" className="secondary-btn" onClick={() => onAbrir('categorias')}>
          Categorias e tetos
        </button>
        <button type="button" className="secondary-btn" onClick={() => onAbrir('estabelecimentos')}>
          Estabelecimentos
        </button>
        <button type="button" className="secondary-btn" onClick={() => onAbrir('metas')}>
          Metas
        </button>
      </nav>
      <section className="panel stack">
        <h2>Mês</h2>
        <label>
          Renda mensal fixa
          <CampoMoeda valor={config.renda} onChange={(renda) => salvar({ renda })} />
        </label>
        <label>
          Meta de guardar (padrão)
          <CampoMoeda valor={config.metaGuardarMes} onChange={(metaGuardarMes) => salvar({ metaGuardarMes })} />
        </label>
        <p className="muted small">Usada ao criar o plano de um mês novo no modo Guardar. O plano do mês se edita em Mês.</p>
        <label>
          Nomes do titular
          <textarea
            rows={3}
            value={config.nomesTitular.join('\n')}
            onChange={(e) =>
              salvar({
                nomesTitular: e.target.value
                  .split('\n')
                  .map((linha) => linha.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <p className="muted small">Um nome por linha. Transferência com esses nomes é ignorada.</p>
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
          onChange={(e) => {
            const arquivo = e.target.files?.[0]
            if (!arquivo) return
            void restaurarBackup(arquivo)
              .then(() => setAviso('Backup restaurado.'))
              .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não consegui ler esse arquivo.'))
          }}
        />
        {temBackupLegado && (
          <button type="button" className="secondary-btn" onClick={() => void baixarBackupLegado().catch((e) => setErro(String(e)))}>
            Baixar cópia da versão anterior
          </button>
        )}
        {aviso && <p className="ok">{aviso}</p>}
        {erro && <p className="error">{erro}</p>}
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

function Categorias({ onVoltar }: { onVoltar: () => void }) {
  const { categorias } = useDados()
  const [nome, setNome] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [tipo, setTipo] = useState<TipoCategoria>('semanal')
  return (
    <div className="stack gap-lg">
      <button type="button" className="back" onClick={onVoltar}>
        ← Ajustes
      </button>
      <header className="page-head">
        <h1>Categorias</h1>
      </header>
      <ul className="lista-simples">
        {categorias.map((categoria) => (
          <CategoriaItem key={categoria.id} categoria={categoria} />
        ))}
      </ul>
      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nome.trim()) return
          const ordem = Math.max(0, ...categorias.map((categoria) => categoria.ordem)) + 1
          void db.categorias.add({
            id: novoId(),
            nome: nome.trim(),
            emoji: emoji || '📌',
            cor: '#5a6b8c',
            tipo,
            tetoMensal: 0,
            arquivada: false,
            ordem,
          })
          setNome('')
        }}
      >
        <h2>Nova</h2>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)}>
          <option value="semanal">Semanal, com teto</option>
          <option value="mensal">Mensal</option>
          <option value="investimento">Investimento</option>
        </select>
        <button type="submit" className="primary-btn" disabled={!nome.trim()}>
          Criar
        </button>
      </form>
    </div>
  )
}

function CategoriaItem({ categoria }: { categoria: Categoria }) {
  const protegida = categoria.id === 'cat-ignorar' || categoria.id === 'cat-renda'
  return (
    <li className="panel">
      <div className="row-between">
        <strong>
          {categoria.emoji} {categoria.nome}
        </strong>
        {categoria.arquivada && <span className="muted small">arquivada</span>}
      </div>
      <input
        value={categoria.nome}
        onChange={(e) => void db.categorias.update(categoria.id, { nome: e.target.value })}
      />
      <input
        value={categoria.emoji}
        maxLength={4}
        onChange={(e) => void db.categorias.update(categoria.id, { emoji: e.target.value })}
      />
      {categoria.tipo === 'semanal' && (
        <label>
          Teto do mês
          <CampoMoeda
            valor={categoria.tetoMensal}
            onChange={(tetoMensal) => void db.categorias.update(categoria.id, { tetoMensal })}
          />
        </label>
      )}
      {!protegida && (
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void db.categorias.update(categoria.id, { arquivada: !categoria.arquivada })}
        >
          {categoria.arquivada ? 'Reativar' : 'Arquivar'}
        </button>
      )}
    </li>
  )
}

function Lojas({ onVoltar }: { onVoltar: () => void }) {
  const { estabelecimentos, categorias } = useDados()
  const [busca, setBusca] = useState('')
  const lista = useMemo(() => {
    const texto = busca.trim().toLowerCase()
    return estabelecimentos
      .filter((loja) => {
        if (!texto) return true
        return `${loja.apelido} ${loja.textoOriginal} ${loja.nota}`.toLowerCase().includes(texto)
      })
      .sort((a, b) => (a.apelido || a.textoOriginal).localeCompare(b.apelido || b.textoOriginal, 'pt'))
  }, [estabelecimentos, busca])
  return (
    <div className="stack gap-lg">
      <button type="button" className="back" onClick={onVoltar}>
        ← Ajustes
      </button>
      <header className="page-head">
        <h1>Estabelecimentos</h1>
      </header>
      <input placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <ul className="lista-simples">
        {lista.map((loja) => (
          <li key={loja.id} className="panel">
            <p className="muted small">{loja.textoOriginal}</p>
            <input
              placeholder="Apelido"
              value={loja.apelido}
              onChange={(e) => void db.estabelecimentos.update(loja.id, { apelido: e.target.value })}
            />
            <input
              placeholder="Nota"
              value={loja.nota}
              onChange={(e) => void db.estabelecimentos.update(loja.id, { nota: e.target.value })}
            />
            <select
              value={loja.categoriaId ?? ''}
              onChange={(e) =>
                void db.estabelecimentos.update(loja.id, { categoriaId: e.target.value || null })
              }
            >
              <option value="">Sem regra</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.emoji} {categoria.nome}
                </option>
              ))}
            </select>
            {loja.categoriaId && (
              <button type="button" className="link-btn danger-link" onClick={() => void db.estabelecimentos.update(loja.id, { categoriaId: null })}>
                Apagar regra
              </button>
            )}
          </li>
        ))}
      </ul>
      {lista.length === 0 && <p className="muted">Nenhum estabelecimento ainda. Eles aparecem na importação.</p>}
    </div>
  )
}

function Metas({ onVoltar }: { onVoltar: () => void }) {
  const { metasModelo, categorias } = useDados()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoMeta>('limite-valor')
  const [categoriaId, setCategoriaId] = useState('cat-restaurante')
  const [valor, setValor] = useState(100)
  const [quantidade, setQuantidade] = useState('2')
  const [texto, setTexto] = useState('')
  const semanais = categorias.filter((categoria) => categoria.tipo === 'semanal' && !categoria.arquivada)

  return (
    <div className="stack gap-lg">
      <button type="button" className="back" onClick={onVoltar}>
        ← Ajustes
      </button>
      <header className="page-head">
        <h1>Metas</h1>
      </header>
      <ul className="lista-simples">
        {metasModelo.map((modelo) => (
          <li key={modelo.id} className="panel row-between">
            <span>{modelo.nome}</span>
            <button type="button" className="link-btn danger-link" onClick={() => void db.metasModelo.delete(modelo.id)}>
              Apagar
            </button>
          </li>
        ))}
      </ul>
      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nome.trim()) return
          const modelo: MetaModelo = {
            id: novoId(),
            nome: nome.trim(),
            tipo,
            parametros: parametros(tipo, categoriaId, valor, Number(quantidade) || 0, texto),
            ativaPorPadrao: false,
          }
          void db.metasModelo.add(modelo)
          setNome('')
        }}
      >
        <h2>Nova meta</h2>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMeta)}>
          <option value="limite-valor">Limite de valor</option>
          <option value="limite-quantidade">Limite de quantidade</option>
          <option value="zero-categoria">Zero numa categoria</option>
          <option value="zero-parcelamento-novo">Nenhuma parcela nova</option>
          <option value="guardar">Guardar valor</option>
          <option value="livre">Livre</option>
        </select>
        {(tipo === 'limite-valor' || tipo === 'limite-quantidade' || tipo === 'zero-categoria') && (
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {semanais.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        )}
        {(tipo === 'limite-valor' || tipo === 'guardar') && <CampoMoeda valor={valor} onChange={setValor} />}
        {tipo === 'limite-quantidade' && (
          <input inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        )}
        {tipo === 'livre' && <input placeholder="Texto" value={texto} onChange={(e) => setTexto(e.target.value)} />}
        <button type="submit" className="primary-btn" disabled={!nome.trim()}>
          Criar
        </button>
      </form>
    </div>
  )
}

function parametros(tipo: TipoMeta, categoriaId: string, valor: number, quantidade: number, texto: string) {
  const saida: Record<string, string | number> = {}
  if (tipo === 'limite-valor') {
    saida.categoriaId = categoriaId
    saida.valor = valor
  } else if (tipo === 'limite-quantidade') {
    saida.categoriaId = categoriaId
    saida.quantidade = quantidade
  } else if (tipo === 'zero-categoria') {
    saida.categoriaId = categoriaId
  } else if (tipo === 'guardar') {
    saida.valor = valor
  } else if (tipo === 'livre') {
    saida.texto = texto
  }
  return saida
}

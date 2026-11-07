import { useMemo, useState, type FormEvent } from 'react'
import { filhasDe, raizes } from '../lib/categorias'
import { novoId } from '../lib/ids'
import { insertCategoria } from '../lib/repo'
import type { Categoria, TipoCategoria } from '../lib/types'

export function EscolherCategoria({
  categorias,
  onEscolher,
  desabilitado = false,
}: {
  categorias: readonly Categoria[]
  onEscolher: (categoriaId: string) => void
  desabilitado?: boolean
}) {
  const pais = useMemo(() => raizes(categorias), [categorias])
  const [paiAberto, setPaiAberto] = useState<string | null>(null)
  const [criando, setCriando] = useState<'raiz' | 'filha' | null>(null)
  const [nome, setNome] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [tipo, setTipo] = useState<TipoCategoria>('semanal')
  const [paiNova, setPaiNova] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const pai = paiAberto ? categorias.find((categoria) => categoria.id === paiAberto) : null
  const filhas = paiAberto ? filhasDe(categorias, paiAberto) : []

  const resetCriar = () => {
    setCriando(null)
    setNome('')
    setEmoji('📌')
    setTipo('semanal')
    setPaiNova(paiAberto ?? '')
    setErro(null)
  }

  const tocarPai = (id: string) => {
    const lista = filhasDe(categorias, id)
    if (lista.length === 0) onEscolher(id)
    else setPaiAberto(id)
  }

  const criar = async (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || ocupado || desabilitado) return
    if (criando === 'filha' && !paiNova) {
      setErro('Escolha a categoria pai.')
      return
    }
    setErro(null)
    setOcupado(true)
    const id = novoId()
    const paiCat = criando === 'filha' ? categorias.find((categoria) => categoria.id === paiNova) : null
    const ordem = Math.max(0, ...categorias.map((categoria) => categoria.ordem)) + 1
    try {
      await insertCategoria({
        id,
        nome: nome.trim(),
        emoji: emoji.trim() || '📌',
        cor: paiCat?.cor ?? '#5a6b8c',
        tipo: paiCat?.tipo ?? tipo,
        tetoMensal: 0,
        arquivada: false,
        ordem,
        paiId: criando === 'filha' ? paiNova : null,
      })
      resetCriar()
      if (criando === 'filha') setPaiAberto(paiNova)
      onEscolher(id)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui criar a categoria.')
    } finally {
      setOcupado(false)
    }
  }

  if (pai && paiAberto) {
    return (
      <div className="stack">
        <button type="button" className="back" disabled={desabilitado || ocupado} onClick={() => setPaiAberto(null)}>
          ← Categorias
        </button>
        <p className="muted small">
          {pai.emoji} {pai.nome}
        </p>
        <div className="cat-grid">
          <button
            type="button"
            className="secondary-btn cat-btn"
            disabled={desabilitado || ocupado}
            onClick={() => onEscolher(pai.id)}
          >
            Usar só {pai.nome}
          </button>
          {filhas.map((filha) => (
            <button
              key={filha.id}
              type="button"
              className="secondary-btn cat-btn"
              disabled={desabilitado || ocupado}
              onClick={() => onEscolher(filha.id)}
            >
              <span aria-hidden="true">{filha.emoji}</span> {filha.nome}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="link-btn"
          disabled={desabilitado || ocupado}
          onClick={() => {
            setCriando('filha')
            setPaiNova(pai.id)
          }}
        >
          + Subcategoria
        </button>
        {criando === 'filha' && (
          <FormNova
            titulo="Nova subcategoria"
            nome={nome}
            emoji={emoji}
            tipo={tipo}
            mostrarTipo={false}
            mostrarPai={false}
            pais={pais}
            paiNova={paiNova}
            ocupado={ocupado}
            erro={erro}
            onNome={setNome}
            onEmoji={setEmoji}
            onTipo={setTipo}
            onPai={setPaiNova}
            onCancelar={resetCriar}
            onSubmit={(e) => void criar(e)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="cat-grid">
        {pais.map((categoria) => (
          <button
            key={categoria.id}
            type="button"
            className="secondary-btn cat-btn"
            disabled={desabilitado || ocupado}
            onClick={() => tocarPai(categoria.id)}
          >
            <span aria-hidden="true">{categoria.emoji}</span> {categoria.nome}
            {filhasDe(categorias, categoria.id).length > 0 ? ' ›' : ''}
          </button>
        ))}
      </div>
      {!criando ? (
        <div className="row-between">
          <button type="button" className="link-btn" disabled={desabilitado || ocupado} onClick={() => setCriando('raiz')}>
            + Nova categoria
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={desabilitado || ocupado || pais.length === 0}
            onClick={() => {
              setCriando('filha')
              setPaiNova(pais[0]?.id ?? '')
            }}
          >
            + Subcategoria
          </button>
        </div>
      ) : (
        <FormNova
          titulo={criando === 'filha' ? 'Nova subcategoria' : 'Nova categoria'}
          nome={nome}
          emoji={emoji}
          tipo={tipo}
          mostrarTipo={criando === 'raiz'}
          mostrarPai={criando === 'filha'}
          pais={pais}
          paiNova={paiNova}
          ocupado={ocupado}
          erro={erro}
          onNome={setNome}
          onEmoji={setEmoji}
          onTipo={setTipo}
          onPai={setPaiNova}
          onCancelar={resetCriar}
          onSubmit={(e) => void criar(e)}
        />
      )}
    </div>
  )
}

function FormNova({
  titulo,
  nome,
  emoji,
  tipo,
  mostrarTipo,
  mostrarPai,
  pais,
  paiNova,
  ocupado,
  erro,
  onNome,
  onEmoji,
  onTipo,
  onPai,
  onCancelar,
  onSubmit,
}: {
  titulo: string
  nome: string
  emoji: string
  tipo: TipoCategoria
  mostrarTipo: boolean
  mostrarPai: boolean
  pais: readonly Categoria[]
  paiNova: string
  ocupado: boolean
  erro: string | null
  onNome: (v: string) => void
  onEmoji: (v: string) => void
  onTipo: (v: TipoCategoria) => void
  onPai: (v: string) => void
  onCancelar: () => void
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <form className="panel stack" onSubmit={onSubmit}>
      <h3 className="secao-titulo">{titulo}</h3>
      {mostrarPai && (
        <select value={paiNova} onChange={(e) => onPai(e.target.value)} disabled={ocupado} required>
          {pais.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.emoji} {categoria.nome}
            </option>
          ))}
        </select>
      )}
      <input placeholder="Nome" value={nome} onChange={(e) => onNome(e.target.value)} disabled={ocupado} autoFocus />
      <input placeholder="Emoji" value={emoji} onChange={(e) => onEmoji(e.target.value)} maxLength={4} disabled={ocupado} />
      {mostrarTipo && (
        <select value={tipo} onChange={(e) => onTipo(e.target.value as TipoCategoria)} disabled={ocupado}>
          <option value="semanal">Semanal, com teto</option>
          <option value="mensal">Mensal</option>
          <option value="investimento">Investimento</option>
          <option value="renda">Renda</option>
          <option value="ignorar">Ignorar</option>
        </select>
      )}
      {erro && <p className="error">{erro}</p>}
      <div className="row-between">
        <button type="button" className="secondary-btn" disabled={ocupado} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="primary-btn" disabled={ocupado || !nome.trim()}>
          {ocupado ? 'Criando…' : 'Criar e usar'}
        </button>
      </div>
    </form>
  )
}

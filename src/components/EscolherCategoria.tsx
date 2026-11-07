import { useState, type FormEvent } from 'react'
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
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [tipo, setTipo] = useState<TipoCategoria>('semanal')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const criar = async (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || ocupado || desabilitado) return
    setErro(null)
    setOcupado(true)
    const id = novoId()
    const ordem = Math.max(0, ...categorias.map((categoria) => categoria.ordem)) + 1
    try {
      await insertCategoria({
        id,
        nome: nome.trim(),
        emoji: emoji.trim() || '📌',
        cor: '#5a6b8c',
        tipo,
        tetoMensal: 0,
        arquivada: false,
        ordem,
      })
      setNome('')
      setEmoji('📌')
      setCriando(false)
      onEscolher(id)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui criar a categoria.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="stack">
      <div className="cat-grid">
        {categorias
          .filter((categoria) => !categoria.arquivada)
          .map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              className="secondary-btn cat-btn"
              disabled={desabilitado || ocupado}
              onClick={() => onEscolher(categoria.id)}
            >
              <span aria-hidden="true">{categoria.emoji}</span> {categoria.nome}
            </button>
          ))}
      </div>
      {!criando ? (
        <button
          type="button"
          className="link-btn"
          disabled={desabilitado || ocupado}
          onClick={() => setCriando(true)}
        >
          + Nova categoria
        </button>
      ) : (
        <form className="panel stack" onSubmit={(e) => void criar(e)}>
          <h3 className="secao-titulo">Nova categoria</h3>
          <input
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={ocupado}
            autoFocus
          />
          <input
            placeholder="Emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            disabled={ocupado}
          />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)} disabled={ocupado}>
            <option value="semanal">Semanal, com teto</option>
            <option value="mensal">Mensal</option>
            <option value="investimento">Investimento</option>
            <option value="renda">Renda</option>
            <option value="ignorar">Ignorar</option>
          </select>
          {erro && <p className="error">{erro}</p>}
          <div className="row-between">
            <button type="button" className="secondary-btn" disabled={ocupado} onClick={() => setCriando(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-btn" disabled={ocupado || !nome.trim()}>
              {ocupado ? 'Criando…' : 'Criar e usar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

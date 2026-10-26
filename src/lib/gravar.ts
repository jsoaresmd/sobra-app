import { db, novoId } from './db'
import { importarCsv, type ResumoImportacao } from './importarCsv'
import { chaveEstabelecimento } from './merchant'
import type { Compromisso, Lancamento } from './types'

export type ResumoGravado = ResumoImportacao & {
  tipo: 'cartao' | 'conta'
  arquivo: string
}

export async function gravarCsv(texto: string, arquivo: string): Promise<ResumoGravado> {
  const config = await db.config.get('app')
  const [estabelecimentos, lancamentosAtuais, compromissosAtuais] = await Promise.all([
    db.estabelecimentos.toArray(),
    db.lancamentos.toArray(),
    db.compromissos.toArray(),
  ])
  const resultado = importarCsv(texto, {
    chavesExistentes: lancamentosAtuais.map((linha) => linha.chaveDedup),
    regras: estabelecimentos.map((item) => ({
      chaveNormalizada: item.chaveNormalizada,
      categoriaId: item.categoriaId,
    })),
    nomesTitular: config?.nomesTitular,
  })

  const porVinculo = new Map(
    compromissosAtuais.filter((item) => item.chaveVinculo).map((item) => [item.chaveVinculo as string, item]),
  )
  const porChave = new Map(estabelecimentos.map((item) => [item.chaveNormalizada, item]))
  const agora = new Date().toISOString()
  const novos: Lancamento[] = []

  await db.transaction('rw', [db.lancamentos, db.estabelecimentos, db.compromissos, db.importacoes], async () => {
    for (const rascunho of resultado.compromissos) {
      const existente = porVinculo.get(rascunho.chaveVinculo)
      if (existente) {
        const mudanca: Partial<Compromisso> = {
          valor: rascunho.valor,
          parcelaAtual: rascunho.parcelaAtual ?? existente.parcelaAtual,
          parcelasTotal: rascunho.parcelasTotal ?? existente.parcelasTotal,
          mesFinal: rascunho.mesFinal ?? existente.mesFinal,
          categoriaId: existente.categoriaId ?? rascunho.categoriaId,
        }
        await db.compromissos.update(existente.id, mudanca)
        Object.assign(existente, mudanca)
      } else {
        const criado: Compromisso = {
          id: novoId(),
          nome: rascunho.nome,
          apelido: '',
          tipo: rascunho.tipo,
          valor: rascunho.valor,
          dia: rascunho.dia,
          parcelaAtual: rascunho.parcelaAtual,
          parcelasTotal: rascunho.parcelasTotal,
          mesFinal: rascunho.mesFinal,
          categoriaId: rascunho.categoriaId,
          divida: false,
          forma: 'cartao',
          chaveVinculo: rascunho.chaveVinculo,
        }
        await db.compromissos.add(criado)
        porVinculo.set(rascunho.chaveVinculo, criado)
      }
    }

    for (const linha of resultado.lancamentos) {
      let estab = porChave.get(linha.estabelecimentoChave)
      if (!estab) {
        estab = {
          id: novoId(),
          chaveNormalizada: linha.estabelecimentoChave,
          textoOriginal: linha.textoEstabelecimento || linha.descricaoOriginal,
          apelido: '',
          nota: '',
          categoriaId: linha.categoriaId,
        }
        await db.estabelecimentos.add(estab)
        porChave.set(estab.chaveNormalizada, estab)
      }
      const categoriaId = estab.categoriaId ?? linha.categoriaId
      const compromisso =
        (linha.chaveCompromisso ? porVinculo.get(linha.chaveCompromisso) : undefined) ??
        (estab.compromissoId ? compromissosAtuais.find((item) => item.id === estab?.compromissoId) : undefined)
      const lancamento: Lancamento = {
        id: novoId(),
        origem: linha.origem,
        data: linha.data,
        valor: linha.valor,
        sinal: linha.sinal,
        descricaoOriginal: linha.descricaoOriginal,
        estabelecimentoChave: linha.estabelecimentoChave,
        categoriaId,
        chaveDedup: linha.chaveDedup,
        importadoEm: agora,
        compromissoId: compromisso?.id ?? null,
      }
      if (linha.parcelaAtual) lancamento.parcelaAtual = linha.parcelaAtual
      if (linha.parcelasTotal) lancamento.parcelasTotal = linha.parcelasTotal
      if (linha.idBanco) lancamento.idBanco = linha.idBanco
      if (linha.confirmarEntrada && !estab.categoriaId) lancamento.confirmarEntrada = true
      novos.push(lancamento)

      if (compromisso?.divida && compromisso.saldoDevedor != null && linha.sinal === 'saida') {
        const saldoDevedor = Math.max(0, compromisso.saldoDevedor - linha.valor)
        const parcelasRestantes =
          compromisso.parcelasRestantes == null ? undefined : Math.max(0, compromisso.parcelasRestantes - 1)
        await db.compromissos.update(compromisso.id, {
          saldoDevedor,
          ...(parcelasRestantes == null ? {} : { parcelasRestantes }),
        })
        compromisso.saldoDevedor = saldoDevedor
        if (parcelasRestantes != null) compromisso.parcelasRestantes = parcelasRestantes
      }
    }

    if (novos.length) await db.lancamentos.bulkAdd(novos)
    await db.importacoes.add({
      id: novoId(),
      arquivo,
      tipo: resultado.tipo,
      data: agora,
      novos: resultado.resumo.novos,
      jaExistiam: resultado.resumo.jaExistiam,
      ignorados: resultado.resumo.ignorados,
      semCategoria: resultado.resumo.semCategoria,
    })
  })

  return { ...resultado.resumo, tipo: resultado.tipo, arquivo }
}

export async function classificarEstabelecimento(chave: string, categoriaId: string, apelido?: string) {
  const estab = await db.estabelecimentos.where('chaveNormalizada').equals(chave).first()
  if (estab) {
    await db.estabelecimentos.update(estab.id, {
      categoriaId,
      ...(apelido == null ? {} : { apelido }),
    })
  } else {
    await db.estabelecimentos.add({
      id: novoId(),
      chaveNormalizada: chave,
      textoOriginal: chave,
      apelido: apelido ?? '',
      nota: '',
      categoriaId,
    })
  }
  const linhas = await db.lancamentos.where('estabelecimentoChave').equals(chave).toArray()
  await Promise.all(
    linhas.map((linha) => db.lancamentos.update(linha.id, { categoriaId, confirmarEntrada: false })),
  )
  const compromissos = new Set(linhas.map((linha) => linha.compromissoId).filter((id): id is string => !!id))
  for (const id of compromissos) {
    const compromisso = await db.compromissos.get(id)
    if (!compromisso) continue
    await db.compromissos.update(id, {
      categoriaId: compromisso.categoriaId ?? categoriaId,
      ...(apelido && !compromisso.apelido ? { apelido } : {}),
    })
  }
}

export async function confirmarEntrada(id: string, categoriaId: string) {
  const linha = await db.lancamentos.get(id)
  if (!linha) return
  await db.lancamentos.update(id, { categoriaId, confirmarEntrada: false, sinal: 'entrada' })
  const estab = await db.estabelecimentos.where('chaveNormalizada').equals(linha.estabelecimentoChave).first()
  if (estab && !estab.categoriaId) await db.estabelecimentos.update(estab.id, { categoriaId })
}

export async function salvarManual(entrada: {
  id?: string
  tipo: 'gasto' | 'entrada' | 'aporte'
  valor: number
  data: string
  descricao: string
  categoriaId?: string | null
}) {
  const id = entrada.id ?? novoId()
  const aporte = entrada.tipo === 'aporte'
  const sinal = entrada.tipo === 'entrada' ? 'entrada' : 'saida'
  const categoriaId = aporte ? 'cat-investimento' : (entrada.categoriaId ?? null)
  const descricao = entrada.descricao.trim() || (aporte ? 'Aporte' : entrada.tipo === 'entrada' ? 'Entrada' : 'Dinheiro')
  const lancamento: Lancamento = {
    id,
    origem: 'manual',
    data: entrada.data,
    valor: entrada.valor,
    sinal,
    descricaoOriginal: descricao,
    estabelecimentoChave: chaveEstabelecimento(descricao),
    categoriaId,
    chaveDedup: `manual|${id}`,
    importadoEm: new Date().toISOString(),
  }
  await db.lancamentos.put(lancamento)
  return id
}

export async function apagarManual(id: string) {
  const linha = await db.lancamentos.get(id)
  if (linha?.origem === 'manual') await db.lancamentos.delete(id)
}

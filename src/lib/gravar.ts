import { novoId } from './ids'
import { importarCsv, type ResumoImportacao } from './importarCsv'
import { chaveEstabelecimento } from './merchant'
import { avisarMudanca, semAvisar } from './mudanca'
import {
  buscarCompromisso,
  buscarEstabelecimentoPorChave,
  buscarLancamento,
  insertImportacao,
  listarLancamentosPorEstabelecimento,
  updateCompromisso,
  updateEstabelecimento,
  updateLancamento,
  updateLancamentosPorEstabelecimento,
  upsertCompromissos,
  upsertEstabelecimentos,
  upsertLancamentos,
  deleteLancamento,
  carregarTudo,
} from './repo'
import type { Compromisso, Lancamento } from './types'

export type ResumoGravado = ResumoImportacao & {
  tipo: 'cartao' | 'conta'
  arquivo: string
}

export async function gravarCsv(texto: string, arquivo: string): Promise<ResumoGravado> {
  return semAvisar(async () => {
    const pacote = await carregarTudo()
    const config = pacote.config
    const estabelecimentos = pacote.estabelecimentos
    const lancamentosAtuais = pacote.lancamentos
    const compromissosAtuais = [...pacote.compromissos]

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
    const estabsNovos: typeof estabelecimentos = []
    const compromissosNovos: Compromisso[] = []
    const compromissosUpdate: Compromisso[] = []

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
        Object.assign(existente, mudanca)
        compromissosUpdate.push(existente)
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
        compromissosNovos.push(criado)
        compromissosAtuais.push(criado)
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
        estabsNovos.push(estab)
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
        compromisso.saldoDevedor = saldoDevedor
        if (parcelasRestantes != null) compromisso.parcelasRestantes = parcelasRestantes
        if (!compromissosUpdate.includes(compromisso) && !compromissosNovos.includes(compromisso)) {
          compromissosUpdate.push(compromisso)
        }
      }
    }

    if (compromissosNovos.length) await upsertCompromissos(compromissosNovos)
    if (compromissosUpdate.length) await upsertCompromissos(compromissosUpdate)
    if (estabsNovos.length) await upsertEstabelecimentos(estabsNovos)
    if (novos.length) await upsertLancamentos(novos)
    await insertImportacao({
      id: novoId(),
      arquivo,
      tipo: resultado.tipo,
      data: agora,
      novos: resultado.resumo.novos,
      jaExistiam: resultado.resumo.jaExistiam,
      ignorados: resultado.resumo.ignorados,
      semCategoria: resultado.resumo.semCategoria,
    })
    avisarMudanca()

    return { ...resultado.resumo, tipo: resultado.tipo, arquivo }
  })
}

export async function classificarEstabelecimento(chave: string, categoriaId: string, apelido?: string) {
  if (!chave || !categoriaId) throw new Error('Faltou estabelecimento ou categoria.')

  const apelidoLimpo = apelido?.trim()
  const estab = await buscarEstabelecimentoPorChave(chave)

  if (estab) {
    await updateEstabelecimento(estab.id, {
      categoriaId,
      ...(apelidoLimpo ? { apelido: apelidoLimpo } : {}),
    })
  } else {
    await upsertEstabelecimentos([
      {
        id: novoId(),
        chaveNormalizada: chave,
        textoOriginal: chave,
        apelido: apelidoLimpo ?? '',
        nota: '',
        categoriaId,
      },
    ])
  }

  await updateLancamentosPorEstabelecimento(chave, {
    categoriaId,
    confirmarEntrada: false,
  })

  const vinculos = await listarLancamentosPorEstabelecimento(chave)
  const ids = new Set(vinculos.map((linha) => linha.compromissoId).filter((id): id is string => !!id))
  for (const id of ids) {
    const compromisso = await buscarCompromisso(id)
    if (!compromisso) continue
    await updateCompromisso(id, {
      categoriaId: compromisso.categoriaId ?? categoriaId,
      ...(apelidoLimpo && !compromisso.apelido ? { apelido: apelidoLimpo } : {}),
    })
  }
  avisarMudanca()
}

export async function confirmarEntrada(id: string, categoriaId: string) {
  if (!id || !categoriaId) throw new Error('Faltou lançamento ou categoria.')

  const linha = await buscarLancamento(id)
  if (!linha) return
  await updateLancamento(id, { categoriaId, confirmarEntrada: false, sinal: 'entrada' })
  const estab = await buscarEstabelecimentoPorChave(linha.estabelecimentoChave)
  if (estab) await updateEstabelecimento(estab.id, { categoriaId })
  avisarMudanca()
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
  await upsertLancamentos([lancamento])
  return id
}

export async function apagarManual(id: string) {
  const linha = await buscarLancamento(id)
  if (linha?.origem === 'manual') await deleteLancamento(id)
}

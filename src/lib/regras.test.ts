import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { faltaPagar, previsaoTermino } from './compromissos'
import { avaliarMeta, METAS_SEED } from './metas'
import { resumoDoMes } from './mesResumo'
import { gastoCreditoNoMes, planoDoMes, planoPadrao } from './planoMes'
import { semanasPendentes } from './semana'
import { placarDaSemana, tetoBase } from './tetos'
import type { Categoria, Compromisso, Lancamento, MetaModelo } from './types'

const mercado: Categoria = {
  id: 'cat-mercado',
  nome: 'Mercado',
  emoji: '🛒',
  cor: '#000',
  tipo: 'semanal',
  tetoMensal: 866,
  arquivada: false,
  ordem: 1,
}

function gasto(parcial: Partial<Lancamento> & Pick<Lancamento, 'data' | 'valor'>): Lancamento {
  return {
    id: parcial.id ?? parcial.data + parcial.valor,
    origem: 'cartao',
    sinal: 'saida',
    descricaoOriginal: 'Loja',
    estabelecimentoChave: 'loja',
    categoriaId: 'cat-mercado',
    chaveDedup: 'k',
    importadoEm: '2026-10-22',
    ...parcial,
  }
}

describe('tetos', () => {
  it('arredonda o teto semanal', () => {
    assert.equal(tetoBase(866), 200)
    assert.equal(tetoBase(0), 0)
  })

  it('não acumula sobra e desconta o estouro nas semanas seguintes', () => {
    const linhas = [
      gasto({ data: '2026-10-05', valor: 50 }),
      gasto({ data: '2026-10-12', valor: 280 }),
      gasto({ data: '2026-10-19', valor: 500 }),
      gasto({ data: '2026-10-26', valor: 0, id: 'zero' }),
    ]
    const semanaCheia = placarDaSemana([mercado], linhas, '2026-10-11')
    assert.equal(semanaCheia[0]?.teto, 200)
    assert.equal(semanaCheia[0]?.gasto, 280)
    assert.equal(semanaCheia[0]?.desconto, 0)
    assert.equal(semanaCheia[0]?.sobra, -80)

    const depois = placarDaSemana([mercado], linhas, '2026-10-18')
    assert.equal(depois[0]?.desconto, 80)
    assert.equal(depois[0]?.teto, 120)

    const negativa = placarDaSemana([mercado], linhas, '2026-10-25')
    assert.equal(negativa[0]?.teto, 200 - (500 - 120))
    assert.equal(negativa[0]?.desconto, 380)
  })

  it('ignora parcela no teto semanal', () => {
    const linhas = [gasto({ data: '2026-10-12', valor: 300, compromissoId: 'parcela' })]
    const placar = placarDaSemana([mercado], linhas, '2026-10-11')
    assert.equal(placar[0]?.gasto, 0)
  })
})

describe('mês, metas e compromissos', () => {
  it('calcula a sobra do mês', () => {
    const categorias: Categoria[] = [
      mercado,
      { ...mercado, id: 'cat-moradia', nome: 'Moradia', tipo: 'mensal', tetoMensal: 0 },
      { ...mercado, id: 'cat-renda', nome: 'Renda', tipo: 'renda', tetoMensal: 0 },
      { ...mercado, id: 'cat-investimento', nome: 'Guardado', tipo: 'investimento', tetoMensal: 0 },
    ]
    const compromisso: Compromisso = {
      id: 'aluguel',
      nome: 'Aluguel',
      apelido: '',
      tipo: 'fixo',
      valor: 100,
      categoriaId: 'cat-moradia',
      divida: false,
    }
    const lancamentos = [
      gasto({ data: '2026-10-12', valor: 200 }),
      gasto({ data: '2026-10-03', valor: 50, categoriaId: 'cat-moradia', compromissoId: 'aluguel' }),
      gasto({ data: '2026-10-02', valor: 80, categoriaId: 'cat-renda', sinal: 'entrada' }),
      gasto({ data: '2026-10-20', valor: 40, categoriaId: 'cat-investimento' }),
    ]
    const resumo = resumoDoMes('2026-10', categorias, lancamentos, [compromisso], 1000, {
      modo: 'guardar',
      metaGuardar: 300,
      tetoCredito: 0,
    })
    assert.equal(resumo.renda, 1080)
    assert.equal(resumo.compromissos, 100)
    assert.equal(resumo.semanal, 200)
    assert.equal(resumo.mensais, 0)
    assert.equal(resumo.sobra, 780)
    assert.equal(resumo.guardado, 40)
    assert.equal(resumo.modo, 'guardar')
    assert.equal(resumo.meta, 300)
  })

  it('soma o crédito do mês e ignora Ignorar', () => {
    const linhas = [
      gasto({ data: '2026-10-05', valor: 100 }),
      gasto({ data: '2026-10-06', valor: 50, categoriaId: 'cat-ignorar' }),
      gasto({ data: '2026-10-07', valor: 20, sinal: 'entrada' }),
      gasto({ data: '2026-10-08', valor: 30, origem: 'conta' }),
      gasto({ data: '2026-11-01', valor: 999 }),
    ]
    assert.equal(gastoCreditoNoMes(linhas, '2026-10'), 80)
    const resumo = resumoDoMes(
      '2026-10',
      [mercado],
      linhas,
      [],
      0,
      { modo: 'sair-atraso', metaGuardar: 0, tetoCredito: 200, faturaAPagar: 15000 },
    )
    assert.equal(resumo.modo, 'sair-atraso')
    assert.equal(resumo.creditoGasto, 80)
    assert.equal(resumo.tetoCredito, 200)
    assert.equal(resumo.creditoSobra, 120)
    assert.equal(resumo.faturaAPagar, 15000)
  })

  it('usa o padrão de Ajustes quando o mês ainda não tem plano', () => {
    const padrao = planoPadrao('2026-11', { metaGuardarMes: 500 })
    assert.equal(padrao.modo, 'guardar')
    assert.equal(padrao.metaGuardar, 500)
    assert.equal(planoDoMes([], '2026-11', { metaGuardarMes: 500 }).metaGuardar, 500)
    assert.equal(
      planoDoMes([{ id: '2026-11', mes: '2026-11', modo: 'sair-atraso', metaGuardar: 0, tetoCredito: 12000, notas: '' }], '2026-11')
        .tetoCredito,
      12000,
    )
  })

  it('avalia iFood e parcela nova', () => {
    const ifood = METAS_SEED.find((meta) => meta.id === 'meta-ifood') as MetaModelo
    const parcela = METAS_SEED.find((meta) => meta.id === 'meta-parcela') as MetaModelo
    const linhas = [
      gasto({
        data: '2026-10-12',
        valor: 30,
        descricaoOriginal: 'Ifd*Padaria',
        estabelecimentoChave: 'padaria',
        categoriaId: 'cat-restaurante',
      }),
      gasto({ data: '2026-10-13', valor: 100, parcelaAtual: 1, parcelasTotal: 2 }),
    ]
    assert.equal(avaliarMeta(ifood, undefined, '2026-10-11', linhas).cumprida, false)
    assert.equal(avaliarMeta(parcela, undefined, '2026-10-11', linhas).cumprida, false)
    assert.equal(avaliarMeta(ifood, undefined, '2026-10-18', linhas).cumprida, true)
  })

  it('mostra quanto falta do parcelamento e se a dívida quita', () => {
    const parcela: Compromisso = {
      id: '1',
      nome: 'Geladeira',
      apelido: '',
      tipo: 'parcelado',
      valor: 100,
      parcelaAtual: 5,
      parcelasTotal: 12,
      categoriaId: null,
      divida: false,
    }
    assert.equal(faltaPagar(parcela), 800)
    const divida: Compromisso = {
      id: '2',
      nome: 'Empréstimo',
      apelido: '',
      tipo: 'financiamento',
      valor: 10,
      categoriaId: null,
      divida: true,
      saldoDevedor: 200,
      jurosMes: 10,
    }
    assert.equal(previsaoTermino(divida)?.quita, false)
  })

  it('pula a semana que já foi fechada', () => {
    const pendentes = semanasPendentes(
      [{ semanaInicio: '2026-10-04' }],
      [{ data: '2026-10-05' }, { data: '2026-10-22' }],
      '2026-10-22',
    )
    assert.deepEqual(pendentes, ['2026-10-11', '2026-10-18'])
  })
})

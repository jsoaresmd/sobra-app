import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chaveEstabelecimento } from './merchant'
import { naSemana } from './semana'
import {
  centavosCartao,
  centavosConta,
  importarCsv,
  nomeDaConta,
  selecionarNovos,
  type RascunhoLancamento,
} from './importarCsv'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../..')
const cartao = readFileSync(join(raiz, 'nu-extratos/Nubank_2026-11-11.csv'), 'utf8')
const conta = readFileSync(join(raiz, 'nu-extratos/NU_641048071_01OUT2026_21OUT2026.csv'), 'utf8')
const TITULAR = ['JAIRO ANDRE MEYER SOARES']

function cents(valor: number) {
  return Math.round(valor * 100)
}

function soma(linhas: RascunhoLancamento[]) {
  return linhas.reduce((total, linha) => total + cents(linha.valor), 0)
}

function sinalizado(linhas: RascunhoLancamento[]) {
  return linhas.reduce((total, linha) => {
    const valor = cents(linha.valor)
    return total + (linha.sinal === 'entrada' ? -valor : valor)
  }, 0)
}

describe('valores do Nubank', () => {
  it('lê o valor do cartão com milhar, vírgula e o espaço do negativo', () => {
    assert.equal(centavosCartao('1.341,00'), 134100)
    assert.equal(centavosCartao('5,99'), 599)
    assert.equal(centavosCartao('- 20.779,04'), -2077904)
  })

  it('lê o valor da conta com ponto decimal', () => {
    assert.equal(centavosConta('1300.00'), 130000)
    assert.equal(centavosConta('-20779.04'), -2077904)
    assert.equal(centavosConta('-3.51'), -351)
  })
})

describe('cartão Nubank_2026-11-11', () => {
  const resultado = importarCsv(cartao)

  it('tem 96 lançamentos e a soma das despesas sem o pagamento é R$ 14.019,28', () => {
    assert.equal(resultado.tipo, 'cartao')
    assert.equal(resultado.lancamentos.length, 96)
    const semPagamento = resultado.lancamentos.filter((linha) => linha.descricaoOriginal !== 'Pagamento recebido')
    assert.equal(sinalizado(semPagamento), 1401928)
  })

  it('manda as parcelas para compromissos, somando R$ 3.279,52', () => {
    const parcelas = resultado.lancamentos.filter((linha) => linha.parcelaAtual)
    assert.equal(soma(parcelas), 327952)
    assert.ok(parcelas.every((linha) => linha.chaveCompromisso))
    const compromissos = resultado.compromissos.filter((item) => item.tipo === 'parcelado')
    assert.equal(compromissos.reduce((total, item) => total + cents(item.valor), 0), 327952)
  })

  it('manda os boletos para compromissos: Aymoré 2.301,19 e Sacara 1.675,46', () => {
    const boletos = resultado.lancamentos.filter((linha) => /boleto no cr[eé]dito/i.test(linha.descricaoOriginal))
    assert.equal(soma(boletos), 397665)
    const aymore = boletos.find((linha) => /aymore/i.test(linha.descricaoOriginal))
    const sacara = boletos.find((linha) => /sacara/i.test(linha.descricaoOriginal))
    assert.equal(cents(aymore?.valor ?? 0), 230119)
    assert.equal(cents(sacara?.valor ?? 0), 167546)
    assert.equal(aymore?.categoriaId, 'cat-financiamento')
    assert.equal(sacara?.categoriaId, 'cat-moradia')
    assert.equal(resultado.compromissos.find((item) => /aymore/i.test(item.nome))?.tipo, 'financiamento')
    assert.equal(resultado.compromissos.find((item) => /sacara/i.test(item.nome))?.tipo, 'fixo')
  })

  it('soma Gigante e Klechewsk na semana de 11 a 17/10/2026 em R$ 476,49', () => {
    const mercado = resultado.lancamentos.filter(
      (linha) => linha.categoriaId === 'cat-mercado' && naSemana(linha.data, '2026-10-11'),
    )
    assert.equal(soma(mercado), 47649)
    assert.deepEqual(
      mercado.map((linha) => linha.data).sort(),
      ['2026-10-12', '2026-10-14', '2026-10-16'],
    )
  })

  it('ignora o pagamento e os pares de IOF', () => {
    const pagamento = resultado.lancamentos.find((linha) => linha.descricaoOriginal === 'Pagamento recebido')
    assert.equal(pagamento?.categoriaId, 'cat-ignorar')
    assert.equal(cents(pagamento?.valor ?? 0), 2077904)
    const iof = resultado.lancamentos.filter((linha) => /iof de /i.test(linha.descricaoOriginal))
    assert.equal(iof.length, 4)
    assert.ok(iof.every((linha) => linha.categoriaId === 'cat-ignorar'))
  })

  it('sobe o mesmo arquivo duas vezes sem lançamento novo e mantém as duas lavanderias', () => {
    const lavanderias = resultado.lancamentos.filter(
      (linha) =>
        linha.descricaoOriginal === 'Lavanderia' &&
        linha.data === '2026-10-05' &&
        cents(linha.valor) === 1590,
    )
    assert.equal(lavanderias.length, 2)
    assert.equal(lavanderias[0]?.chaveDedup, lavanderias[1]?.chaveDedup)
    const deNovo = importarCsv(cartao, {
      chavesExistentes: resultado.lancamentos.map((linha) => linha.chaveDedup),
    })
    assert.equal(deNovo.lancamentos.length, 0)
    assert.equal(deNovo.resumo.novos, 0)
    assert.equal(deNovo.resumo.ignorados, 0)
    assert.equal(deNovo.resumo.jaExistiam, 96)
    assert.equal(deNovo.compromissos.length, 0)
  })

  it('importa só as linhas novas quando o CSV do cartão traz dias a mais', () => {
    const maior = `${cartao.trim()}\n2026-10-23,Padaria do Bairro,"12,50"\n`
    const deNovo = importarCsv(maior, {
      chavesExistentes: resultado.lancamentos.map((linha) => linha.chaveDedup),
    })
    assert.equal(deNovo.lancamentos.length, 1)
    assert.equal(deNovo.lancamentos[0]?.data, '2026-10-23')
    assert.equal(deNovo.resumo.novos, 1)
    assert.equal(deNovo.resumo.jaExistiam, 96)
  })
})

describe('conta NU_641048071_01OUT2026_21OUT2026', () => {
  const resultado = importarCsv(conta, { nomesTitular: TITULAR })

  it('ignora o pagamento da fatura e as transferências do titular', () => {
    const fatura = resultado.lancamentos.find((linha) => linha.descricaoOriginal === 'Pagamento de fatura')
    assert.equal(fatura?.categoriaId, 'cat-ignorar')
    assert.equal(cents(fatura?.valor ?? 0), 2077904)
    const doTitular = resultado.lancamentos.filter((linha) => /jairo andre meyer soares/i.test(linha.descricaoOriginal))
    assert.equal(doTitular.length, 2)
    assert.ok(doTitular.every((linha) => linha.categoriaId === 'cat-ignorar'))
    assert.equal(resultado.resumo.ignorados, 3)
    assert.equal(resultado.lancamentos.length, 18)
  })

  it('extrai o estabelecimento e pergunta quando a entrada não é do titular', () => {
    assert.equal(
      nomeDaConta('Pagamento de boleto efetuado - DIRECT WIFI TELECOM LTDA EPP'),
      'DIRECT WIFI TELECOM LTDA EPP',
    )
    assert.equal(
      nomeDaConta(
        'Transferência enviada pelo Pix - CRISTIANE FABIENSKI DE CAMARGO - •••.562.709-•• - ITAÚ UNIBANCO S.A. Agência: 2929 Conta: 25217-5',
      ),
      'CRISTIANE FABIENSKI DE CAMARGO',
    )
    assert.equal(nomeDaConta('Compra no débito - 99* POP 15Out 18h36min'), '99* POP 15Out 18h36min')
    const entrada = resultado.lancamentos.find((linha) => /leonardo caio langrafe/i.test(linha.descricaoOriginal))
    assert.equal(entrada?.categoriaId, 'cat-renda')
    assert.equal(entrada?.confirmarEntrada, true)
    assert.equal(entrada?.sinal, 'entrada')
  })

  it('não ignora o titular se o nome configurado for outro', () => {
    const semNome = importarCsv(conta, { nomesTitular: ['OUTRA PESSOA'] })
    const doTitular = semNome.lancamentos.filter((linha) => /jairo andre meyer soares/i.test(linha.descricaoOriginal))
    assert.ok(doTitular.every((linha) => linha.categoriaId === 'cat-renda'))
  })
})

describe('chave e deduplicação', () => {
  it('junta o mesmo estabelecimento escrito de jeitos diferentes', () => {
    assert.equal(chaveEstabelecimento('Mp *Patyy'), chaveEstabelecimento('MP *PATYY'))
    assert.equal(chaveEstabelecimento('Ifd*58454681 Tatiane D'), 'tatiane d')
    assert.equal(chaveEstabelecimento('54481847 Sandra Aparec'), 'sandra aparec')
    assert.equal(chaveEstabelecimento('Dl *Uberrides'), 'uberrides')
    assert.equal(chaveEstabelecimento('NuTag*AZB8I77'), 'nutag')
    assert.equal(chaveEstabelecimento('Htm*Action Criacao Dig - Parcela 5/12'), 'action criacao dig')
    assert.equal(chaveEstabelecimento('Jim.Com* Sergio Rober'), 'sergio rober')
  })

  it('importa só as ocorrências que ainda não estão no banco', () => {
    const linhas = [{ chaveDedup: 'a' }, { chaveDedup: 'a' }, { chaveDedup: 'b' }]
    assert.deepEqual(
      selecionarNovos(linhas, ['a']).map((linha) => linha.chaveDedup),
      ['a', 'b'],
    )
    assert.equal(selecionarNovos(linhas, ['a', 'a', 'b']).length, 0)
  })

  it('a regra aprendida ganha da palavra-chave', () => {
    const texto = 'date,title,amount\n2026-10-14,Gigante Atacadista,"10,00"\n'
    const resultado = importarCsv(texto, {
      regras: [{ chaveNormalizada: 'gigante atacadista', categoriaId: 'cat-lazer' }],
    })
    assert.equal(resultado.lancamentos[0]?.categoriaId, 'cat-lazer')
  })
})

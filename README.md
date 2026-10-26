# Sobra

Revisão de sábado do casal. Uma vez por semana sobe o CSV do cartão e o da conta do Nubank, classifica o que ainda não tem categoria e vê a semana contra os tetos e as metas.

Os dados ficam só neste celular. Não tem login, não tem servidor e não mostra fatura, limite nem saldo — o app do Nubank já faz isso.

## Como usar

1. Abra **Revisar** e suba os dois CSVs (pode ser junto).
2. Classifique só o que está sem categoria. A escolha vale para o mesmo estabelecimento nas próximas vezes. Dá para pôr um apelido.
3. Lance o que não passa no Nubank: dinheiro vivo, entrada em dinheiro, aporte.
4. Veja o placar, as metas, o comparativo e os cortes.
5. Escolha as metas da próxima semana e feche. Exporte um backup no fim.

A semana vai de domingo a sábado. Parcela e boleto no crédito não entram no teto da semana: vão para **Compromissos**, na tela Mês.

O teto da semana é o teto do mês × 12 ÷ 52. O que sobra não passa para a semana seguinte. O que estoura desconta, e o saldo negativo continua nas semanas seguintes até zerar.

## Telas

- **Semana** — placar da semana atual. Toque numa categoria para ver os lançamentos e trocar a categoria.
- **Revisar** — o assistente e o histórico. Uma revisão fechada pode ser reaberta.
- **Mês** — renda (fixa + extras) − compromissos − gasto semanal − outras contas do mês. Compara com a meta de guardar e mostra o que foi para investimento. Também ficam os compromissos, as dívidas e quando cada parcelamento acaba.
- **Ajustes** — categorias e tetos, estabelecimentos (apelido, nota, regra), metas, renda, nomes do titular, backup e apagar tudo.

Lançamento importado não muda valor nem data. Lançamento manual pode ser editado e apagado.

## No computador

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

- `npm test` — parsers, deduplicação, teto e metas
- `npm run lint`
- `npm run build` — sai em `dist/`

Os CSVs de exemplo usados nos testes ficam em `nu-extratos/` (essa pasta não vai para o git).

O deploy é no Netlify, pela branch `main`. No celular, abra o site no Chrome e use **Adicionar à tela inicial**.

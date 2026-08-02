# Sobra

App de controle de gastos que responde a pergunta que os outros não respondem: **quanto ainda dá para gastar até o fim do mês?**

Funciona como PWA — instala na tela inicial do Android. Os dados ficam no aparelho (IndexedDB). O fluxo principal é **automático via Open Finance** (Pluggy / Meu Pluggy): o app puxa débito e crédito e encaixa nos envelopes. Lançamento manual existe só para corrigir.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

Para testar as funções Open Finance localmente (precisa das chaves Pluggy):

```bash
npx netlify dev
```

Outros comandos:

- `npm run build` — gera a versão de produção em `dist/`
- `npm run preview` — serve o `dist/` para testar o PWA
- `npm run lint` — roda o oxlint
- `npm run icons` — regenera os ícones a partir de `public/favicon.svg`

## Publicar e instalar no celular

O deploy é no Netlify: `npm run build` e publique a pasta `dist/`. O `netlify.toml` já traz SPA + `/api/*` → funções serverless.

No Netlify, em **Site settings → Environment variables**, configure:

- `PLUGGY_CLIENT_ID`
- `PLUGGY_CLIENT_SECRET`

(nunca com prefixo `VITE_` — a secret fica só no servidor). Há um `.env.example` na raiz.

No celular, abra o endereço no Chrome e use **Adicionar à tela inicial**.

## Open Finance (caminho principal)

1. Conta no [Meu Pluggy](https://meu.pluggy.ai) e conexão com o Nubank
2. App em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) — anote Client ID e Secret
3. Variáveis no Netlify (acima) e conector **MeuPluggy** habilitado no dashboard
4. No app: **Ajustes → Bancos** (ou o botão na tela Hoje) → Conectar → Sincronizar

Crédito e débito viram contas locais; compras novas viram lançamentos e descontam o envelope quando já houver etiqueta aprendida. Sem etiqueta, aparecem no extrato para você marcar uma vez — daí em diante o estabelecimento cai sozinho.

Enquanto as chaves não estiverem no Netlify, use **Ajustes → Importar fatura Nubank** (CSV/PDF) como ponte: mesma lógica de etiquetas.

## O problema que o app resolve

Com quase tudo no cartão, o saldo do banco mente. Uma compra feita hoje só vira dinheiro de verdade na data do vencimento, às vezes 37 dias depois. O envelope de papel funcionava porque o dinheiro saía na hora.

Por isso o app tem dois números no topo da tela:

**Dinheiro de verdade** — o que sobra em conta depois de tirar tudo que já tem dono até a próxima renda entrar:

```
Sobra real = saldo em conta
           − faturas que vencem antes do próximo salário
           − contas fixas em débito ainda não pagas
```

**Teto da fatura** — quanto a fatura em formação pode custar sem apertar o mês seguinte:

```
Teto = renda − contas pagas fora do cartão (dízimo, débito) − o que quer guardar
```

O termômetro mostra quanto ainda cabe na fatura, quantos dias faltam para ela fechar e quanto dá para gastar por dia até lá. É o freio que falta quando tudo passa no crédito.

Para não precisar cadastrar meses de histórico, em Ajustes → Contas dá para informar o valor da fatura conferido no app do banco. Ele vira o ponto de partida e só o que for lançado depois soma por cima.

## Importar fatura Nubank (ponte)

Em **Ajustes → Importar fatura Nubank**, envie o **CSV** (recomendado) ou o PDF da fatura. Útil até o Open Finance estar ligado, ou para um mês pontual.

Ao confirmar, duas coisas acontecem:

1. Os lançamentos entram no extrato e descontam do envelope
2. O estabelecimento fica etiquetado — na próxima fatura, “Mp *Patyy” ou “Gigante Atacadista” já caem no lugar certo

O botão **aplicar iguais** etiqueta de uma vez todas as ocorrências do mesmo estabelecimento naquela fatura.

Os PDFs em `nu-extratos/` ficam só na sua máquina (a pasta está no `.gitignore`).

## Envelopes

São o equivalente digital dos envelopes de papel.

- **Fixo** — valor certo (dízimo, internet, financiamento). No fim do ciclo o que sobrou zera.
- **Variável** — mercado, lazer, pets. O que sobrar no fim do ciclo vai para o envelope de **Investimentos**.
- **Investimento** — só recebe; acumula.

Fluxo do mês: defina os valores → toque em **Separar o dinheiro do mês** → cada gasto sai do envelope correspondente → se precisar, transfira entre envelopes.

## Como o cálculo funciona

O ciclo pode ser o mês civil ou começar no dia do salário (ajustável).

```
Teto do período  = renda mensal + entradas extras − quanto você quer guardar
Comprometido     = o que já saiu + o que ainda vai cair
Disponível       = teto − comprometido
Por dia          = disponível ÷ dias restantes
```

"O que ainda vai cair" é o que diferencia o app: junta as contas fixas do mês que ainda não foram pagas com as parcelas e lançamentos agendados que caem dentro do período.

A projeção separa o que é fixo do que é variável. Contas fixas e parcelas entram pelo valor cheio; o gasto do dia a dia é extrapolado pelo ritmo atual:

```
Projeção = fixos + parcelas + (gasto livre ÷ dias decorridos) × dias do período
```

Se a projeção passa do teto, o app avisa que o mês vai estourar antes que isso aconteça.

## Cartão de crédito

Cada cartão tem dia de fechamento e de vencimento, então o app sabe em qual fatura cada compra cai e mostra a fatura aberta, quando ela fecha e quanto já está comprometido nas próximas.

Compras parceladas viram vários lançamentos, um por mês, para que as parcelas futuras apareçam em "ainda vai cair".

## Backup

Em Ajustes → Backup dá para exportar um arquivo `.json` com tudo e restaurar depois. Como os dados vivem só no aparelho, vale exportar de tempos em tempos e guardar no Drive.

## Próximos passos

- Notificações quando o ritmo de gasto passar do limite
- Segundo aparelho para a esposa, com junção dos dois orçamentos
- Afinar direção crédito/débito e categorias da Pluggy após a primeira sync real

## Estrutura

```
src/
  lib/       modelo (Dexie), orçamento, faturas, Pluggy sync, backup
  contexts/  estado global
  components/casca do app
  pages/     Hoje, Envelopes, Extrato, Lançar, Ajustes, Bancos
netlify/functions/  token + sync Pluggy (secrets só no servidor)
```

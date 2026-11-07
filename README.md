# Sobra

Revisão de sábado do casal. Uma vez por semana sobe o CSV do cartão e o da conta do Nubank, classifica o que ainda não tem categoria e vê a semana contra os tetos e as metas.

Os dados ficam no Supabase (Postgres + Auth). Uma conta (e-mail/senha) nos dois celulares. Sem login o app não abre.

## Configuração

1. Crie o usuário no Supabase Auth (e-mail/senha) — uma conta para o casal.
2. Aplique a migração em `supabase/migrations/20261107120000_sobra_schema.sql` no SQL Editor do projeto `bnzeknsziulczlnqdzpd` (ou `supabase db push` com o projeto linkado).
3. Copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=https://bnzeknsziulczlnqdzpd.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

No Netlify, as mesmas variáveis em **Site settings → Environment variables**.

## Como usar

1. Entre com e-mail e senha.
2. Se ainda houver dados só no celular (versão antiga), em **Ajustes** use **Trazer dados deste celular**.
3. Abra **Revisar** e suba os dois CSVs.
4. Classifique o que está sem categoria, lance o que não passa no Nubank, feche a semana.

A semana vai de domingo a sábado. Parcela e boleto no crédito não entram no teto da semana: vão para **Compromissos**, na tela Mês.

## Telas

- **Semana** — placar da semana atual.
- **Revisar** — assistente e histórico.
- **Mês** — plano (guardar / sair do atraso), renda, compromissos e dívidas.
- **Ajustes** — categorias, estabelecimentos, metas, conta, backup e importação do celular.

## No computador

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

- `npm test` — parsers, deduplicação, teto e metas
- `npm run lint`
- `npm run build` — sai em `dist/`

Deploy no Netlify pela branch `main` do repo `jsoaresmd/sobra-app`. No celular, abra o site no Chrome e use **Adicionar à tela inicial**.

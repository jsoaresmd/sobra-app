-- Sobra: schema + RLS (uma conta / user_id = auth.uid())

create table public.config (
  user_id uuid primary key references auth.users (id) on delete cascade,
  renda numeric not null default 0,
  meta_guardar_mes numeric not null default 0,
  nomes_titular text[] not null default '{}',
  versao int not null default 2
);

create table public.categorias (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  emoji text not null default '📌',
  cor text not null default '#5a6b8c',
  tipo text not null,
  teto_mensal numeric not null default 0,
  arquivada boolean not null default false,
  ordem int not null default 0
);
create index categorias_user_ordem on public.categorias (user_id, ordem);

create table public.estabelecimentos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  chave_normalizada text not null,
  texto_original text not null default '',
  apelido text not null default '',
  nota text not null default '',
  categoria_id text,
  compromisso_id text,
  unique (user_id, chave_normalizada)
);
create index estabelecimentos_user on public.estabelecimentos (user_id);

create table public.compromissos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  apelido text not null default '',
  tipo text not null,
  valor numeric not null default 0,
  dia int,
  parcela_atual int,
  parcelas_total int,
  mes_final text,
  categoria_id text,
  divida boolean not null default false,
  saldo_devedor numeric,
  juros_mes numeric,
  parcelas_restantes int,
  forma text,
  chave_vinculo text
);
create index compromissos_user on public.compromissos (user_id);
create index compromissos_vinculo on public.compromissos (user_id, chave_vinculo);

create table public.lancamentos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  origem text not null,
  data text not null,
  valor numeric not null,
  sinal text not null,
  descricao_original text not null default '',
  estabelecimento_chave text not null default '',
  categoria_id text,
  parcela_atual int,
  parcelas_total int,
  compromisso_id text,
  chave_dedup text not null,
  importado_em text not null,
  id_banco text,
  confirmar_entrada boolean
);
create index lancamentos_user_data on public.lancamentos (user_id, data);
create index lancamentos_chave_dedup on public.lancamentos (user_id, chave_dedup);
create index lancamentos_estab on public.lancamentos (user_id, estabelecimento_chave);
create index lancamentos_compromisso on public.lancamentos (user_id, compromisso_id);

create table public.metas_modelo (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  tipo text not null,
  parametros jsonb not null default '{}',
  ativa_por_padrao boolean not null default false
);
create index metas_modelo_user on public.metas_modelo (user_id);

create table public.metas_semana (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  modelo_id text not null,
  semana text not null,
  ativa boolean not null default true,
  cumprida boolean,
  detalhe text
);
create index metas_semana_user_semana on public.metas_semana (user_id, semana);

create table public.revisoes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  semana_inicio text not null,
  fechada_em text not null,
  notas text not null default '',
  snapshot jsonb not null default '{}'
);
create index revisoes_user_semana on public.revisoes (user_id, semana_inicio);

create table public.importacoes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  arquivo text not null,
  tipo text not null,
  data text not null,
  novos int not null default 0,
  ja_existiam int not null default 0,
  ignorados int not null default 0,
  sem_categoria int not null default 0
);
create index importacoes_user on public.importacoes (user_id, data);

create table public.planos_mes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mes text not null,
  modo text not null,
  meta_guardar numeric not null default 0,
  teto_credito numeric not null default 0,
  fatura_a_pagar numeric,
  notas text not null default '',
  unique (user_id, mes)
);
create index planos_mes_user on public.planos_mes (user_id, mes);

-- RLS
alter table public.config enable row level security;
alter table public.categorias enable row level security;
alter table public.estabelecimentos enable row level security;
alter table public.compromissos enable row level security;
alter table public.lancamentos enable row level security;
alter table public.metas_modelo enable row level security;
alter table public.metas_semana enable row level security;
alter table public.revisoes enable row level security;
alter table public.importacoes enable row level security;
alter table public.planos_mes enable row level security;

create policy "config_own" on public.config
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categorias_own" on public.categorias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "estabelecimentos_own" on public.estabelecimentos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "compromissos_own" on public.compromissos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lancamentos_own" on public.lancamentos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "metas_modelo_own" on public.metas_modelo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "metas_semana_own" on public.metas_semana
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "revisoes_own" on public.revisoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "importacoes_own" on public.importacoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planos_mes_own" on public.planos_mes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

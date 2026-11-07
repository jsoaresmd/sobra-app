-- Subcategorias: um nível (pai_id aponta para a categoria pai)

alter table public.categorias
  add column if not exists pai_id text;

create index if not exists categorias_user_pai on public.categorias (user_id, pai_id);

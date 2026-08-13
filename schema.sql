-- ============================================================
--  ZORVEL — Gestão Inteligente — schema Supabase
--  Cole tudo no SQL Editor do Supabase e rode uma vez.
--  Seguro rodar de novo: tudo é "if not exists" / "drop if exists".
-- ============================================================

-- ---------- LANÇAMENTOS ----------
create table if not exists public.lancamentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        date not null,
  valor       numeric(12,2) not null check (valor > 0),
  categoria   text not null,
  nota        text default '',
  criado_em   timestamptz not null default now()
);
create index if not exists idx_lanc_user_data on public.lancamentos (user_id, data desc);

-- ---------- CONTAS FIXAS ----------
create table if not exists public.contas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  nome         text not null,
  dia          int  not null check (dia between 1 and 31),
  valor        numeric(12,2) default 0,
  ultimo_pago  text,               -- 'YYYY-MM' do mês já quitado
  criado_em    timestamptz not null default now()
);
create index if not exists idx_contas_user on public.contas (user_id);

-- ---------- HÁBITOS (rotina estruturada) ----------
create table if not exists public.habitos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  bloco      text not null default 'manha' check (bloco in ('manha','trabalho','noite')),
  ordem      int  not null default 0,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_habitos_user on public.habitos (user_id, bloco, ordem);

-- ---------- MARCAÇÕES DE HÁBITO ----------
create table if not exists public.habito_marcas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  habito_id  uuid not null references public.habitos(id) on delete cascade,
  data       date not null,
  unique (habito_id, data)
);
create index if not exists idx_marcas_user_data on public.habito_marcas (user_id, data);

-- ---------- DIAS FECHADOS ----------
create table if not exists public.dias_fechados (
  user_id  uuid not null references auth.users(id) on delete cascade,
  data     date not null,
  primary key (user_id, data)
);

-- ---------- EVENTOS DO CALENDÁRIO ----------
create table if not exists public.eventos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       date not null,
  hora       time,
  titulo     text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_eventos_user_data on public.eventos (user_id, data);

-- ============================================================
--  RLS — cada usuário só enxerga as próprias linhas.
--  Sem isso, a chave anon lê o banco inteiro. Não pule.
-- ============================================================
alter table public.lancamentos    enable row level security;
alter table public.contas         enable row level security;
alter table public.habitos        enable row level security;
alter table public.habito_marcas  enable row level security;
alter table public.dias_fechados  enable row level security;
alter table public.eventos        enable row level security;

drop policy if exists p_lanc    on public.lancamentos;
drop policy if exists p_contas  on public.contas;
drop policy if exists p_habitos on public.habitos;
drop policy if exists p_marcas  on public.habito_marcas;
drop policy if exists p_dias    on public.dias_fechados;
drop policy if exists p_eventos on public.eventos;

create policy p_lanc    on public.lancamentos   for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy p_contas  on public.contas        for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy p_habitos on public.habitos       for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy p_marcas  on public.habito_marcas for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy p_dias    on public.dias_fechados for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy p_eventos on public.eventos       for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

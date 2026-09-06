-- LIGA CIENEGUILLA BASKETBALL
-- Ejecuta este SQL en Supabase > SQL Editor.
-- Después crea un usuario administrador en Authentication > Users.

create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Sub-13','Sub-16','Sub-18','Libre')),
  game_date timestamptz not null,
  home_team text not null,
  away_team text not null,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  home_score integer not null default 0,
  away_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Sub-13','Sub-16','Sub-18','Libre')),
  team_name text not null,
  played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  points integer not null default 0,
  diff integer not null default 0,
  unique(category, team_name)
);

create table if not exists public.top_scorers (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Sub-13','Sub-16','Sub-18','Libre')),
  player_name text not null,
  team_name text not null,
  points_per_game numeric(6,2) not null default 0
);

alter table public.games enable row level security;
alter table public.standings enable row level security;
alter table public.top_scorers enable row level security;

-- Lectura pública.
drop policy if exists "public read games" on public.games;
create policy "public read games" on public.games for select using (true);
drop policy if exists "public read standings" on public.standings;
create policy "public read standings" on public.standings for select using (true);
drop policy if exists "public read scorers" on public.top_scorers;
create policy "public read scorers" on public.top_scorers for select using (true);

-- Solo usuarios autenticados pueden modificar.
drop policy if exists "admin insert games" on public.games;
create policy "admin insert games" on public.games for insert to authenticated with check (true);
drop policy if exists "admin update games" on public.games;
create policy "admin update games" on public.games for update to authenticated using (true) with check (true);
drop policy if exists "admin delete games" on public.games;
create policy "admin delete games" on public.games for delete to authenticated using (true);

drop policy if exists "admin write standings" on public.standings;
create policy "admin write standings" on public.standings for all to authenticated using (true) with check (true);
drop policy if exists "admin write scorers" on public.top_scorers;
create policy "admin write scorers" on public.top_scorers for all to authenticated using (true) with check (true);

-- Habilita cambios en tiempo real.
alter table public.games replica identity full;
alter table public.standings replica identity full;
alter table public.top_scorers replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.standings;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.top_scorers;
exception when duplicate_object then null;
end $$;

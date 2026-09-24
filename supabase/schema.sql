-- Run once in the Supabase SQL editor. One row per user, protected by row level security.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "read own state" on public.app_state
  for select using (auth.uid() = user_id);

create policy "insert own state" on public.app_state
  for insert with check (auth.uid() = user_id);

create policy "update own state" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

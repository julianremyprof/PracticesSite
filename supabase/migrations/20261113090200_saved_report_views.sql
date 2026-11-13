create table if not exists public.saved_report_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  report_type text not null check (report_type in ('assignments','performance')),
  config jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_report_views enable row level security;
grant select, insert, update, delete on public.saved_report_views to authenticated;

drop policy if exists "Users manage their own saved report views" on public.saved_report_views;
create policy "Users manage their own saved report views"
on public.saved_report_views
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create index if not exists saved_report_views_user_updated_idx
on public.saved_report_views (user_id, updated_at desc);

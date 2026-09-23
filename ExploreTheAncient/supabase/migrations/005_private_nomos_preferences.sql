create table public.user_nomoi (
  user_id uuid not null references auth.users(id) on delete cascade,
  nomos_id text not null,
  display_name text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, nomos_id)
);

alter table public.user_nomoi enable row level security;

create policy "Users read own nomos preferences"
on public.user_nomoi for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own nomos preferences"
on public.user_nomoi for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update own nomos preferences"
on public.user_nomoi for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete own nomos preferences"
on public.user_nomoi for delete to authenticated
using ((select auth.uid()) = user_id);

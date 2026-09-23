create table public.user_regions (
  user_id uuid not null references auth.users(id) on delete cascade,
  region_id text not null,
  display_name text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, region_id)
);

alter table public.user_regions enable row level security;

create policy "Users read own region preferences"
on public.user_regions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own region preferences"
on public.user_regions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update own region preferences"
on public.user_regions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete own region preferences"
on public.user_regions for delete to authenticated
using ((select auth.uid()) = user_id);

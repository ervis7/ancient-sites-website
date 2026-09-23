create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select profile.is_admin
     from public.profiles profile
     where profile.id = auth.uid()),
    false
  );
$$;

create table public.global_regions (
  region_id text primary key,
  display_name text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.global_nomoi (
  nomos_id text primary key,
  display_name text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.global_regions enable row level security;
alter table public.global_nomoi enable row level security;

create policy "Authenticated users read global regions"
on public.global_regions for select to authenticated using (true);
create policy "Admins insert global regions"
on public.global_regions for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update global regions"
on public.global_regions for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete global regions"
on public.global_regions for delete to authenticated
using ((select public.is_admin()));

create policy "Authenticated users read global nomoi"
on public.global_nomoi for select to authenticated using (true);
create policy "Admins insert global nomoi"
on public.global_nomoi for insert to authenticated
with check ((select public.is_admin()));
create policy "Admins update global nomoi"
on public.global_nomoi for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete global nomoi"
on public.global_nomoi for delete to authenticated
using ((select public.is_admin()));

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

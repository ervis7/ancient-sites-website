create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text,
  bio text not null default '',
  location text not null default '',
  website text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nomos_id text not null default 'fokida',
  name text not null,
  location text not null,
  altitude text not null default '',
  description text not null default '',
  image_url text not null default '',
  latitude double precision,
  longitude double precision,
  visited boolean not null default false,
  visit_date date,
  visit_photo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_user_id_idx on public.places(user_id);
create unique index profiles_username_unique_idx
on public.profiles(lower(username))
where username is not null and username <> '';

alter table public.profiles enable row level security;
alter table public.places enable row level security;

create policy "Users read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users read own places"
on public.places for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own places"
on public.places for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update own places"
on public.places for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete own places"
on public.places for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

-- Create profiles for users who signed up before this migration was applied.
insert into public.profiles (id, full_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

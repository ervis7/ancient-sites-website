create table public.place_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  visit_date date not null,
  visit_photo text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

alter table public.place_visits enable row level security;

create policy "Users read own shared visits"
on public.place_visits for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users add own shared visits"
on public.place_visits for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.places place
    where place.id = place_id
      and place.user_id <> (select auth.uid())
      and place.visibility = 'public'
  )
);

create policy "Users update own shared visits"
on public.place_visits for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users remove own shared visits"
on public.place_visits for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.award_shared_visit_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  visited_place_name text;
begin
  select place.name into visited_place_name
  from public.places place
  where place.id = new.place_id;

  update public.profiles
  set points = points + 5
  where id = new.user_id;

  insert into public.point_events (
    user_id, place_id, action_type, points, place_name
  ) values (
    new.user_id, new.place_id, 'place_visited', 5,
    coalesce(visited_place_name, '')
  );
  return new;
end;
$$;

create trigger award_points_for_shared_visit
after insert on public.place_visits
for each row execute function public.award_shared_visit_points();

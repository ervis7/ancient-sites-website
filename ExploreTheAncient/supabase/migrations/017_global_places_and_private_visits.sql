-- Places are canonical shared records. Personal state belongs in place_visits.
alter table public.places
add column if not exists is_global boolean not null default false;

alter table public.place_visits
add column if not exists visibility text not null default 'private'
check (visibility in ('private', 'public'));

-- Select one existing copy of each seeded catalog place as the canonical row.
create temporary table catalog_canonical_places on commit drop as
select
  catalog_id,
  (array_agg(id order by created_at, id))[1] as place_id
from public.places
where catalog_id is not null
group by catalog_id;

-- Migration copies must not award visit points a second time.
alter table public.place_visits
disable trigger award_points_for_shared_visit;

-- Preserve visits already stored in place_visits against any duplicate copy.
insert into public.place_visits (
  user_id, place_id, visit_date, visit_photo, visibility
)
select distinct on (visit.user_id, canonical.place_id)
  visit.user_id,
  canonical.place_id,
  visit.visit_date,
  visit.visit_photo,
  visit.visibility
from public.place_visits visit
join public.places source_place on source_place.id = visit.place_id
join catalog_canonical_places canonical
  on canonical.catalog_id = source_place.catalog_id
order by visit.user_id, canonical.place_id, visit.created_at desc
on conflict (user_id, place_id) do update set
  visit_date = excluded.visit_date,
  visit_photo = excluded.visit_photo,
  visibility = excluded.visibility;

-- Preserve visits made against per-account catalog copies before removing them.
insert into public.place_visits (
  user_id, place_id, visit_date, visit_photo, visibility
)
select
  place.user_id,
  canonical.place_id,
  place.visit_date,
  place.visit_photo,
  'private'
from public.places place
join catalog_canonical_places canonical
  on canonical.catalog_id = place.catalog_id
where place.visited = true
  and place.visit_date is not null
on conflict (user_id, place_id) do update set
  visit_date = excluded.visit_date,
  visit_photo = excluded.visit_photo,
  visibility = excluded.visibility;

-- Keep existing leaderboard events linked after duplicate rows are removed.
update public.point_events event
set place_id = canonical.place_id
from public.places source_place
join catalog_canonical_places canonical
  on canonical.catalog_id = source_place.catalog_id
where event.place_id = source_place.id
  and source_place.id <> canonical.place_id;

update public.places place
set is_global = true,
    visibility = 'public',
    visited = false,
    visit_date = null,
    visit_photo = ''
from catalog_canonical_places canonical
where place.id = canonical.place_id;

delete from public.places place
using catalog_canonical_places canonical
where place.catalog_id = canonical.catalog_id
  and place.id <> canonical.place_id;

alter table public.place_visits
enable trigger award_points_for_shared_visit;

create unique index if not exists places_global_catalog_unique_idx
on public.places(catalog_id)
where is_global = true and catalog_id is not null;

create index if not exists places_global_nomos_idx
on public.places(nomos_id)
where is_global = true;

-- New accounts read the canonical catalog instead of receiving 233 copies.
drop trigger if exists seed_ancient_catalog_after_signup on auth.users;
drop function if exists public.seed_ancient_catalog_on_signup();
drop function if exists public.seed_ancient_catalog_for_user(uuid);

drop policy if exists "Users read permitted places" on public.places;
create policy "Authenticated users read global and permitted places"
on public.places for select to authenticated
using (
  is_global = true
  or (select auth.uid()) = user_id
  or (
    visibility = 'public'
    and (
      public.is_admin_user(user_id)
      or exists (
        select 1
        from public.friend_requests request
        where request.status = 'accepted'
          and (select auth.uid()) in (request.sender_id, request.receiver_id)
          and user_id in (request.sender_id, request.receiver_id)
      )
    )
  )
);

drop policy if exists "Users insert own places" on public.places;
drop policy if exists "Users update own places" on public.places;
drop policy if exists "Users delete own places" on public.places;

create policy "Admins insert global places"
on public.places for insert to authenticated
with check (
  is_global = true
  and (select public.is_admin())
);

create policy "Admins update global places"
on public.places for update to authenticated
using (is_global = true and (select public.is_admin()))
with check (is_global = true and (select public.is_admin()));

create policy "Admins delete global places"
on public.places for delete to authenticated
using (is_global = true and (select public.is_admin()));

drop policy if exists "Users add own shared visits" on public.place_visits;
create policy "Users add personal global visits"
on public.place_visits for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.places place
    where place.id = place_id
      and (
        place.is_global = true
        or place.user_id <> (select auth.uid())
      )
  )
);

-- Friend profile visits now come from the visitor's personal visit record.
drop function if exists public.get_friend_profile(uuid);
create function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid, full_name text, username text, avatar_url text,
  background_url text, bio text, profile_location text, website text,
  place_id uuid, place_name text, place_location text,
  place_description text, place_image_url text, visit_date date,
  visit_photo text
)
language sql stable security definer set search_path = ''
as $$
  select profile.id, profile.full_name, profile.username, profile.avatar_url,
    profile.background_url, profile.bio, profile.location, profile.website,
    place.id, place.name, place.location, place.description, place.image_url,
    visit.visit_date, visit.visit_photo
  from public.friend_requests request
  join public.profiles profile on profile.id = target_friend_id
  left join public.place_visits visit
    on visit.user_id = profile.id and visit.visibility = 'public'
  left join public.places place
    on place.id = visit.place_id and place.is_global = true
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
    and target_friend_id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id end
  order by visit.visit_date desc nulls last;
$$;

revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;

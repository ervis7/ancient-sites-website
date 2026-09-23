alter table public.places
add column if not exists visibility text not null default 'private'
check (visibility in ('private', 'public'));

create or replace function public.is_admin_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select profile.is_admin from public.profiles profile
     where profile.id = target_user_id),
    false
  );
$$;

drop policy if exists "Users read own places" on public.places;
create policy "Users read permitted places"
on public.places for select to authenticated
using (
  (select auth.uid()) = user_id
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

revoke execute on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

create or replace function public.get_friend_point_activity()
returns table (
  event_id uuid, friend_id uuid, full_name text, username text,
  avatar_url text, total_points integer, action_type text,
  points_awarded integer, place_id uuid, place_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select event.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points, event.action_type, event.points,
    event.place_id, event.place_name, event.created_at
  from public.friend_requests request
  join public.profiles profile on profile.id = case
    when request.sender_id = auth.uid() then request.receiver_id
    else request.sender_id end
  join public.point_events event on event.user_id = profile.id
  join public.places place
    on place.id = event.place_id and place.visibility = 'public'
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
  order by event.created_at desc
  limit 40;
$$;

create or replace function public.get_friend_activity()
returns table (
  friend_id uuid,
  place_id uuid,
  friend_name text,
  username text,
  place_name text,
  place_location text,
  visit_date date
)
language sql stable security definer set search_path = ''
as $$
  select profile.id, place.id, profile.full_name, profile.username,
    place.name, place.location, place.visit_date
  from public.friend_requests request
  join public.profiles profile on profile.id = case
    when request.sender_id = auth.uid() then request.receiver_id
    else request.sender_id end
  join public.places place on place.user_id = profile.id
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
    and place.visibility = 'public'
    and place.visited = true
    and place.visit_date is not null
  order by place.visit_date desc
  limit 50;
$$;

create or replace function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid, full_name text, username text, avatar_url text, bio text,
  profile_location text, website text, place_id uuid, place_name text,
  place_location text, place_description text, place_image_url text,
  visit_date date, visit_photo text
)
language sql stable security definer set search_path = ''
as $$
  select profile.id, profile.full_name, profile.username, profile.avatar_url,
    profile.bio, profile.location, profile.website, place.id, place.name,
    place.location, place.description, place.image_url, place.visit_date,
    place.visit_photo
  from public.friend_requests request
  join public.profiles profile on profile.id = target_friend_id
  left join public.places place
    on place.user_id = profile.id
    and place.visibility = 'public'
    and place.visited = true
    and place.visit_date is not null
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
    and target_friend_id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id end
  order by place.visit_date desc nulls last;
$$;

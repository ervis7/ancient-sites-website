alter table public.profiles
add column if not exists presence_state text not null default 'offline'
check (presence_state in ('active', 'away', 'offline')),
add column if not exists last_seen timestamptz not null default now();

drop function if exists public.get_friend_list();
create function public.get_friend_list()
returns table (
  friendship_id uuid, friend_id uuid, full_name text, username text,
  avatar_url text, points integer, is_admin boolean,
  presence_state text, last_seen timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select request.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points, profile.is_admin,
    profile.presence_state, profile.last_seen
  from public.friend_requests request
  join public.profiles profile on profile.id = case
    when request.sender_id = auth.uid() then request.receiver_id
    else request.sender_id end
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
  order by profile.points desc, profile.full_name, profile.username;
$$;

drop function if exists public.get_pending_friend_requests();
create function public.get_pending_friend_requests()
returns table (
  request_id uuid, sender_id uuid, full_name text, username text,
  avatar_url text, points integer, is_admin boolean,
  presence_state text, last_seen timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select request.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points, profile.is_admin,
    profile.presence_state, profile.last_seen
  from public.friend_requests request
  join public.profiles profile on profile.id = request.sender_id
  where request.receiver_id = auth.uid() and request.status = 'pending'
  order by request.created_at desc;
$$;

drop function if exists public.get_friend_profile(uuid);
create function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid, full_name text, username text, avatar_url text,
  background_url text, is_admin boolean, presence_state text,
  last_seen timestamptz, bio text, profile_location text, website text,
  place_id uuid, place_name text, place_location text,
  place_description text, place_image_url text, visit_date date,
  visit_photo text, visit_note text
)
language sql stable security definer set search_path = ''
as $$
  select profile.id, profile.full_name, profile.username, profile.avatar_url,
    profile.background_url, profile.is_admin, profile.presence_state,
    profile.last_seen, profile.bio, profile.location, profile.website,
    place.id, place.name, place.location, place.description, place.image_url,
    visit.visit_date,
    case when visit.visibility = 'public' then visit.visit_photo else '' end,
    case when visit.visibility = 'public' then visit.visit_note else '' end
  from public.friend_requests request
  join public.profiles profile on profile.id = target_friend_id
  left join public.place_visits visit on visit.user_id = profile.id
  left join public.places place
    on place.id = visit.place_id and place.is_global = true
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
    and target_friend_id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id end
  order by visit.visit_date desc nulls last;
$$;

revoke execute on function public.get_friend_list() from public, anon;
revoke execute on function public.get_pending_friend_requests() from public, anon;
revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_list() to authenticated;
grant execute on function public.get_pending_friend_requests() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;

-- Make new columns and RPC return shapes visible to PostgREST immediately.
notify pgrst, 'reload schema';

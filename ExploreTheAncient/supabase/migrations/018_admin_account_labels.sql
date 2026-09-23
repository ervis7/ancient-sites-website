drop function if exists public.get_friend_list();
create function public.get_friend_list()
returns table (
  friendship_id uuid, friend_id uuid, full_name text, username text,
  avatar_url text, points integer, is_admin boolean
)
language sql stable security definer set search_path = ''
as $$
  select request.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points, profile.is_admin
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
  avatar_url text, points integer, is_admin boolean
)
language sql stable security definer set search_path = ''
as $$
  select request.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points, profile.is_admin
  from public.friend_requests request
  join public.profiles profile on profile.id = request.sender_id
  where request.receiver_id = auth.uid() and request.status = 'pending'
  order by request.created_at desc;
$$;

drop function if exists public.get_friend_point_activity();
create function public.get_friend_point_activity()
returns table (
  event_id uuid, friend_id uuid, full_name text, username text,
  avatar_url text, background_url text, total_points integer,
  is_admin boolean, action_type text, points_awarded integer,
  place_id uuid, place_name text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select event.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.background_url, profile.points,
    profile.is_admin, event.action_type, event.points, event.place_id,
    event.place_name, event.created_at
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

drop function if exists public.get_friend_profile(uuid);
create function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid, full_name text, username text, avatar_url text,
  background_url text, is_admin boolean, bio text,
  profile_location text, website text, place_id uuid, place_name text,
  place_location text, place_description text, place_image_url text,
  visit_date date, visit_photo text
)
language sql stable security definer set search_path = ''
as $$
  select profile.id, profile.full_name, profile.username, profile.avatar_url,
    profile.background_url, profile.is_admin, profile.bio, profile.location,
    profile.website, place.id, place.name, place.location, place.description,
    place.image_url, visit.visit_date, visit.visit_photo
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

revoke execute on function public.get_friend_list() from public, anon;
revoke execute on function public.get_pending_friend_requests() from public, anon;
revoke execute on function public.get_friend_point_activity() from public, anon;
revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_list() to authenticated;
grant execute on function public.get_pending_friend_requests() to authenticated;
grant execute on function public.get_friend_point_activity() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;

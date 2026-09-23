drop function if exists public.get_friend_point_activity();

create function public.get_friend_point_activity()
returns table (
  event_id uuid, friend_id uuid, full_name text, username text,
  avatar_url text, background_url text, total_points integer,
  action_type text, points_awarded integer, place_id uuid,
  place_name text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select event.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.background_url, profile.points,
    event.action_type, event.points, event.place_id, event.place_name,
    event.created_at
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

revoke execute on function public.get_friend_point_activity() from public, anon;
grant execute on function public.get_friend_point_activity() to authenticated;

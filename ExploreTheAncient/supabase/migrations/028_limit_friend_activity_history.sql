-- Keep activity history as a ten-item FIFO queue per user.
create or replace function public.trim_point_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.point_events event
  where event.id in (
    select older.id
    from public.point_events older
    where older.user_id = new.user_id
    order by older.created_at desc, older.id desc
    offset 10
  );
  return new;
end;
$$;

drop trigger if exists trim_point_events_after_insert on public.point_events;
create trigger trim_point_events_after_insert
after insert on public.point_events
for each row execute function public.trim_point_event_history();

-- Apply the same retention rule to activity already stored.
with ranked_events as (
  select
    event.id,
    row_number() over (
      partition by event.user_id
      order by event.created_at desc, event.id desc
    ) as position
  from public.point_events event
)
delete from public.point_events event
using ranked_events ranked
where event.id = ranked.id
  and ranked.position > 10;

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
  limit 10;
$$;

revoke execute on function public.get_friend_point_activity() from public, anon;
grant execute on function public.get_friend_point_activity() to authenticated;

notify pgrst, 'reload schema';

alter table public.profiles
add column if not exists points integer not null default 0
check (points >= 0);

create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  action_type text not null check (action_type in ('place_added', 'place_visited')),
  points integer not null check (points > 0),
  place_name text not null default '',
  created_at timestamptz not null default now()
);

create index point_events_user_created_idx
on public.point_events(user_id, created_at desc);

alter table public.point_events enable row level security;

create policy "Users read own point events"
on public.point_events for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.award_place_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  awarded_action text;
begin
  if tg_op = 'INSERT' then
    awarded_action := 'place_added';
  elsif new.visited = true and old.visited = false then
    awarded_action := 'place_visited';
  else
    return new;
  end if;

  update public.profiles
  set points = points + 5
  where id = new.user_id;

  insert into public.point_events (
    user_id, place_id, action_type, points, place_name
  ) values (
    new.user_id, new.id, awarded_action, 5, new.name
  );
  return new;
end;
$$;

drop trigger if exists award_place_points_on_insert on public.places;
create trigger award_place_points_on_insert
after insert on public.places
for each row execute function public.award_place_points();

drop trigger if exists award_place_points_on_visit on public.places;
create trigger award_place_points_on_visit
after update of visited on public.places
for each row execute function public.award_place_points();

create or replace function public.get_friend_point_activity()
returns table (
  event_id uuid,
  friend_id uuid,
  full_name text,
  username text,
  avatar_url text,
  total_points integer,
  action_type text,
  points_awarded integer,
  place_id uuid,
  place_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    profile.points,
    event.action_type,
    event.points,
    event.place_id,
    event.place_name,
    event.created_at
  from public.friend_requests request
  join public.profiles profile
    on profile.id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id
    end
  join public.point_events event on event.user_id = profile.id
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
  order by event.created_at desc
  limit 40;
$$;

revoke execute on function public.get_friend_point_activity() from public, anon;
grant execute on function public.get_friend_point_activity() to authenticated;

drop function if exists public.get_friend_list();
create function public.get_friend_list()
returns table (
  friendship_id uuid,
  friend_id uuid,
  full_name text,
  username text,
  avatar_url text,
  points integer
)
language sql stable security definer set search_path = ''
as $$
  select request.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points
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
  request_id uuid,
  sender_id uuid,
  full_name text,
  username text,
  avatar_url text,
  points integer
)
language sql stable security definer set search_path = ''
as $$
  select request.id, profile.id, profile.full_name, profile.username,
    profile.avatar_url, profile.points
  from public.friend_requests request
  join public.profiles profile on profile.id = request.sender_id
  where request.receiver_id = auth.uid() and request.status = 'pending'
  order by request.created_at desc;
$$;

revoke execute on function public.get_friend_list() from public, anon;
revoke execute on function public.get_pending_friend_requests() from public, anon;
grant execute on function public.get_friend_list() to authenticated;
grant execute on function public.get_pending_friend_requests() to authenticated;

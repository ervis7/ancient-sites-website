create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create unique index friend_requests_unique_pair_idx
on public.friend_requests (
  least(sender_id, receiver_id),
  greatest(sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;

create policy "Participants read friend requests"
on public.friend_requests for select to authenticated
using ((select auth.uid()) in (sender_id, receiver_id));

create policy "Users send friend requests"
on public.friend_requests for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and status = 'pending'
);

create policy "Receivers answer friend requests"
on public.friend_requests for update to authenticated
using ((select auth.uid()) = receiver_id and status = 'pending')
with check (
  (select auth.uid()) = receiver_id
  and status in ('accepted', 'rejected')
);

create policy "Participants remove friendships"
on public.friend_requests for delete to authenticated
using ((select auth.uid()) in (sender_id, receiver_id));

create or replace function public.send_friend_request(target_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.profiles
  where lower(username) = lower(trim(target_username))
  limit 1;

  if target_id is null then
    raise exception 'No account has that username.';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot add yourself.';
  end if;

  insert into public.friend_requests (sender_id, receiver_id)
  values (auth.uid(), target_id);
exception
  when unique_violation then
    raise exception 'A friend request or friendship already exists.';
end;
$$;

create or replace function public.get_friend_list()
returns table (
  friendship_id uuid,
  friend_id uuid,
  full_name text,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_url
  from public.friend_requests request
  join public.profiles profile
    on profile.id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id
    end
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
  order by profile.full_name, profile.username;
$$;

create or replace function public.get_pending_friend_requests()
returns table (
  request_id uuid,
  sender_id uuid,
  full_name text,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_url
  from public.friend_requests request
  join public.profiles profile on profile.id = request.sender_id
  where request.receiver_id = auth.uid()
    and request.status = 'pending'
  order by request.created_at desc;
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
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    place.id,
    profile.full_name,
    profile.username,
    place.name,
    place.location,
    place.visit_date
  from public.friend_requests request
  join public.profiles profile
    on profile.id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id
    end
  join public.places place on place.user_id = profile.id
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
    and place.visited = true
    and place.visit_date is not null
  order by place.visit_date desc
  limit 50;
$$;

revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.get_friend_list() from public, anon;
revoke execute on function public.get_pending_friend_requests() from public, anon;
revoke execute on function public.get_friend_activity() from public, anon;

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.get_friend_list() to authenticated;
grant execute on function public.get_pending_friend_requests() to authenticated;
grant execute on function public.get_friend_activity() to authenticated;

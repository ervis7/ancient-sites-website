alter table public.profiles
add column if not exists profile_gif_url text not null default '';

drop function if exists public.get_reaction_notifications();
create function public.get_reaction_notifications()
returns table (
  reaction_id text,
  notification_type text,
  reactor_id uuid,
  reactor_name text,
  reactor_avatar_url text,
  place_id uuid,
  place_name text,
  reaction text,
  reacted_at timestamptz,
  is_unread boolean
)
language sql stable security definer set search_path = ''
as $$
  select *
  from (
  select
    reaction.visit_user_id::text || ':' ||
      reaction.place_id::text || ':' || reaction.reactor_id::text as reaction_id,
    'visit_reaction'::text as notification_type,
    reactor.id as reactor_id,
    coalesce(nullif(reactor.full_name, ''), nullif(reactor.username, ''), 'Explorer'),
    reactor.avatar_url as reactor_avatar_url,
    place.id as place_id,
    place.name as place_name,
    reaction.emoji as reaction,
    reaction.updated_at as reacted_at,
    reaction.updated_at > owner.notifications_seen_at as is_unread
  from public.visit_reactions reaction
  join public.profiles owner on owner.id = reaction.visit_user_id
  join public.profiles reactor on reactor.id = reaction.reactor_id
  join public.places place on place.id = reaction.place_id
  where reaction.visit_user_id = auth.uid()

  union all

  select
    request.id::text || ':incoming',
    'friend_request'::text,
    sender.id,
    coalesce(nullif(sender.full_name, ''), nullif(sender.username, ''), 'Explorer'),
    sender.avatar_url,
    null::uuid,
    ''::text,
    ''::text,
    request.created_at,
    request.created_at > owner.notifications_seen_at
  from public.friend_requests request
  join public.profiles owner on owner.id = request.receiver_id
  join public.profiles sender on sender.id = request.sender_id
  where request.receiver_id = auth.uid()
    and request.status = 'pending'

  union all

  select
    request.id::text || ':accepted',
    'friend_accepted'::text,
    receiver.id,
    coalesce(nullif(receiver.full_name, ''), nullif(receiver.username, ''), 'Explorer'),
    receiver.avatar_url,
    null::uuid,
    ''::text,
    ''::text,
    request.updated_at,
    request.updated_at > owner.notifications_seen_at
  from public.friend_requests request
  join public.profiles owner on owner.id = request.sender_id
  join public.profiles receiver on receiver.id = request.receiver_id
  where request.sender_id = auth.uid()
    and request.status = 'accepted'
  ) notification
  order by notification.reacted_at desc
  limit 30;
$$;

create or replace function public.get_visible_profile_gif(target_profile_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select profile.profile_gif_url
  from public.profiles profile
  where profile.id = target_profile_id
    and (
      profile.id = auth.uid()
      or exists (
        select 1
        from public.friend_requests request
        where request.status = 'accepted'
          and auth.uid() in (request.sender_id, request.receiver_id)
          and profile.id in (request.sender_id, request.receiver_id)
      )
    )
  limit 1;
$$;

revoke execute on function public.get_reaction_notifications() from public, anon;
grant execute on function public.get_reaction_notifications() to authenticated;
revoke execute on function public.get_visible_profile_gif(uuid) from public, anon;
grant execute on function public.get_visible_profile_gif(uuid) to authenticated;

notify pgrst, 'reload schema';

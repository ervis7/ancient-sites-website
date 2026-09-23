-- Reaction notifications are derived from visit reactions. The profile keeps
-- only the point in time through which the owner has read them.
alter table public.profiles
add column if not exists notifications_seen_at timestamptz not null default now();

create or replace function public.get_reaction_notifications()
returns table (
  reaction_id text,
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
  select
    reaction.visit_user_id::text || ':' ||
      reaction.place_id::text || ':' || reaction.reactor_id::text,
    reactor.id,
    coalesce(
      nullif(reactor.full_name, ''),
      nullif(reactor.username, ''),
      'Explorer'
    ),
    reactor.avatar_url,
    place.id,
    place.name,
    reaction.emoji,
    reaction.updated_at,
    reaction.updated_at > owner.notifications_seen_at
  from public.visit_reactions reaction
  join public.profiles owner on owner.id = reaction.visit_user_id
  join public.profiles reactor on reactor.id = reaction.reactor_id
  join public.places place on place.id = reaction.place_id
  where reaction.visit_user_id = auth.uid()
  order by reaction.updated_at desc
  limit 30;
$$;

revoke execute on function public.get_reaction_notifications() from public, anon;
grant execute on function public.get_reaction_notifications() to authenticated;

notify pgrst, 'reload schema';

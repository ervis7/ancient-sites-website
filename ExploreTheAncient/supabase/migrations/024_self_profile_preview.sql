-- Allow users to preview their own profile through the same filtered response
-- that accepted friends receive.
drop function if exists public.get_friend_profile(uuid);

create function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid, full_name text, username text, avatar_url text,
  background_url text, is_admin boolean, presence_state text,
  last_seen timestamptz, bio text, profile_location text, website text,
  place_id uuid, place_name text, place_location text,
  place_description text, place_image_url text, visit_date date,
  visit_photo text, visit_note text, visit_reactions jsonb,
  visit_reactors jsonb, viewer_reaction text
)
language sql stable security definer set search_path = ''
as $$
  select profile.id, profile.full_name, profile.username, profile.avatar_url,
    profile.background_url, profile.is_admin, profile.presence_state,
    profile.last_seen, profile.bio, profile.location, profile.website,
    place.id, place.name, place.location, place.description, place.image_url,
    visit.visit_date,
    case when visit.visibility = 'public' then visit.visit_photo else '' end,
    case when visit.visibility = 'public' then visit.visit_note else '' end,
    coalesce((
      select jsonb_object_agg(reaction_counts.emoji, reaction_counts.total)
      from (
        select reaction.emoji, count(*)::integer as total
        from public.visit_reactions reaction
        where reaction.visit_user_id = profile.id
          and reaction.place_id = place.id
        group by reaction.emoji
      ) reaction_counts
    ), '{}'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'emoji', reaction.emoji,
          'userId', reactor.id,
          'name', coalesce(nullif(reactor.full_name, ''), nullif(reactor.username, ''), 'Explorer'),
          'avatarUrl', reactor.avatar_url
        )
        order by reaction.created_at
      )
      from public.visit_reactions reaction
      join public.profiles reactor on reactor.id = reaction.reactor_id
      where reaction.visit_user_id = profile.id
        and reaction.place_id = place.id
    ), '[]'::jsonb),
    (
      select reaction.emoji
      from public.visit_reactions reaction
      where reaction.visit_user_id = profile.id
        and reaction.place_id = place.id
        and reaction.reactor_id = auth.uid()
      limit 1
    )
  from public.profiles profile
  left join public.place_visits visit on visit.user_id = profile.id
  left join public.places place
    on place.id = visit.place_id and place.is_global = true
  where profile.id = target_friend_id
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
  order by visit.visit_date desc nulls last;
$$;

revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;

notify pgrst, 'reload schema';

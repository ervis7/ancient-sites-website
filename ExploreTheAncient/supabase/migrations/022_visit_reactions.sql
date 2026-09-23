create table public.visit_reactions (
  visit_user_id uuid not null,
  place_id uuid not null,
  reactor_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '🔥', '😮', '😂', '👏', '🏛️', '🗺️')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (visit_user_id, place_id, reactor_id),
  foreign key (visit_user_id, place_id)
    references public.place_visits(user_id, place_id) on delete cascade
);

create index visit_reactions_visit_idx
on public.visit_reactions(visit_user_id, place_id);

alter table public.visit_reactions enable row level security;

create policy "Authenticated users read visit reactions"
on public.visit_reactions for select to authenticated
using (
  reactor_id = (select auth.uid())
  or visit_user_id = (select auth.uid())
  or exists (
    select 1 from public.friend_requests request
    where request.status = 'accepted'
      and (select auth.uid()) in (request.sender_id, request.receiver_id)
      and visit_user_id in (request.sender_id, request.receiver_id)
  )
);

create policy "Friends add own visit reactions"
on public.visit_reactions for insert to authenticated
with check (
  reactor_id = (select auth.uid())
  and visit_user_id <> (select auth.uid())
  and exists (
    select 1 from public.friend_requests request
    where request.status = 'accepted'
      and (select auth.uid()) in (request.sender_id, request.receiver_id)
      and visit_user_id in (request.sender_id, request.receiver_id)
  )
);

create policy "Users update own visit reactions"
on public.visit_reactions for update to authenticated
using (reactor_id = (select auth.uid()))
with check (reactor_id = (select auth.uid()));

create policy "Users remove own visit reactions"
on public.visit_reactions for delete to authenticated
using (reactor_id = (select auth.uid()));

drop function if exists public.get_friend_profile(uuid);
create function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid, full_name text, username text, avatar_url text,
  background_url text, is_admin boolean, presence_state text,
  last_seen timestamptz, bio text, profile_location text, website text,
  place_id uuid, place_name text, place_location text,
  place_description text, place_image_url text, visit_date date,
  visit_photo text, visit_note text, visit_reactions jsonb,
  viewer_reaction text
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
    (
      select reaction.emoji
      from public.visit_reactions reaction
      where reaction.visit_user_id = profile.id
        and reaction.place_id = place.id
        and reaction.reactor_id = auth.uid()
      limit 1
    )
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

revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;

notify pgrst, 'reload schema';

-- One-off administrative cleanup for filkastanas@gmail.com.
-- This permanently removes all visit history belonging to this account.
do $$
declare
  target_user_id uuid;
begin
  select users.id
  into target_user_id
  from auth.users users
  where lower(users.email) = lower('filkastanas@gmail.com')
  limit 1;

  if target_user_id is null then
    raise exception 'No account exists with email filkastanas@gmail.com';
  end if;

  -- Reactions to these visits are removed automatically through the
  -- visit_reactions foreign key with ON DELETE CASCADE.
  delete from public.place_visits visit
  where visit.user_id = target_user_id;

  -- Clear any visits still stored in the legacy per-account place columns.
  update public.places place
  set
    visited = false,
    visit_date = null,
    visit_photo = '',
    updated_at = now()
  where place.user_id = target_user_id
    and (
      place.visited = true
      or place.visit_date is not null
      or place.visit_photo <> ''
    );

  -- Remove leaderboard history and points earned from those visits.
  delete from public.point_events event
  where event.user_id = target_user_id
    and event.action_type = 'place_visited';

  update public.profiles profile
  set
    points = coalesce((
      select sum(event.points)
      from public.point_events event
      where event.user_id = target_user_id
    ), 0),
    updated_at = now()
  where profile.id = target_user_id;

  raise notice 'All visits were removed for filkastanas@gmail.com';
end;
$$;

notify pgrst, 'reload schema';

-- Catalog places are shared reference data. Only rows imported from the
-- catalog are changed; places created manually keep their chosen visibility.
update public.places
set visibility = 'public',
    updated_at = now()
where catalog_id is not null
  and visibility <> 'public';

-- Keep future account seeds public even when migration 013 was already
-- applied before this visibility change.
create or replace function public.seed_ancient_catalog_for_user(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.places (
    user_id, catalog_id, nomos_id, name, location, latitude, longitude, visibility
  )
  select
    target_user_id, catalog.catalog_id, catalog.nomos_id, catalog.name,
    catalog.location, catalog.latitude, catalog.longitude, 'public'
  from public.ancient_place_catalog catalog
  on conflict (user_id, catalog_id) where catalog_id is not null do nothing;
$$;

revoke all on function public.seed_ancient_catalog_for_user(uuid)
from public, anon, authenticated;

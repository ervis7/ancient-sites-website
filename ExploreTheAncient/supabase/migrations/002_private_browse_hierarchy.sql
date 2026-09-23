alter table public.places
add column if not exists nomos_id text not null default 'fokida';

create index if not exists places_user_nomos_idx
on public.places(user_id, nomos_id);

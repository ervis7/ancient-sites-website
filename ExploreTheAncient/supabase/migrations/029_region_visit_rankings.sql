create table if not exists public.region_nomoi (
  region_id text not null,
  nomos_id text primary key
);

insert into public.region_nomoi (region_id, nomos_id) values
  ('attiki', 'attiki-athina'),
  ('attiki', 'attiki-anatoliki'),
  ('attiki', 'attiki-dytiki'),
  ('attiki', 'attiki-peiraias'),
  ('sterea-ellada', 'voiotia'),
  ('sterea-ellada', 'evvoia'),
  ('sterea-ellada', 'evrytania'),
  ('sterea-ellada', 'fthiotida'),
  ('sterea-ellada', 'fokida'),
  ('kentriki-makedonia', 'imathia'),
  ('kentriki-makedonia', 'thessaloniki'),
  ('kentriki-makedonia', 'kilkis'),
  ('kentriki-makedonia', 'pella'),
  ('kentriki-makedonia', 'pieria'),
  ('kentriki-makedonia', 'serres'),
  ('kentriki-makedonia', 'chalkidiki'),
  ('kriti', 'irakleio'),
  ('kriti', 'lasithi'),
  ('kriti', 'rethymno'),
  ('kriti', 'chania'),
  ('anatoliki-makedonia-thraki', 'drama'),
  ('anatoliki-makedonia-thraki', 'evros'),
  ('anatoliki-makedonia-thraki', 'kavala'),
  ('anatoliki-makedonia-thraki', 'rodopi'),
  ('anatoliki-makedonia-thraki', 'xanthi'),
  ('ipeiros', 'arta'),
  ('ipeiros', 'thesprotia'),
  ('ipeiros', 'ioannina'),
  ('ipeiros', 'preveza'),
  ('ionia-nisia', 'zakynthos'),
  ('ionia-nisia', 'kerkira'),
  ('ionia-nisia', 'kefalonia'),
  ('ionia-nisia', 'lefkas'),
  ('voreio-aigaio', 'lesvos'),
  ('voreio-aigaio', 'samos'),
  ('voreio-aigaio', 'chios'),
  ('peloponnisos', 'argolida'),
  ('peloponnisos', 'arkadia'),
  ('peloponnisos', 'korinthia'),
  ('peloponnisos', 'lakonia'),
  ('peloponnisos', 'messinia'),
  ('notio-aigaio', 'dodekanisa'),
  ('notio-aigaio', 'kyklades'),
  ('thessalia', 'karditsa'),
  ('thessalia', 'larisa'),
  ('thessalia', 'magnisia'),
  ('thessalia', 'trikala'),
  ('dytiki-ellada', 'aitoloakarnania'),
  ('dytiki-ellada', 'achaia'),
  ('dytiki-ellada', 'ileia'),
  ('dytiki-makedonia', 'grevena'),
  ('dytiki-makedonia', 'kastoria'),
  ('dytiki-makedonia', 'kozani'),
  ('dytiki-makedonia', 'florina'),
  ('ektos-elladas', 'mikra-asia-tourkia')
on conflict (nomos_id) do update
set region_id = excluded.region_id;

alter table public.region_nomoi enable row level security;

create or replace function public.get_region_visit_rankings()
returns table (
  region_id text,
  place_id uuid,
  place_name text,
  place_image_url text,
  visit_count bigint,
  visitors jsonb
)
language sql volatile security definer set search_path = ''
as $$
  with candidates as (
    select
      mapping.region_id,
      place.id,
      place.name,
      place.image_url,
      count(visit.place_id) as visit_count,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'userId', visitor.id,
            'name', coalesce(
              nullif(visitor.full_name, ''),
              nullif(visitor.username, ''),
              'Explorer'
            ),
            'avatarUrl', visitor.avatar_url
          )
          order by visit_record.visit_date desc, visit_record.created_at desc
        )
        from public.place_visits visit_record
        join public.profiles visitor on visitor.id = visit_record.user_id
        where visit_record.place_id = place.id
      ), '[]'::jsonb) as visitors,
      random() as random_order
    from public.region_nomoi mapping
    join public.places place
      on place.nomos_id = mapping.nomos_id
      and place.is_global = true
    left join public.place_visits visit on visit.place_id = place.id
    group by mapping.region_id, place.id, place.name, place.image_url
  ),
  ranked as (
    select
      candidate.*,
      row_number() over (
        partition by candidate.region_id
        order by candidate.visit_count desc, candidate.random_order
      ) as position
    from candidates candidate
  )
  select
    ranked.region_id,
    ranked.id,
    ranked.name,
    ranked.image_url,
    ranked.visit_count,
    ranked.visitors
  from ranked
  where ranked.position <= 5
  order by ranked.region_id, ranked.position;
$$;

revoke all on public.region_nomoi from public, anon, authenticated;
revoke execute on function public.get_region_visit_rankings() from public, anon;
grant execute on function public.get_region_visit_rankings() to authenticated;

notify pgrst, 'reload schema';

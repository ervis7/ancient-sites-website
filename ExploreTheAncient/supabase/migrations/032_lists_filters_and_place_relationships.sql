create table if not exists public.user_place_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.user_place_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_favorites boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_place_lists
add column if not exists is_favorites boolean not null default false;

create table if not exists public.user_place_list_items (
  list_id uuid not null references public.user_place_lists(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

create table if not exists public.place_relationships (
  parent_place_id uuid not null references public.places(id) on delete cascade,
  child_place_id uuid not null references public.places(id) on delete cascade,
  relation_type text not null default 'connected',
  confidence text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (parent_place_id, child_place_id),
  check (parent_place_id <> child_place_id)
);

create unique index if not exists user_place_lists_user_name_unique_idx
on public.user_place_lists(user_id, lower(name));

create unique index if not exists user_place_lists_one_favorites_idx
on public.user_place_lists(user_id)
where is_favorites = true;

create or replace function public.prevent_default_favorites_list_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_favorites then
    raise exception 'The default favorites list cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_default_favorites_list_delete
on public.user_place_lists;

create trigger prevent_default_favorites_list_delete
before delete on public.user_place_lists
for each row
execute function public.prevent_default_favorites_list_delete();

alter table public.user_place_favorites enable row level security;
alter table public.user_place_lists enable row level security;
alter table public.user_place_list_items enable row level security;
alter table public.place_relationships enable row level security;

drop policy if exists "Users manage own favorite places" on public.user_place_favorites;
create policy "Users manage own favorite places"
on public.user_place_favorites for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own place lists" on public.user_place_lists;
create policy "Users manage own place lists"
on public.user_place_lists for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own place list items" on public.user_place_list_items;
create policy "Users read own place list items"
on public.user_place_list_items for select to authenticated
using (
  exists (
    select 1
    from public.user_place_lists list
    where list.id = list_id
      and list.user_id = (select auth.uid())
  )
);

drop policy if exists "Users insert own place list items" on public.user_place_list_items;
create policy "Users insert own place list items"
on public.user_place_list_items for insert to authenticated
with check (
  exists (
    select 1
    from public.user_place_lists list
    where list.id = list_id
      and list.user_id = (select auth.uid())
  )
);

drop policy if exists "Users delete own place list items" on public.user_place_list_items;
create policy "Users delete own place list items"
on public.user_place_list_items for delete to authenticated
using (
  exists (
    select 1
    from public.user_place_lists list
    where list.id = list_id
      and list.user_id = (select auth.uid())
  )
);

drop policy if exists "Authenticated users read place relationships" on public.place_relationships;
create policy "Authenticated users read place relationships"
on public.place_relationships for select to authenticated
using (true);

drop policy if exists "Admins manage place relationships" on public.place_relationships;
create policy "Admins manage place relationships"
on public.place_relationships for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

with incoming (
  parent_catalog_id,
  child_catalog_id,
  relation_type,
  confidence,
  notes
) as (
values
  (1, 27, 'connected', 'medium', 'Connected monument from cleaned seed: Αμφίπολη'),
  (1, 174, 'connected', 'medium', 'Connected monument from cleaned seed: Φίλιπποι'),
  (1, 207, 'connected', 'medium', 'Connected monument from cleaned seed: Dikili Tash'),
  (3, 23, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Κόρινθος'),
  (4, 17, 'subpoint', 'high', 'Subpoint from cleaned seed: ancient-theatre-delphi-subpoint'),
  (5, 47, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Αγορά της Αθήνας'),
  (6, 104, 'connected', 'medium', 'Connected monument from cleaned seed: Στύμφαλος'),
  (7, 16, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαιολογικός χώρος Ελευσίνας'),
  (9, 10, 'connected', 'high', 'Connected monument from cleaned seed: Στοά Ευμένους'),
  (9, 67, 'connected', 'high', 'Connected monument from cleaned seed: Ιερό Διονύσου'),
  (11, 7, 'connected', 'medium', 'Connected monument from cleaned seed: Προπύλαια'),
  (12, 57, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Μεσσήνη'),
  (13, 10, 'connected', 'high', 'Connected monument from cleaned seed: Στοά Ευμένους'),
  (14, 38, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Θήβα'),
  (14, 135, 'connected', 'medium', 'Connected monument from cleaned seed: Δήλιο'),
  (15, 16, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαιολογικός χώρος Ελευσίνας'),
  (16, 7, 'subpoint', 'high', 'Subpoint from cleaned seed: great-propylaea-eleusis'),
  (16, 15, 'subpoint', 'medium', 'Subpoint from cleaned seed: iera-odos-kifisos-ancient-crossing'),
  (16, 51, 'subpoint', 'medium', 'Subpoint from cleaned seed: roman-bridge-eleusinian-kifisos'),
  (17, 4, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαιολογικός χώρος Δελφών'),
  (20, 1, 'connected', 'medium', 'Connected monument from cleaned seed: Παγγαίο'),
  (20, 27, 'connected', 'medium', 'Connected monument from cleaned seed: Αμφίπολη'),
  (21, 47, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Αγορά'),
  (21, 76, 'connected', 'high', 'Connected monument from cleaned seed: Ακαδημία Πλάτωνος'),
  (23, 25, 'subpoint', 'medium', 'Subpoint from cleaned seed: roman-baths-ancient-corinth-subpoint'),
  (24, 57, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Μεσσήνη'),
  (25, 23, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Κόρινθος'),
  (27, 34, 'subpoint', 'medium', 'Subpoint from cleaned seed: tomb-of-brasidas-amphipolis-subpoint'),
  (31, 143, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Φιγαλεία'),
  (32, 30, 'connected', 'high', 'Connected monument from cleaned seed: Ιερό Δέσποινας στη Λυκόσουρα'),
  (33, 77, 'connected', 'medium', 'Connected monument from cleaned seed: Ιερό Καβείρων'),
  (34, 27, 'connected', 'medium', 'Connected monument from cleaned seed: Αμφίπολη'),
  (36, 50, 'connected', 'high', 'Connected monument from cleaned seed: Νυμφαίο Μίεζας'),
  (36, 185, 'connected', 'high', 'Connected monument from cleaned seed: Αιγές'),
  (38, 69, 'subpoint', 'high', 'Subpoint from cleaned seed: archaeological-museum-thebes-subpoint'),
  (39, 58, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Νικόπολη'),
  (41, 139, 'connected', 'medium', 'Connected monument from cleaned seed: Γόρτυς Αρκαδίας'),
  (43, 105, 'connected', 'high', 'Connected monument from cleaned seed: Μιδέα'),
  (46, 30, 'connected', 'medium', 'Connected monument from cleaned seed: Ιερό Δέσποινας'),
  (47, 5, 'subpoint', 'medium', 'Subpoint from cleaned seed: poikile-stoa-probable-location'),
  (47, 21, 'connected', 'high', 'Connected monument from cleaned seed: Κεραμεικός'),
  (48, 91, 'connected', 'high', 'Connected monument from cleaned seed: Καρφί'),
  (48, 232, 'connected', 'high', 'Connected monument from cleaned seed: Λασίθι'),
  (49, 88, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Ελεύθερνα'),
  (50, 185, 'connected', 'high', 'Connected monument from cleaned seed: Αιγές'),
  (51, 7, 'connected', 'medium', 'Connected monument from cleaned seed: Μεγάλα Προπύλαια Ελευσίνας'),
  (51, 16, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαιολογικός χώρος Ελευσίνας'),
  (52, 60, 'connected', 'medium', 'Connected monument from cleaned seed: Ορχομενός'),
  (53, 14, 'connected', 'medium', 'Connected monument from cleaned seed: Ιερό Αρτέμιδος Αυλιδείας'),
  (55, 232, 'connected', 'high', 'Connected monument from cleaned seed: Λασίθι'),
  (56, 196, 'connected', 'high', 'Connected monument from cleaned seed: Ηραίο Σάμου'),
  (56, 197, 'connected', 'high', 'Connected monument from cleaned seed: Πυθαγόρειο Σάμου'),
  (57, 12, 'subpoint', 'high', 'Subpoint from cleaned seed: asclepieion-ancient-messene-subpoint'),
  (57, 24, 'subpoint', 'high', 'Subpoint from cleaned seed: palaestra-baths-ancient-messene-subpoint'),
  (58, 39, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαιολογικό Μουσείο Νικόπολης'),
  (59, 23, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Κόρινθος'),
  (60, 104, 'connected', 'medium', 'Connected monument from cleaned seed: Στύμφαλος'),
  (62, 38, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Θήβα'),
  (64, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (64, 222, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Ίκλαινα'),
  (68, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (69, 38, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Θήβα / Καδμεία'),
  (70, 2, 'connected', 'high', 'Connected monument from cleaned seed: Γαλεριανό Συγκρότημα'),
  (71, 2, 'connected', 'medium', 'Connected monument from cleaned seed: Θεσσαλονίκη'),
  (75, 134, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Αλίαρτος'),
  (76, 21, 'connected', 'medium', 'Connected monument from cleaned seed: Κεραμεικός'),
  (76, 47, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Αγορά'),
  (77, 38, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Θήβα'),
  (77, 69, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαιολογικό Μουσείο Θηβών'),
  (78, 3, 'connected', 'medium', 'Connected monument from cleaned seed: Ηραίο Περαχώρας'),
  (78, 79, 'connected', 'medium', 'Connected monument from cleaned seed: Βραχοκομμένες δεξαμενές'),
  (79, 3, 'connected', 'medium', 'Connected monument from cleaned seed: Ηραίο Περαχώρας'),
  (79, 78, 'connected', 'medium', 'Connected monument from cleaned seed: Υδραυλικό σύστημα Κρήνης'),
  (80, 93, 'connected', 'high', 'Connected monument from cleaned seed: Κασσώπη'),
  (80, 97, 'connected', 'high', 'Connected monument from cleaned seed: Δωδώνη'),
  (82, 60, 'connected', 'high', 'Connected monument from cleaned seed: Ορχομενός'),
  (84, 117, 'connected', 'high', 'Connected monument from cleaned seed: Ηφαιστία'),
  (84, 159, 'connected', 'high', 'Connected monument from cleaned seed: Κουκονήσι'),
  (85, 98, 'connected', 'medium', 'Connected monument from cleaned seed: Σέσκλο'),
  (85, 99, 'connected', 'medium', 'Connected monument from cleaned seed: Διμήνι'),
  (85, 193, 'connected', 'medium', 'Connected monument from cleaned seed: Θεόπετρα'),
  (86, 87, 'connected', 'high', 'Connected monument from cleaned seed: Δρήρος'),
  (86, 90, 'connected', 'high', 'Connected monument from cleaned seed: Γουρνιά'),
  (87, 86, 'connected', 'medium', 'Connected monument from cleaned seed: Λατώ'),
  (87, 90, 'connected', 'medium', 'Connected monument from cleaned seed: Γουρνιά'),
  (88, 49, 'connected', 'medium', 'Connected monument from cleaned seed: Ιδαίο Άντρο'),
  (89, 86, 'connected', 'medium', 'Connected monument from cleaned seed: Λατώ'),
  (89, 90, 'connected', 'medium', 'Connected monument from cleaned seed: Γουρνιά'),
  (89, 231, 'connected', 'medium', 'Connected monument from cleaned seed: Καβούσι Κάστρο'),
  (89, 232, 'connected', 'medium', 'Connected monument from cleaned seed: Βρόκαστρο'),
  (90, 86, 'connected', 'high', 'Connected monument from cleaned seed: Λατώ'),
  (91, 48, 'connected', 'medium', 'Connected monument from cleaned seed: Δικταίο Άντρο'),
  (91, 86, 'connected', 'medium', 'Connected monument from cleaned seed: Λατώ'),
  (91, 87, 'connected', 'medium', 'Connected monument from cleaned seed: Δρήρος'),
  (91, 231, 'subpoint', 'low', 'Subpoint from cleaned seed: kavousi-kastro'),
  (91, 232, 'subpoint', 'low', 'Subpoint from cleaned seed: vrokastro-lasithi'),
  (93, 94, 'connected', 'high', 'Connected monument from cleaned seed: Νεκρομαντείο Αχέροντα'),
  (94, 96, 'connected', 'high', 'Connected monument from cleaned seed: Ελέα'),
  (94, 128, 'connected', 'high', 'Connected monument from cleaned seed: Πανδοσία'),
  (95, 96, 'connected', 'high', 'Connected monument from cleaned seed: Ελέα'),
  (96, 93, 'connected', 'high', 'Connected monument from cleaned seed: Κασσώπη'),
  (96, 95, 'connected', 'high', 'Connected monument from cleaned seed: Γίτανα'),
  (98, 99, 'connected', 'high', 'Connected monument from cleaned seed: Διμήνι'),
  (99, 98, 'connected', 'high', 'Connected monument from cleaned seed: Σέσκλο'),
  (102, 100, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαίο Φρούριο Αιγοσθένων'),
  (104, 6, 'connected', 'medium', 'Connected monument from cleaned seed: Φενεός'),
  (104, 138, 'connected', 'medium', 'Connected monument from cleaned seed: Νεμέα'),
  (105, 106, 'connected', 'high', 'Connected monument from cleaned seed: Ασίνη'),
  (105, 107, 'connected', 'high', 'Connected monument from cleaned seed: Λέρνα'),
  (106, 105, 'connected', 'high', 'Connected monument from cleaned seed: Μιδέα'),
  (106, 107, 'connected', 'high', 'Connected monument from cleaned seed: Λέρνα'),
  (108, 109, 'connected', 'high', 'Connected monument from cleaned seed: Οινιάδες'),
  (109, 108, 'connected', 'high', 'Connected monument from cleaned seed: Πλευρώνα'),
  (110, 112, 'connected', 'high', 'Connected monument from cleaned seed: Γόρτυνα'),
  (110, 126, 'connected', 'high', 'Connected monument from cleaned seed: Κομμός'),
  (110, 212, 'subpoint', 'low', 'Subpoint from cleaned seed: koumasa-cemetery-settlement'),
  (111, 110, 'connected', 'medium', 'Connected monument from cleaned seed: Φαιστός'),
  (111, 112, 'connected', 'medium', 'Connected monument from cleaned seed: Γόρτυνα'),
  (111, 126, 'connected', 'medium', 'Connected monument from cleaned seed: Κομμός'),
  (112, 110, 'connected', 'high', 'Connected monument from cleaned seed: Φαιστός'),
  (114, 115, 'connected', 'medium', 'Connected monument from cleaned seed: Ακρωτήρι Θήρας'),
  (115, 114, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Θήρα'),
  (116, 101, 'connected', 'medium', 'Connected monument from cleaned seed: Άπτερα'),
  (116, 121, 'connected', 'medium', 'Connected monument from cleaned seed: Φαλάσαρνα'),
  (117, 84, 'connected', 'medium', 'Connected monument from cleaned seed: Πολιόχνη'),
  (117, 159, 'connected', 'medium', 'Connected monument from cleaned seed: Κουκονήσι'),
  (118, 119, 'connected', 'medium', 'Connected monument from cleaned seed: Ίτανος'),
  (119, 118, 'connected', 'medium', 'Connected monument from cleaned seed: Παλαίκαστρο'),
  (119, 127, 'connected', 'medium', 'Connected monument from cleaned seed: Πραισός'),
  (120, 90, 'connected', 'medium', 'Connected monument from cleaned seed: Γουρνιά'),
  (121, 116, 'connected', 'high', 'Connected monument from cleaned seed: Κίσσαμος'),
  (122, 123, 'connected', 'medium', 'Connected monument from cleaned seed: Αμνισός'),
  (122, 124, 'connected', 'medium', 'Connected monument from cleaned seed: Βαθύπετρο'),
  (126, 110, 'connected', 'medium', 'Connected monument from cleaned seed: Φαιστός'),
  (126, 112, 'connected', 'medium', 'Connected monument from cleaned seed: Γόρτυνα'),
  (127, 86, 'connected', 'medium', 'Connected monument from cleaned seed: Λατώ'),
  (127, 87, 'connected', 'medium', 'Connected monument from cleaned seed: Δρήρος'),
  (127, 119, 'connected', 'medium', 'Connected monument from cleaned seed: Ίτανος'),
  (128, 94, 'connected', 'medium', 'Connected monument from cleaned seed: Νεκρομαντείο Αχέροντα'),
  (128, 129, 'connected', 'medium', 'Connected monument from cleaned seed: Κίχυρος / Εφύρα'),
  (129, 94, 'connected', 'medium', 'Connected monument from cleaned seed: Νεκρομαντείο Αχέροντα'),
  (129, 128, 'connected', 'medium', 'Connected monument from cleaned seed: Πανδοσία'),
  (130, 61, 'connected', 'medium', 'Connected monument from cleaned seed: Θερμοπύλες'),
  (130, 131, 'connected', 'medium', 'Connected monument from cleaned seed: Μελιταία'),
  (131, 61, 'connected', 'medium', 'Connected monument from cleaned seed: Θερμοπύλες'),
  (131, 130, 'connected', 'medium', 'Connected monument from cleaned seed: Πρόερνα'),
  (132, 98, 'connected', 'medium', 'Connected monument from cleaned seed: Σέσκλο'),
  (132, 99, 'connected', 'medium', 'Connected monument from cleaned seed: Διμήνι'),
  (132, 133, 'connected', 'medium', 'Connected monument from cleaned seed: Νέα Άλος'),
  (133, 98, 'connected', 'medium', 'Connected monument from cleaned seed: Σέσκλο'),
  (133, 99, 'connected', 'medium', 'Connected monument from cleaned seed: Διμήνι'),
  (133, 132, 'connected', 'medium', 'Connected monument from cleaned seed: Παλαιά Άλος'),
  (134, 75, 'subpoint', 'medium', 'Subpoint from cleaned seed: haliartos-moulki-tower'),
  (134, 82, 'connected', 'medium', 'Connected monument from cleaned seed: Γλα'),
  (135, 53, 'connected', 'medium', 'Connected monument from cleaned seed: Αυλίδα'),
  (135, 162, 'connected', 'medium', 'Connected monument from cleaned seed: Ανθηδώνα'),
  (135, 202, 'connected', 'medium', 'Connected monument from cleaned seed: Ερέτρια'),
  (136, 23, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Κόρινθος'),
  (136, 138, 'connected', 'medium', 'Connected monument from cleaned seed: Νεμέα'),
  (137, 142, 'connected', 'medium', 'Connected monument from cleaned seed: Ψωφίδα'),
  (137, 189, 'connected', 'medium', 'Connected monument from cleaned seed: Αιγείρα'),
  (138, 156, 'connected', 'high', 'Connected monument from cleaned seed: Κλεωνές'),
  (139, 60, 'connected', 'medium', 'Connected monument from cleaned seed: Ορχομενός Αρκαδίας'),
  (140, 22, 'connected', 'medium', 'Connected monument from cleaned seed: Ολυμπία'),
  (140, 31, 'connected', 'medium', 'Connected monument from cleaned seed: Βάσσες'),
  (140, 143, 'connected', 'medium', 'Connected monument from cleaned seed: Φιγαλεία'),
  (141, 32, 'connected', 'medium', 'Connected monument from cleaned seed: Ιερό Δία'),
  (142, 6, 'connected', 'medium', 'Connected monument from cleaned seed: Φενεός'),
  (142, 137, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Πελλήνη'),
  (142, 189, 'connected', 'medium', 'Connected monument from cleaned seed: Αιγείρα'),
  (143, 31, 'connected', 'medium', 'Connected monument from cleaned seed: Ναός Επικούριου Απόλλωνα'),
  (145, 108, 'connected', 'medium', 'Connected monument from cleaned seed: Πλευρώνα'),
  (145, 109, 'connected', 'medium', 'Connected monument from cleaned seed: Οινιάδες'),
  (147, 108, 'connected', 'high', 'Connected monument from cleaned seed: Πλευρώνα'),
  (147, 109, 'connected', 'high', 'Connected monument from cleaned seed: Οινιάδες'),
  (148, 109, 'connected', 'medium', 'Connected monument from cleaned seed: Οινιάδες'),
  (148, 145, 'connected', 'medium', 'Connected monument from cleaned seed: Στράτος'),
  (149, 153, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Αλυζεία'),
  (152, 153, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Αλυζεία'),
  (153, 109, 'connected', 'medium', 'Connected monument from cleaned seed: Οινιάδες'),
  (153, 149, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαίο φράγμα Αλυζείας'),
  (154, 155, 'subpoint', 'medium', 'Subpoint from cleaned seed: wall-ancient-chalcis-aitolia'),
  (155, 154, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Χαλκίδα Αιτωλίας'),
  (156, 23, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Κόρινθος'),
  (156, 138, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Νεμέα'),
  (157, 158, 'connected', 'medium', 'Connected monument from cleaned seed: Στρόφιλας'),
  (157, 165, 'connected', 'medium', 'Connected monument from cleaned seed: Παλαιόπολη Άνδρου'),
  (158, 157, 'connected', 'medium', 'Connected monument from cleaned seed: Ζαγορά Άνδρου'),
  (158, 165, 'connected', 'medium', 'Connected monument from cleaned seed: Παλαιόπολη Άνδρου'),
  (159, 84, 'connected', 'medium', 'Connected monument from cleaned seed: Πολιόχνη'),
  (159, 117, 'connected', 'medium', 'Connected monument from cleaned seed: Ηφαιστία'),
  (160, 84, 'connected', 'medium', 'Connected monument from cleaned seed: Πολιόχνη'),
  (162, 53, 'connected', 'medium', 'Connected monument from cleaned seed: Αυλίδα'),
  (162, 135, 'connected', 'medium', 'Connected monument from cleaned seed: Δήλιο'),
  (163, 175, 'connected', 'medium', 'Connected monument from cleaned seed: Βρουλιά'),
  (163, 178, 'connected', 'medium', 'Connected monument from cleaned seed: Κάμειρος'),
  (165, 157, 'connected', 'medium', 'Connected monument from cleaned seed: Ζαγορά Άνδρου'),
  (165, 158, 'connected', 'medium', 'Connected monument from cleaned seed: Στρόφιλας'),
  (170, 115, 'connected', 'high', 'Connected monument from cleaned seed: Ακρωτήρι Θήρας'),
  (171, 170, 'connected', 'medium', 'Connected monument from cleaned seed: Σκάρκος Ίου'),
  (171, 200, 'connected', 'medium', 'Connected monument from cleaned seed: Φυλακωπή Μήλου'),
  (175, 163, 'connected', 'medium', 'Connected monument from cleaned seed: Κυμισάλα'),
  (175, 178, 'connected', 'medium', 'Connected monument from cleaned seed: Κάμειρος'),
  (176, 177, 'connected', 'medium', 'Connected monument from cleaned seed: Ακρόπολη Λίνδου'),
  (176, 178, 'connected', 'medium', 'Connected monument from cleaned seed: Αρχαία Κάμειρος'),
  (177, 178, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Κάμειρος'),
  (178, 175, 'connected', 'medium', 'Connected monument from cleaned seed: Βρουλιά'),
  (178, 176, 'connected', 'medium', 'Connected monument from cleaned seed: Ακρόπολη Ρόδου'),
  (178, 177, 'connected', 'medium', 'Connected monument from cleaned seed: Ακρόπολη Λίνδου'),
  (179, 172, 'connected', 'high', 'Connected monument from cleaned seed: Όλυνθος'),
  (179, 182, 'connected', 'high', 'Connected monument from cleaned seed: Μένδη'),
  (181, 172, 'connected', 'high', 'Connected monument from cleaned seed: Όλυνθος'),
  (181, 180, 'connected', 'high', 'Connected monument from cleaned seed: Στάγειρα'),
  (181, 183, 'connected', 'high', 'Connected monument from cleaned seed: Τορώνη'),
  (182, 172, 'connected', 'high', 'Connected monument from cleaned seed: Όλυνθος'),
  (182, 179, 'connected', 'high', 'Connected monument from cleaned seed: Ποτίδαια'),
  (183, 172, 'connected', 'medium', 'Connected monument from cleaned seed: Όλυνθος'),
  (183, 180, 'connected', 'medium', 'Connected monument from cleaned seed: Στάγειρα'),
  (183, 181, 'connected', 'medium', 'Connected monument from cleaned seed: Άκανθος'),
  (184, 67, 'connected', 'high', 'Connected monument from cleaned seed: Δίον'),
  (184, 186, 'connected', 'high', 'Connected monument from cleaned seed: Πύδνα'),
  (191, 63, 'connected', 'high', 'Connected monument from cleaned seed: Σούνιο'),
  (195, 164, 'connected', 'high', 'Connected monument from cleaned seed: Σαμοθράκη'),
  (196, 56, 'connected', 'high', 'Connected monument from cleaned seed: Ευπαλίνειο Όρυγμα'),
  (196, 197, 'connected', 'high', 'Connected monument from cleaned seed: Πυθαγόρειο Σάμου'),
  (197, 56, 'connected', 'high', 'Connected monument from cleaned seed: Ευπαλίνειο Όρυγμα'),
  (197, 196, 'connected', 'high', 'Connected monument from cleaned seed: Ηραίο Σάμου'),
  (198, 199, 'connected', 'high', 'Connected monument from cleaned seed: Κολώνα Αίγινας'),
  (199, 198, 'connected', 'medium', 'Connected monument from cleaned seed: Ναός Αφαίας'),
  (200, 115, 'connected', 'medium', 'Connected monument from cleaned seed: Ακρωτήρι Θήρας'),
  (203, 202, 'connected', 'high', 'Connected monument from cleaned seed: Αρχαία Ερέτρια'),
  (205, 202, 'connected', 'medium', 'Connected monument from cleaned seed: Ερέτρια'),
  (205, 206, 'connected', 'medium', 'Connected monument from cleaned seed: Λευκαντί'),
  (206, 202, 'connected', 'medium', 'Connected monument from cleaned seed: Ερέτρια'),
  (207, 1, 'connected', 'medium', 'Connected monument from cleaned seed: Παγγαίο'),
  (207, 174, 'connected', 'medium', 'Connected monument from cleaned seed: Φίλιπποι'),
  (211, 110, 'connected', 'medium', 'Connected monument from cleaned seed: Φαιστός'),
  (211, 112, 'connected', 'medium', 'Connected monument from cleaned seed: Γόρτυνα'),
  (212, 110, 'connected', 'low', 'Connected monument from cleaned seed: Φαιστός / Μινωική νότια Κρήτη'),
  (214, 110, 'connected', 'medium', 'Connected monument from cleaned seed: Φαιστός'),
  (214, 126, 'connected', 'medium', 'Connected monument from cleaned seed: Κομμός'),
  (215, 64, 'subpoint', 'medium', 'Subpoint from cleaned seed: pylos-archaeological-museum-subpoint'),
  (215, 68, 'subpoint', 'medium', 'Subpoint from cleaned seed: royal-mycenaean-tholos-tomb-engianos'),
  (215, 216, 'subpoint', 'medium', 'Subpoint from cleaned seed: tholos-tomb-iv-nestor-palace'),
  (215, 217, 'subpoint', 'medium', 'Subpoint from cleaned seed: tholos-tomb-iii-nestor-palace'),
  (215, 218, 'subpoint', 'medium', 'Subpoint from cleaned seed: mycenaean-cemetery-nestor-palace'),
  (215, 219, 'subpoint', 'medium', 'Subpoint from cleaned seed: tholos-tomb-1-2-nestor-palace'),
  (215, 220, 'subpoint', 'high', 'Subpoint from cleaned seed: tholos-tomb-koryfasio'),
  (215, 221, 'subpoint', 'high', 'Subpoint from cleaned seed: tholos-tombs-tragana'),
  (215, 223, 'subpoint', 'low', 'Subpoint from cleaned seed: archaic-sanctuary-pylos-subpoint'),
  (215, 224, 'subpoint', 'low', 'Subpoint from cleaned seed: pylos-generic-tholos-tomb-a-subpoint'),
  (215, 225, 'subpoint', 'low', 'Subpoint from cleaned seed: pylos-generic-tholos-tomb-b-subpoint'),
  (215, 226, 'subpoint', 'low', 'Subpoint from cleaned seed: pylos-generic-tholos-tomb-γ-subpoint'),
  (215, 227, 'subpoint', 'low', 'Subpoint from cleaned seed: burial-tumulus-pylos-subpoint'),
  (215, 228, 'subpoint', 'medium', 'Subpoint from cleaned seed: tholos-tombs-kaminia'),
  (216, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (217, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (218, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (219, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (220, 215, 'connected', 'high', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα / Μυκηναϊκή Πύλος'),
  (221, 215, 'connected', 'high', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα / Μυκηναϊκή Πύλος'),
  (223, 215, 'connected', 'low', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα / Περιοχή Πύλου'),
  (224, 215, 'connected', 'low', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (225, 215, 'connected', 'low', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (226, 215, 'connected', 'low', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα'),
  (227, 215, 'connected', 'low', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα / Περιοχή Πύλου'),
  (228, 215, 'connected', 'medium', 'Connected monument from cleaned seed: Ανάκτορο του Νέστορα / Μυκηναϊκή Πύλος'),
  (229, 164, 'connected', 'low', 'Connected monument from cleaned seed: Σαμοθράκη'),
  (229, 195, 'connected', 'low', 'Connected monument from cleaned seed: Μεσημβρία-Ζώνη'),
  (230, 98, 'connected', 'medium', 'Connected monument from cleaned seed: Σέσκλο'),
  (230, 193, 'connected', 'medium', 'Connected monument from cleaned seed: Θεόπετρα'),
  (233, 164, 'connected', 'medium', 'Connected monument from cleaned seed: Σαμοθράκη'),
  (233, 173, 'connected', 'medium', 'Connected monument from cleaned seed: Άβδηρα'),
  (233, 195, 'connected', 'medium', 'Connected monument from cleaned seed: Μεσημβρία-Ζώνη')
)
insert into public.place_relationships (
  parent_place_id,
  child_place_id,
  relation_type,
  confidence,
  notes
)
select
  parent.id,
  child.id,
  incoming.relation_type,
  incoming.confidence,
  incoming.notes
from incoming
join public.places parent
  on parent.catalog_id = incoming.parent_catalog_id
  and parent.is_global = true
join public.places child
  on child.catalog_id = incoming.child_catalog_id
  and child.is_global = true
where parent.id <> child.id
on conflict (parent_place_id, child_place_id) do update set
  relation_type = excluded.relation_type,
  confidence = excluded.confidence,
  notes = excluded.notes;

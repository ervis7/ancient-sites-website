import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const downloadsRoot = "C:/Users/E.GUPI/Downloads";
const monumentsPath = path.join(downloadsRoot, "monuments_seed_cleaned_217.json");
const catalogPath = path.join(repoRoot, "app/browse/catalog.generated.ts");
const outputPath = path.join(repoRoot, "supabase/migrations/032_lists_filters_and_place_relationships.sql");

const manualMappings = {
  "temple-of-poseidon-sounion": 63,
  gortyna: 112,
  "ancient-thebes-kadmeia": 38,
  pella: 18,
  dion: 67,
  amphipolis: 27,
  "theatre-of-dionysus-athens": 9,
  "ancient-falasarna": 121,
  "nymphaion-mieza-school-aristotle": 50,
  "galerian-complex-thessaloniki": 2,
  "ancient-europos": 19,
  "ancient-aigeira-theatre": 189,
  dodona: 97,
  sesklo: 98,
  dimini: 99,
  "akrotiri-thera": 115,
  kerameikos: 21,
  "asklipieio-akropolis": 13,
  "iero-afroditis-stin-iera-odo": 35,
  "archaia-asini": 106,
  "mykinaiki-gefyra-kazarmas-arkadikoy": 43,
  "archaios-feneos": 6,
  "iero-despoinas-sti-lykosoyra": 30,
  lato: 86,
  goyrnia: 90,
  driros: 87,
  palaikastro: 118,
  kommos: 126,
  "iero-kaveiron-thivas": 77,
  "iero-moyson-stin-koilada-ton-moyson": 33,
  orraon: 80,
  "tropaio-epameinonda-sta-leyktra": 62,
  "archaia-dystos": 205,
  "archaia-kymisala": 163,
  "ifaistia-limnoy": 117,
  "ancient-potidaea": 179,
  "ancient-itanos": 119,
  "pangaion-avgo-peak": 1,
};

function readCatalog() {
  const text = fs.readFileSync(catalogPath, "utf8");
  const marker = "export const catalogPlaces: AncientPlace[] = ";
  return JSON.parse(text.slice(text.indexOf(marker) + marker.length, text.lastIndexOf(";"))).map((place) => ({
    ...place,
    catalogId: place.id - 100000,
  }));
}

function normalize(value) {
  return String(value ?? "")
    .toLocaleLowerCase("el-GR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ignoredTokens = new Set([
  "της",
  "του",
  "των",
  "στο",
  "στη",
  "στην",
  "στα",
  "στις",
  "και",
  "αρχαια",
  "αρχαιολογικος",
  "χωρος",
]);

function tokens(value) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1 && !ignoredTokens.has(token)));
}

function jaccard(left, right) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function score(monument, catalogPlace) {
  const titleScore = jaccard(monument.title, catalogPlace.name);
  const areaScore = jaccard(
    `${monument.localArea ?? ""} ${monument.regionalUnit ?? ""}`,
    catalogPlace.location ?? "",
  );
  const exactScore = normalize(monument.title) === normalize(catalogPlace.name) ? 1 : 0;
  return Math.max(exactScore, titleScore * 0.78 + areaScore * 0.22);
}

function buildMappings(monuments, catalog) {
  const used = new Set();
  const mapped = new Map();

  for (const monument of monuments) {
    let catalogPlace = null;
    if (manualMappings[monument.id]) {
      catalogPlace = catalog.find((place) => place.catalogId === manualMappings[monument.id]);
    }

    if (!catalogPlace) {
      const kmlIds = [
        ...(Array.isArray(monument.kmlPlacemarkIds) ? monument.kmlPlacemarkIds : []),
        ...(monument.originalKmlId === undefined ? [] : [monument.originalKmlId]),
      ].filter((id) => !used.has(id));
      catalogPlace = catalog.find((place) => place.catalogId === kmlIds[0]);
    }

    if (!catalogPlace) {
      const exact = catalog.filter(
        (place) => !used.has(place.catalogId) && normalize(place.name) === normalize(monument.title),
      );
      if (exact.length === 1) catalogPlace = exact[0];
    }

    if (!catalogPlace) {
      catalogPlace = catalog
        .filter((place) => !used.has(place.catalogId))
        .map((place) => ({ place, score: score(monument, place) }))
        .sort((left, right) => right.score - left.score)[0]?.place;
    }

    if (!catalogPlace) throw new Error(`No catalog mapping for ${monument.id}`);
    used.add(catalogPlace.catalogId);
    mapped.set(monument.id, catalogPlace.catalogId);
  }

  return mapped;
}

function sqlString(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

const monuments = JSON.parse(fs.readFileSync(monumentsPath, "utf8"));
const catalog = readCatalog();
const idToCatalogId = buildMappings(monuments, catalog);
const titleToId = new Map();

for (const monument of monuments) {
  titleToId.set(normalize(monument.title), monument.id);
  for (const title of monument.connectedMonuments ?? []) {
    if (!titleToId.has(normalize(title))) titleToId.set(normalize(title), "");
  }
}

const normalizedMonuments = monuments.map((monument) => ({
  ...monument,
  normalizedTitle: normalize(monument.title),
}));

function findConnectedId(title) {
  const normalized = normalize(title);
  const exact = normalizedMonuments.find((monument) => monument.normalizedTitle === normalized);
  if (exact) return exact.id;
  const contains = normalizedMonuments.filter(
    (monument) =>
      monument.normalizedTitle.includes(normalized) ||
      normalized.includes(monument.normalizedTitle),
  );
  if (contains.length === 1) return contains[0].id;
  return "";
}

const relationRows = new Map();
for (const monument of monuments) {
  const parentId = idToCatalogId.get(monument.id);
  if (!parentId) continue;

  if (monument.parentMonumentId && idToCatalogId.has(monument.parentMonumentId)) {
    const parentCatalogId = idToCatalogId.get(monument.parentMonumentId);
    const key = `${parentCatalogId}:${parentId}`;
    relationRows.set(key, {
      parentCatalogId,
      childCatalogId: parentId,
      type: "subpoint",
      confidence: monument.dataConfidence || "low",
      notes: `Subpoint from cleaned seed: ${monument.id}`,
    });
  }

  for (const connectedTitle of monument.connectedMonuments ?? []) {
    const connectedId = findConnectedId(connectedTitle);
    if (!connectedId || connectedId === monument.id || !idToCatalogId.has(connectedId)) continue;
    const childCatalogId = idToCatalogId.get(connectedId);
    const key = `${parentId}:${childCatalogId}`;
    if (!relationRows.has(key)) {
      relationRows.set(key, {
        parentCatalogId: parentId,
        childCatalogId,
        type: "connected",
        confidence: monument.dataConfidence || "",
        notes: `Connected monument from cleaned seed: ${connectedTitle}`,
      });
    }
  }
}

const relationValues = [...relationRows.values()]
  .filter((row) => row.parentCatalogId !== row.childCatalogId)
  .sort((left, right) => left.parentCatalogId - right.parentCatalogId || left.childCatalogId - right.childCatalogId)
  .map(
    (row) =>
      `  (${row.parentCatalogId}, ${row.childCatalogId}, ${sqlString(row.type)}, ${sqlString(row.confidence)}, ${sqlString(row.notes)})`,
  );

const sql = `create table if not exists public.user_place_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.user_place_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
${relationValues.join(",\n")}
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
`;

fs.writeFileSync(outputPath, sql, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Relationship rows: ${relationValues.length}`);

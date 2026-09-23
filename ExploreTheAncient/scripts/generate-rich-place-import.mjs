import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const downloadsRoot = "C:/Users/E.GUPI/Downloads";
const monumentsPath = path.join(downloadsRoot, "monuments_seed_cleaned_217.json");
const imagesPath = path.join(downloadsRoot, "monument_images_wikimedia_all_available.json");
const catalogPath = path.join(repoRoot, "app/browse/catalog.generated.ts");
const sqlOutputPath = path.join(repoRoot, "supabase/migrations/031_import_rich_place_details.sql");
const reportOutputPath = path.join(repoRoot, "supabase/migrations/031_import_rich_place_details_report.md");

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCatalog() {
  const text = fs.readFileSync(catalogPath, "utf8");
  const marker = "export const catalogPlaces: AncientPlace[] = ";
  const start = text.indexOf(marker);
  if (start === -1) throw new Error("Could not find catalog export.");
  return JSON.parse(text.slice(start + marker.length, text.lastIndexOf(";"))).map((place) => ({
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

function matchScore(monument, catalogPlace) {
  const titleScore = jaccard(monument.title, catalogPlace.name);
  const areaScore = jaccard(
    `${monument.localArea ?? ""} ${monument.regionalUnit ?? ""}`,
    catalogPlace.location ?? "",
  );
  const exactScore = normalize(monument.title) === normalize(catalogPlace.name) ? 1 : 0;
  return Math.max(exactScore, titleScore * 0.78 + areaScore * 0.22);
}

function sqlString(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function sqlBool(value) {
  return value ? "true" : "false";
}

function sqlTextArray(values) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!items.length) return "ARRAY[]::text[]";
  return `ARRAY[${items.map(sqlString).join(", ")}]::text[]`;
}

function bestCandidates(monument, catalog, used, limit = 5) {
  return catalog
    .filter((place) => !used.has(place.catalogId))
    .map((place) => ({ place, score: matchScore(monument, place) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function makeReport({ method, score, monument, catalogPlace, candidates }) {
  if (method === "manual-review") {
    const alternatives = candidates
      .filter((candidate) => candidate.place.catalogId !== catalogPlace.catalogId)
      .slice(0, 3)
      .map((candidate) => `${candidate.place.catalogId}: ${candidate.place.name} (${candidate.score.toFixed(3)})`)
      .join("; ");
    return [
      `Manual-review import: mapped cleaned monument "${monument.title}" to catalog_id ${catalogPlace.catalogId} "${catalogPlace.name}".`,
      alternatives ? `Alternatives: ${alternatives}.` : "",
    ].filter(Boolean).join(" ");
  }
  return `Imported from cleaned 217 dataset. Match method: ${method}${score ? ` (${score.toFixed(3)})` : ""}.`;
}

const monuments = readJson(monumentsPath);
const imageRecords = readJson(imagesPath);
const catalog = readCatalog();
const imageById = new Map(imageRecords.map((record) => [record.monumentId, record]));
const usedCatalogIds = new Set();
const imports = [];
const manualReviewImports = [];

for (const monument of monuments) {
  let catalogPlace = null;
  let method = "";
  let score = 0;
  let candidates = bestCandidates(monument, catalog, usedCatalogIds);

  if (manualMappings[monument.id]) {
    catalogPlace = catalog.find((place) => place.catalogId === manualMappings[monument.id]);
    method = "manual-review";
    score = catalogPlace ? matchScore(monument, catalogPlace) : 0;
  } else {
    const kmlIds = [
      ...(Array.isArray(monument.kmlPlacemarkIds) ? monument.kmlPlacemarkIds : []),
      ...(monument.originalKmlId === undefined ? [] : [monument.originalKmlId]),
    ].filter((id) => !usedCatalogIds.has(id));
    if (kmlIds.length > 0) {
      catalogPlace = catalog.find((place) => place.catalogId === kmlIds[0]);
      method = "kml-id";
      score = 1;
    }

    if (!catalogPlace) {
      const exactMatches = catalog.filter(
        (place) => !usedCatalogIds.has(place.catalogId) && normalize(place.name) === normalize(monument.title),
      );
      if (exactMatches.length === 1) {
        catalogPlace = exactMatches[0];
        method = "exact-title";
        score = 1;
      }
    }

    if (!catalogPlace) {
      candidates = bestCandidates(monument, catalog, usedCatalogIds);
      if (candidates[0] && candidates[0].score >= 0.62 && (!candidates[1] || candidates[0].score - candidates[1].score >= 0.12)) {
        catalogPlace = candidates[0].place;
        method = "fuzzy";
        score = candidates[0].score;
      }
    }

    if (!catalogPlace) {
      candidates = bestCandidates(monument, catalog, usedCatalogIds);
      if (candidates[0]) {
        catalogPlace = candidates[0].place;
        method = "manual-review";
        score = candidates[0].score;
      }
    }
  }

  if (!catalogPlace) {
    throw new Error(`No catalog mapping for ${monument.id} (${monument.title})`);
  }
  if (usedCatalogIds.has(catalogPlace.catalogId)) {
    throw new Error(`Duplicate catalog_id ${catalogPlace.catalogId} for ${monument.id}`);
  }

  usedCatalogIds.add(catalogPlace.catalogId);
  const image = imageById.get(monument.id);
  const needsManualReview = method === "manual-review" || monument.needsManualReview === true;
  const record = {
    monument,
    catalogPlace,
    image,
    method,
    score,
    needsManualReview,
    report: makeReport({ method, score, monument, catalogPlace, candidates }),
  };
  imports.push(record);
  if (needsManualReview) manualReviewImports.push(record);
}

if (imports.length !== monuments.length) {
  throw new Error(`Expected ${monuments.length} imports, got ${imports.length}`);
}

const sqlRows = imports.map(({ monument, catalogPlace, image, needsManualReview, report }) => {
  const values = [
    catalogPlace.catalogId,
    sqlString(monument.id),
    sqlString(monument.title),
    sqlTextArray(monument.category),
    sqlTextArray(monument.historicalPeriod),
    sqlString(monument.constructionDate),
    sqlString(monument.mainUsePeriod),
    sqlString(monument.destructionOrEnd),
    sqlString(monument.builtBy),
    sqlString(monument.purpose),
    sqlString(monument.description),
    sqlString(monument.useChangedDescription),
    sqlString(monument.accessLevel),
    sqlString(monument.accessDescription),
    sqlString(monument.ancientAffiliation),
    sqlTextArray(monument.connectedMonuments),
    sqlString(monument.imageSuggestion),
    sqlString(monument.dataConfidence),
    sqlBool(needsManualReview),
    sqlString(report),
    sqlTextArray(monument.sourceKeys),
    sqlString(image?.imageUrl ?? ""),
  ];
  return `  (${values.join(", ")})`;
});

const seedHash = crypto.createHash("sha256").update(fs.readFileSync(monumentsPath)).digest("hex");
const imageHash = crypto.createHash("sha256").update(fs.readFileSync(imagesPath)).digest("hex");

const sql = `-- Import rich descriptions and available Wikimedia images from monuments_seed_cleaned_217.
-- Source monuments SHA-256: ${seedHash}
-- Source image map SHA-256: ${imageHash}
-- Total imported records: ${imports.length}
-- Records marked for manual review: ${manualReviewImports.length}

alter table public.places
add column if not exists category text[] not null default '{}',
add column if not exists historical_period text[] not null default '{}',
add column if not exists construction_date text not null default '',
add column if not exists main_use_period text not null default '',
add column if not exists destruction_or_end text not null default '',
add column if not exists built_by text not null default '',
add column if not exists purpose text not null default '',
add column if not exists use_changed_description text not null default '',
add column if not exists access_level text not null default '',
add column if not exists access_description text not null default '',
add column if not exists ancient_affiliation text not null default '',
add column if not exists connected_monuments text[] not null default '{}',
add column if not exists image_suggestion text not null default '',
add column if not exists monument_seed_id text not null default '',
add column if not exists data_confidence text not null default '',
add column if not exists needs_manual_review boolean not null default false,
add column if not exists import_review_report text not null default '',
add column if not exists source_keys text[] not null default '{}';

with incoming (
  catalog_id,
  monument_seed_id,
  title,
  category,
  historical_period,
  construction_date,
  main_use_period,
  destruction_or_end,
  built_by,
  purpose,
  description,
  use_changed_description,
  access_level,
  access_description,
  ancient_affiliation,
  connected_monuments,
  image_suggestion,
  data_confidence,
  needs_manual_review,
  import_review_report,
  source_keys,
  image_url
) as (
values
${sqlRows.join(",\n")}
)
update public.places place
set
  name = case
    when trim(place.name) = '' or place.name = '[χωρίς όνομα]' then incoming.title
    else place.name
  end,
  description = incoming.description,
  category = incoming.category,
  historical_period = incoming.historical_period,
  construction_date = incoming.construction_date,
  main_use_period = incoming.main_use_period,
  destruction_or_end = incoming.destruction_or_end,
  built_by = incoming.built_by,
  purpose = incoming.purpose,
  use_changed_description = incoming.use_changed_description,
  access_level = incoming.access_level,
  access_description = incoming.access_description,
  ancient_affiliation = incoming.ancient_affiliation,
  connected_monuments = incoming.connected_monuments,
  image_suggestion = incoming.image_suggestion,
  monument_seed_id = incoming.monument_seed_id,
  data_confidence = incoming.data_confidence,
  needs_manual_review = incoming.needs_manual_review,
  import_review_report = incoming.import_review_report,
  source_keys = incoming.source_keys,
  image_url = case
    when incoming.image_url <> '' and coalesce(place.image_url, '') = '' then incoming.image_url
    else place.image_url
  end
from incoming
where place.catalog_id = incoming.catalog_id
  and place.is_global = true;
`;

const report = `# Rich Place Import Report

Generated from \`monuments_seed_cleaned_217.json\` and \`monument_images_wikimedia_all_available.json\`.

- Imported records: ${imports.length}
- Wikimedia images available and mapped: ${imports.filter((item) => item.image).length}
- Records marked for manual review: ${manualReviewImports.length}
- Source monuments SHA-256: \`${seedHash}\`
- Source image map SHA-256: \`${imageHash}\`

## Manual Review Records

${manualReviewImports.map(({ monument, catalogPlace, report }) => `- \`${monument.id}\` → catalog_id \`${catalogPlace.catalogId}\` (${catalogPlace.name}): ${report}`).join("\n")}
`;

fs.writeFileSync(sqlOutputPath, sql, "utf8");
fs.writeFileSync(reportOutputPath, report, "utf8");

console.log(`Wrote ${sqlOutputPath}`);
console.log(`Wrote ${reportOutputPath}`);
console.log(`Imported records: ${imports.length}`);
console.log(`Manual review records: ${manualReviewImports.length}`);
console.log(`Images mapped: ${imports.filter((item) => item.image).length}`);

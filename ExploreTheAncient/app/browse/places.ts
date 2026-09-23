import { catalogPlaces } from "./catalog.generated";

export type Region = {
  id: string;
  name: string;
  image: string;
};

export type Nomos = {
  id: string;
  regionId: string;
  name: string;
  image: string;
};

export type AncientPlace = {
  id: number;
  nomosId: string;
  name: string;
  location: string;
  altitude: string;
  image: string;
  description: string;
  latitude: string;
  longitude: string;
  visited: boolean;
  visitDate: string;
  visitPhoto: string;
};

export type PlacesData = {
  regions: Region[];
  nomoi: Nomos[];
  places: AncientPlace[];
};

export const initialRegions: Region[] = [
  { id: "attiki", name: "Αττική", image: "" },
  { id: "sterea-ellada", name: "Στερεά Ελλάδα", image: "" },
  { id: "kentriki-makedonia", name: "Κεντρική Μακεδονία", image: "" },
  { id: "kriti", name: "Κρήτη", image: "" },
  { id: "anatoliki-makedonia-thraki", name: "Ανατολική Μακεδονία και Θράκη", image: "" },
  { id: "ipeiros", name: "Ήπειρος", image: "" },
  { id: "ionia-nisia", name: "Ιόνια Νησιά", image: "" },
  { id: "voreio-aigaio", name: "Βόρειο Αιγαίο", image: "" },
  { id: "peloponnisos", name: "Πελοπόννησος", image: "" },
  { id: "notio-aigaio", name: "Νότιο Αιγαίο", image: "" },
  { id: "thessalia", name: "Θεσσαλία", image: "" },
  { id: "dytiki-ellada", name: "Δυτική Ελλάδα", image: "" },
  { id: "dytiki-makedonia", name: "Δυτική Μακεδονία", image: "" },
  { id: "ektos-elladas", name: "Εκτός Ελλάδας", image: "" },
];

const nomosNames = [
  ["aitoloakarnania", "Αιτωλοακαρνανίας"],
  ["argolida", "Αργολίδας"],
  ["arkadia", "Αρκαδίας"],
  ["arta", "Άρτας"],
  ["attiki-athina", "Αθηνών"],
  ["attiki-anatoliki", "Ανατολικής Αττικής"],
  ["attiki-dytiki", "Δυτικής Αττικής"],
  ["attiki-peiraias", "Πειραιώς"],
  ["achaia", "Αχαΐας"],
  ["voiotia", "Βοιωτίας"],
  ["grevena", "Γρεβενών"],
  ["drama", "Δράμας"],
  ["dodekanisa", "Δωδεκανήσου"],
  ["evros", "Έβρου"],
  ["evrytania", "Ευρυτανίας"],
  ["evvoia", "Εύβοιας"],
  ["zakynthos", "Ζακύνθου"],
  ["ileia", "Ηλείας"],
  ["imathia", "Ημαθίας"],
  ["irakleio", "Ηρακλείου"],
  ["thesprotia", "Θεσπρωτίας"],
  ["thessaloniki", "Θεσσαλονίκης"],
  ["ioannina", "Ιωαννίνων"],
  ["kavala", "Καβάλας"],
  ["karditsa", "Καρδίτσας"],
  ["kastoria", "Καστοριάς"],
  ["kerkira", "Κέρκυρας"],
  ["kefalonia", "Κεφαλληνίας"],
  ["kilkis", "Κιλκίς"],
  ["kozani", "Κοζάνης"],
  ["korinthia", "Κορινθίας"],
  ["kyklades", "Κυκλάδων"],
  ["lakonia", "Λακωνίας"],
  ["larisa", "Λάρισας"],
  ["lasithi", "Λασιθίου"],
  ["lefkas", "Λευκάδας"],
  ["lesvos", "Λέσβου"],
  ["magnisia", "Μαγνησίας"],
  ["messinia", "Μεσσηνίας"],
  ["xanthi", "Ξάνθης"],
  ["pella", "Πέλλας"],
  ["pieria", "Πιερίας"],
  ["preveza", "Πρέβεζας"],
  ["rethymno", "Ρεθύμνης"],
  ["rodopi", "Ροδόπης"],
  ["samos", "Σάμου"],
  ["serres", "Σερρών"],
  ["trikala", "Τρικάλων"],
  ["fthiotida", "Φθιώτιδας"],
  ["florina", "Φλώρινας"],
  ["fokida", "Φωκίδας"],
  ["chalkidiki", "Χαλκιδικής"],
  ["chania", "Χανίων"],
  ["chios", "Χίου"],
  ["mikra-asia-tourkia", "Μικρά Ασία / Τουρκία"],
] as const;

const regionByNomosId: Record<string, string> = {
  "attiki-athina": "attiki", "attiki-anatoliki": "attiki",
  "attiki-dytiki": "attiki", "attiki-peiraias": "attiki",
  voiotia: "sterea-ellada", evvoia: "sterea-ellada",
  evrytania: "sterea-ellada", fthiotida: "sterea-ellada", fokida: "sterea-ellada",
  imathia: "kentriki-makedonia", thessaloniki: "kentriki-makedonia",
  kilkis: "kentriki-makedonia", pella: "kentriki-makedonia",
  pieria: "kentriki-makedonia", serres: "kentriki-makedonia",
  chalkidiki: "kentriki-makedonia",
  irakleio: "kriti", lasithi: "kriti", rethymno: "kriti", chania: "kriti",
  drama: "anatoliki-makedonia-thraki", evros: "anatoliki-makedonia-thraki",
  kavala: "anatoliki-makedonia-thraki", rodopi: "anatoliki-makedonia-thraki",
  xanthi: "anatoliki-makedonia-thraki",
  arta: "ipeiros", thesprotia: "ipeiros", ioannina: "ipeiros", preveza: "ipeiros",
  zakynthos: "ionia-nisia", kerkira: "ionia-nisia",
  kefalonia: "ionia-nisia", lefkas: "ionia-nisia",
  lesvos: "voreio-aigaio", samos: "voreio-aigaio", chios: "voreio-aigaio",
  argolida: "peloponnisos", arkadia: "peloponnisos",
  korinthia: "peloponnisos", lakonia: "peloponnisos", messinia: "peloponnisos",
  dodekanisa: "notio-aigaio", kyklades: "notio-aigaio",
  karditsa: "thessalia", larisa: "thessalia",
  magnisia: "thessalia", trikala: "thessalia",
  aitoloakarnania: "dytiki-ellada", achaia: "dytiki-ellada", ileia: "dytiki-ellada",
  grevena: "dytiki-makedonia", kastoria: "dytiki-makedonia",
  kozani: "dytiki-makedonia", florina: "dytiki-makedonia",
  "mikra-asia-tourkia": "ektos-elladas",
};

export const initialNomoi: Nomos[] = nomosNames.map(([id, name]) => ({
  id,
  regionId: regionByNomosId[id],
  name,
  image: "",
}));

export const initialPlaces: AncientPlace[] = catalogPlaces;

export const initialData: PlacesData = {
  regions: initialRegions,
  nomoi: initialNomoi,
  places: initialPlaces,
};

export const placesStorageKey = "explore-the-ancients-data";
const legacyStorageKey = "explore-the-ancients-places";
const catalogStorageKey = "explore-the-ancients-catalog-version";
const catalogVersion = "1";

type PlacesSaveFile = {
  version: 3;
  exportedAt: string;
  regions: Region[];
  nomoi: Partial<Nomos>[];
  places: Partial<AncientPlace>[];
};

export function createEmptyPlace(id: number, nomosId = ""): AncientPlace {
  return {
    id,
    nomosId,
    name: "",
    location: "",
    altitude: "",
    image: "",
    description: "",
    latitude: "",
    longitude: "",
    visited: false,
    visitDate: "",
    visitPhoto: "",
  };
}

export function createEmptyNomos(id: string): Nomos {
  return { id, regionId: "", name: "", image: "" };
}

export function readData(): PlacesData {
  const storedData = window.localStorage.getItem(placesStorageKey);

  if (storedData) {
    try {
      const stored = normalizeData(JSON.parse(storedData));
      if (window.localStorage.getItem(catalogStorageKey) === catalogVersion) {
        return stored;
      }

      const knownPlaceIds = new Set(stored.places.map((place) => place.id));
      const withCatalog = {
        regions: [
          ...stored.regions,
          ...initialRegions.filter(
            (region) => !stored.regions.some((item) => item.id === region.id),
          ),
        ],
        nomoi: [
          ...stored.nomoi,
          ...initialNomoi.filter(
            (nomos) => !stored.nomoi.some((item) => item.id === nomos.id),
          ),
        ],
        places: [
          ...stored.places,
          ...catalogPlaces.filter((place) => !knownPlaceIds.has(place.id)),
        ],
      };
      saveData(withCatalog);
      return withCatalog;
    } catch {
      return initialData;
    }
  }

  const legacyPlaces = window.localStorage.getItem(legacyStorageKey);
  if (legacyPlaces) {
    try {
      const migrated = {
        regions: initialRegions,
        nomoi: initialNomoi,
        places: normalizePlaces(JSON.parse(legacyPlaces), "fokida"),
      };
      saveData(migrated);
      return migrated;
    } catch {
      return initialData;
    }
  }

  return initialData;
}

export function saveData(data: PlacesData) {
  window.localStorage.setItem(placesStorageKey, JSON.stringify(data));
  window.localStorage.setItem(catalogStorageKey, catalogVersion);
}

export function readPlaces(): AncientPlace[] {
  return readData().places;
}

export function savePlaces(places: AncientPlace[]) {
  const data = readData();
  saveData({ ...data, places });
}

function normalizeNomoi(value: unknown): Nomos[] {
  if (!Array.isArray(value)) {
    throw new Error("The save file does not contain a prefecture list.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Prefecture ${index + 1} is invalid.`);
    }
    const nomos = item as Partial<Nomos>;
    const name = typeof nomos.name === "string" ? nomos.name : "";
    const isEptanisa = name.trim().toLocaleLowerCase("el-GR") === "επτάνησα";
    return {
      id: typeof nomos.id === "string" ? nomos.id : `nomos-${Date.now()}-${index}`,
      regionId: isEptanisa
        ? "ionia-nisia"
        : typeof nomos.regionId === "string"
          ? nomos.regionId
          : regionByNomosId[nomos.id ?? ""] ?? "",
      name,
      image: typeof nomos.image === "string" ? nomos.image : "",
    };
  });
}

function normalizePlaces(value: unknown, fallbackNomosId = ""): AncientPlace[] {
  if (!Array.isArray(value)) {
    throw new Error("The save file does not contain a places list.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Place ${index + 1} is invalid.`);
    }
    const place = item as Partial<AncientPlace>;
    return {
      ...createEmptyPlace(
        typeof place.id === "number" ? place.id : Date.now() + index,
        typeof place.nomosId === "string" ? place.nomosId : fallbackNomosId,
      ),
      name: typeof place.name === "string" ? place.name : "",
      location: typeof place.location === "string" ? place.location : "",
      altitude: typeof place.altitude === "string" ? place.altitude : "",
      image: typeof place.image === "string" ? place.image : "",
      description: typeof place.description === "string" ? place.description : "",
      latitude: typeof place.latitude === "string" ? place.latitude : "",
      longitude: typeof place.longitude === "string" ? place.longitude : "",
      visited: place.visited === true,
      visitDate: typeof place.visitDate === "string" ? place.visitDate : "",
      visitPhoto: typeof place.visitPhoto === "string" ? place.visitPhoto : "",
    };
  });
}

function normalizeData(value: unknown): PlacesData {
  if (!value || typeof value !== "object") {
    throw new Error("This is not valid places data.");
  }
  const data = value as Partial<PlacesData>;
  return {
    regions: Array.isArray(data.regions)
      ? data.regions.map((region, index) => {
          const item = region as Partial<Region>;
          return {
            id: typeof item.id === "string" ? item.id : `region-${index}`,
            name: typeof item.name === "string" ? item.name : "",
            image: typeof item.image === "string" ? item.image : "",
          };
        })
      : initialRegions,
    nomoi: normalizeNomoi(data.nomoi),
    places: normalizePlaces(data.places),
  };
}

export function createSaveFile(data: PlacesData): PlacesSaveFile {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    regions: data.regions,
    nomoi: data.nomoi,
    places: data.places,
  };
}

export function parseSaveFile(contents: string): PlacesData {
  const parsed = JSON.parse(contents) as unknown;

  if (Array.isArray(parsed)) {
    return {
      regions: initialRegions,
      nomoi: initialNomoi,
      places: normalizePlaces(parsed, "fokida"),
    };
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("This is not a valid places save file.");
  }

  const saveFile = parsed as {
    version?: unknown;
    regions?: unknown;
    nomoi?: unknown;
    places?: unknown;
  };
  if (saveFile.version === 1) {
    return {
      regions: initialRegions,
      nomoi: initialNomoi,
      places: normalizePlaces(saveFile.places, "fokida"),
    };
  }
  if (saveFile.version === 2) {
    return normalizeData({ ...saveFile, regions: initialRegions });
  }
  if (saveFile.version !== 3) {
    throw new Error("This save-file version is not supported.");
  }

  return normalizeData(saveFile);
}

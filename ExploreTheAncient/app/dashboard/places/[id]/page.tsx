import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlaceDetailView from "./PlaceDetailView";

const basePlaceSelect =
  "id,user_id,is_global,nomos_id,name,location,altitude,description,image_url,latitude,longitude,visibility";
const richPlaceSelect =
  "id,user_id,is_global,nomos_id,name,location,altitude,description,category,historical_period,construction_date,main_use_period,destruction_or_end,built_by,purpose,use_changed_description,access_level,access_description,ancient_affiliation,connected_monuments,image_suggestion,monument_seed_id,data_confidence,needs_manual_review,import_review_report,source_keys,image_url,latitude,longitude,visibility";

const richPlaceDefaults = {
  category: [],
  historical_period: [],
  construction_date: "",
  main_use_period: "",
  destruction_or_end: "",
  built_by: "",
  purpose: "",
  use_changed_description: "",
  access_level: "",
  access_description: "",
  ancient_affiliation: "",
  connected_monuments: [],
  image_suggestion: "",
  monument_seed_id: "",
  data_confidence: "",
  needs_manual_review: false,
  import_review_report: "",
  source_keys: [],
};

function isMissingRichPlaceColumn(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (message.includes("places.") && message.includes("does not exist"))
  );
}

function isMissingOptionalTable(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("Could not find the table")
  );
}

async function selectPlace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const richResult = await supabase
    .from("places")
    .select(richPlaceSelect)
    .eq("id", id)
    .maybeSingle();

  if (!richResult.error || !isMissingRichPlaceColumn(richResult.error)) {
    return richResult;
  }

  const baseResult = await supabase
    .from("places")
    .select(basePlaceSelect)
    .eq("id", id)
    .maybeSingle();

  return {
    ...baseResult,
    data: baseResult.data ? { ...richPlaceDefaults, ...baseResult.data } : null,
  };
}

async function selectRelatedPlaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const { data: relationships, error } = await supabase
    .from("place_relationships")
    .select("parent_place_id,child_place_id,relation_type,notes")
    .or(`parent_place_id.eq.${id},child_place_id.eq.${id}`);

  if (error) {
    if (isMissingOptionalTable(error)) {
      return { parentPlaces: [], childPlaces: [] };
    }
    throw new Error(error.message);
  }

  const relatedIds = Array.from(
    new Set(
      (relationships ?? []).map((relationship) =>
        relationship.parent_place_id === id
          ? relationship.child_place_id
          : relationship.parent_place_id,
      ),
    ),
  );

  if (!relatedIds.length) {
    return { parentPlaces: [], childPlaces: [] };
  }

  const { data: relatedPlaces, error: relatedError } = await supabase
    .from("places")
    .select("id,name,location,image_url")
    .in("id", relatedIds);

  if (relatedError) throw new Error(relatedError.message);

  const placesById = new Map((relatedPlaces ?? []).map((place) => [place.id, place]));
  const parentPlaces = [];
  const childPlaces = [];

  for (const relationship of relationships ?? []) {
    const isParent = relationship.parent_place_id === id;
    const relatedId = isParent
      ? relationship.child_place_id
      : relationship.parent_place_id;
    const relatedPlace = placesById.get(relatedId);
    if (!relatedPlace) continue;
    const summary = {
      ...relatedPlace,
      relation_type: relationship.relation_type,
      notes: relationship.notes,
    };
    if (isParent) {
      childPlaces.push(summary);
    } else {
      parentPlaces.push(summary);
    }
  }

  return { parentPlaces, childPlaces };
}

export default async function PrivatePlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const [{ data: place, error }, relatedPlaces] = await Promise.all([
    selectPlace(supabase, id),
    selectRelatedPlaces(supabase, id),
  ]);

  if (error) throw new Error(error.message);
  if (!place) notFound();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.user.id)
    .maybeSingle();

  return (
    <PlaceDetailView
      place={place}
      relatedPlaces={relatedPlaces}
      canEdit={profile?.is_admin === true && place.is_global === true}
    />
  );
}

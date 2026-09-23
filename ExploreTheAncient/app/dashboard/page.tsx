import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrivateBrowse from "./PrivateBrowse";

const basePlaceSelect =
  "id,user_id,catalog_id,is_global,nomos_id,name,location,altitude,description,image_url,latitude,longitude,visited,visit_date,visit_photo,visibility";
const richPlaceSelect =
  "id,user_id,catalog_id,is_global,nomos_id,name,location,altitude,description,category,historical_period,construction_date,main_use_period,destruction_or_end,built_by,purpose,use_changed_description,access_level,access_description,ancient_affiliation,connected_monuments,image_suggestion,monument_seed_id,data_confidence,needs_manual_review,import_review_report,source_keys,image_url,latitude,longitude,visited,visit_date,visit_photo,visibility";

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
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    message.includes("Could not find the table")
  );
}

const FAVORITES_LIST_NAME = "Αγαπημένα";

async function ensureDashboardFavoritesList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const byFlag = await supabase
    .from("user_place_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_favorites", true)
    .maybeSingle();

  if (byFlag.data?.id || isMissingOptionalTable(byFlag.error)) return;
  if (byFlag.error) throw new Error(byFlag.error.message);

  const byName = await supabase
    .from("user_place_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("name", FAVORITES_LIST_NAME)
    .maybeSingle();

  if (byName.data?.id) {
    const { error } = await supabase
      .from("user_place_lists")
      .update({ is_favorites: true })
      .eq("id", byName.data.id);
    if (error && !isMissingOptionalTable(error)) throw new Error(error.message);
    return;
  }
  if (isMissingOptionalTable(byName.error)) return;
  if (byName.error) throw new Error(byName.error.message);

  const { error } = await supabase.from("user_place_lists").insert({
    user_id: userId,
    name: FAVORITES_LIST_NAME,
    is_favorites: true,
  });
  if (error && !isMissingOptionalTable(error) && error.code !== "23505") {
    throw new Error(error.message);
  }
}

async function selectDashboardPlaces(supabase: Awaited<ReturnType<typeof createClient>>) {
  const richResult = await supabase
    .from("places")
    .select(richPlaceSelect)
    .order("created_at", { ascending: false });

  if (!richResult.error || !isMissingRichPlaceColumn(richResult.error)) {
    return richResult;
  }

  const baseResult = await supabase
    .from("places")
    .select(basePlaceSelect)
    .order("created_at", { ascending: false });

  return {
    ...baseResult,
    data: baseResult.data?.map((place) => ({ ...richPlaceDefaults, ...place })),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");
  await ensureDashboardFavoritesList(supabase, authData.user.id);

  const [
    { data: profile },
    { data: places, error },
    { data: friends },
    { data: requests },
    { data: nomosPreferences },
    { data: regionPreferences },
    { data: pointActivity },
    { data: sharedVisits },
    favoriteResult,
    listResult,
    listItemResult,
    { data: reactionNotifications },
    { data: regionVisitRankings },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,username,bio,location,website,profile_gif_url,avatar_url,background_url,is_admin,points,presence_state,last_seen")
      .eq("id", authData.user.id)
      .maybeSingle(),
    selectDashboardPlaces(supabase),
    supabase.rpc("get_friend_list"),
    supabase.rpc("get_pending_friend_requests"),
    supabase
      .from("global_nomoi")
      .select("nomos_id,display_name,image_url"),
    supabase
      .from("global_regions")
      .select("region_id,display_name,image_url"),
    supabase.rpc("get_friend_point_activity"),
    supabase
      .from("place_visits")
      .select("place_id,visit_date,visit_photo,visit_note")
      .eq("user_id", authData.user.id),
    supabase
      .from("user_place_favorites")
      .select("place_id")
      .eq("user_id", authData.user.id),
    supabase
      .from("user_place_lists")
      .select("*")
      .eq("user_id", authData.user.id)
      .order("is_favorites", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("user_place_list_items")
      .select("list_id,place_id"),
    supabase.rpc("get_reaction_notifications"),
    supabase.rpc("get_region_visit_rankings"),
  ]);
  if (error) throw new Error(error.message);
  if (favoriteResult.error && !isMissingOptionalTable(favoriteResult.error)) {
    throw new Error(favoriteResult.error.message);
  }
  if (listResult.error && !isMissingOptionalTable(listResult.error)) {
    throw new Error(listResult.error.message);
  }
  if (listItemResult.error && !isMissingOptionalTable(listItemResult.error)) {
    throw new Error(listItemResult.error.message);
  }

  const favoritePlaceIds = new Set(
    (favoriteResult.data ?? []).map((favorite) => favorite.place_id),
  );
  const favoritesListId = (listResult.data ?? []).find(
    (list) => list.is_favorites === true || list.name === FAVORITES_LIST_NAME,
  )?.id;
  const listIdsByPlace = new Map<string, string[]>();
  for (const item of listItemResult.data ?? []) {
    const nextListIds = listIdsByPlace.get(item.place_id) ?? [];
    nextListIds.push(item.list_id);
    listIdsByPlace.set(item.place_id, nextListIds);
  }
  if (favoritesListId) {
    for (const placeId of favoritePlaceIds) {
      const nextListIds = listIdsByPlace.get(placeId) ?? [];
      if (!nextListIds.includes(favoritesListId)) nextListIds.push(favoritesListId);
      listIdsByPlace.set(placeId, nextListIds);
    }
  }

  const hydratedPlaces = (places ?? []).map((place) => {
    const placeListState = {
      is_favorite: favoritePlaceIds.has(place.id),
      list_ids: listIdsByPlace.get(place.id) ?? [],
    };
    if (!place.is_global && place.user_id === authData.user.id) {
      return { ...place, ...placeListState, visit_note: "" };
    }
    const visit = (sharedVisits ?? []).find((item) => item.place_id === place.id);
    return {
      ...place,
      ...placeListState,
      visited: Boolean(visit),
      visit_date: visit?.visit_date ?? null,
      visit_photo: visit?.visit_photo ?? "",
      visit_note: visit?.visit_note ?? "",
    };
  });

  // Each account owns an editable copy of the starter catalog. Public copies
  // from friends can therefore share the same catalog_id. Show one card for
  // each catalog entry and prefer the current user's copy.
  const ownCatalogIds = new Set(
    hydratedPlaces
      .filter(
        (place) =>
          place.user_id === authData.user.id && place.catalog_id !== null,
      )
      .map((place) => place.catalog_id),
  );
  const visibleCatalogIds = new Set<number>();
  const deduplicatedPlaces = hydratedPlaces.filter((place) => {
    if (place.catalog_id === null) return true;
    if (
      place.user_id !== authData.user.id &&
      ownCatalogIds.has(place.catalog_id)
    ) {
      return false;
    }
    if (visibleCatalogIds.has(place.catalog_id)) return false;
    visibleCatalogIds.add(place.catalog_id);
    return true;
  });

  return (
    <PrivateBrowse
      email={authData.user.email ?? ""}
      userId={authData.user.id}
      profile={{
        fullName: profile?.full_name ?? "",
        username: profile?.username ?? "",
        bio: profile?.bio ?? "",
        location: profile?.location ?? "",
        website: profile?.website ?? "",
        profileGifUrl: profile?.profile_gif_url ?? "",
        avatarUrl: profile?.avatar_url ?? "",
        backgroundUrl: profile?.background_url ?? "",
        presenceState: profile?.presence_state ?? "offline",
        lastSeen: profile?.last_seen ?? "",
        points: profile?.points ?? 0,
      }}
      isAdmin={profile?.is_admin === true}
      places={deduplicatedPlaces}
      placeLists={listResult.data ?? []}
      friends={friends ?? []}
      requests={requests ?? []}
      nomosPreferences={nomosPreferences ?? []}
      regionPreferences={regionPreferences ?? []}
      pointActivity={pointActivity ?? []}
      notifications={reactionNotifications ?? []}
      regionVisitRankings={regionVisitRankings ?? []}
    />
  );
}

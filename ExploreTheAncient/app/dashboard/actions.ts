"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initialNomoi, initialRegions } from "@/app/browse/places";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function listValue(formData: FormData, key: string) {
  return value(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
    message.includes("Could not find the table") ||
    message.includes("schema cache")
  );
}

const FAVORITES_LIST_NAME = "Αγαπημένα";

function isFavoritesListName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("el-GR");
  return normalized === "αγαπημενα";
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

async function ensureFavoritesList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const byFlag = await supabase
    .from("user_place_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_favorites", true)
    .maybeSingle();

  if (byFlag.data?.id) return byFlag.data.id as string;
  if (byFlag.error && isMissingOptionalTable(byFlag.error)) return null;

  const byName = await supabase
    .from("user_place_lists")
    .select("id,name")
    .eq("user_id", userId)
    .eq("name", FAVORITES_LIST_NAME)
    .maybeSingle();

  if (byName.data?.id) {
    await supabase
      .from("user_place_lists")
      .update({ is_favorites: true })
      .eq("id", byName.data.id);
    return byName.data.id as string;
  }
  if (byName.error && isMissingOptionalTable(byName.error)) return null;

  const created = await supabase
    .from("user_place_lists")
    .insert({
      user_id: userId,
      name: FAVORITES_LIST_NAME,
      is_favorites: true,
    })
    .select("id")
    .single();

  if (created.data?.id) return created.data.id as string;
  if (created.error && isMissingOptionalTable(created.error)) return null;

  const fallback = await supabase
    .from("user_place_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("name", FAVORITES_LIST_NAME)
    .maybeSingle();

  if (fallback.data?.id) return fallback.data.id as string;
  if (created.error && created.error.code !== "23505") {
    throw new Error(created.error.message);
  }
  return null;
}

export async function updatePresence(state: "active" | "away") {
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      presence_state: state,
      last_seen: new Date().toISOString(),
    })
    .eq("id", user.id);
  // Presence is progressive enhancement while migration 021 is being applied.
  // Do not crash the dashboard if PostgREST has not refreshed its schema yet.
  if (error && error.code !== "PGRST204") throw new Error(error.message);
}

export async function markNotificationsRead() {
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function reactToVisit(
  visitUserId: string,
  placeId: string,
  emoji: string,
) {
  const allowedEmoji = [
    "👍",
    "❤️",
    "🔥",
    "😮",
    "😂",
    "👏",
    "🏛️",
    "🗺️",
    "kilian",
  ];
  if (!allowedEmoji.includes(emoji)) {
    throw new Error("Choose one of the available emoji reactions.");
  }
  const { supabase, user } = await authenticatedClient();
  const { data: existing, error: readError } = await supabase
    .from("visit_reactions")
    .select("emoji")
    .eq("visit_user_id", visitUserId)
    .eq("place_id", placeId)
    .eq("reactor_id", user.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const query = supabase.from("visit_reactions");
  const { error } =
    existing?.emoji === emoji
      ? await query
          .delete()
          .eq("visit_user_id", visitUserId)
          .eq("place_id", placeId)
          .eq("reactor_id", user.id)
      : await query.upsert(
          {
            visit_user_id: visitUserId,
            place_id: placeId,
            reactor_id: user.id,
            emoji,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "visit_user_id,place_id,reactor_id" },
        );
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/friends/${visitUserId}`);
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const website = value(formData, "website");
  const profileGifUrl = value(formData, "profileGifUrl");
  const avatarUrl = value(formData, "avatarUrl");
  const backgroundFile = formData.get("profileBackgroundFile");
  let backgroundUrl =
    value(formData, "profileBackgroundUrl") ||
    value(formData, "currentBackgroundUrl");
  if (formData.get("removeProfileBackground") === "on") {
    backgroundUrl = "";
  }
  if (website && !/^https?:\/\//i.test(website)) {
    throw new Error("Website must begin with http:// or https://.");
  }
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    throw new Error("Avatar URL must begin with http:// or https://.");
  }
  if (profileGifUrl && !/^https?:\/\//i.test(profileGifUrl)) {
    throw new Error("GIF URL must begin with http:// or https://.");
  }
  if (
    backgroundUrl &&
    !/^https?:\/\//i.test(backgroundUrl) &&
    !/^data:image\/png;base64,/i.test(backgroundUrl)
  ) {
    throw new Error("Background URL must begin with http:// or https://.");
  }
  if (backgroundFile instanceof File && backgroundFile.size > 0) {
    if (backgroundFile.type !== "image/png") {
      throw new Error("The local profile background must be a PNG image.");
    }
    if (backgroundFile.size > 1_000_000) {
      throw new Error("The profile background must be smaller than 1 MB.");
    }
    backgroundUrl = `data:image/png;base64,${Buffer.from(
      await backgroundFile.arrayBuffer(),
    ).toString("base64")}`;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: value(formData, "fullName"),
      username: value(formData, "username") || null,
      bio: value(formData, "bio"),
      location: value(formData, "profileLocation"),
      website,
      profile_gif_url: profileGifUrl,
      avatar_url: avatarUrl,
      background_url: backgroundUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function createPlace(formData: FormData) {
  const { supabase, user } = await adminClient();
  const nomosId = value(formData, "nomosId");
  const imageFile = formData.get("imageFile");
  let imageUrl = value(formData, "imageUrl");
  if (!initialNomoi.some((nomos) => nomos.id === nomosId)) {
    throw new Error("Please choose an existing folder.");
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Picture URL must begin with http:// or https://.");
  }
  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.type !== "image/png") {
      throw new Error("The uploaded place picture must be a PNG.");
    }
    if (imageFile.size > 1_000_000) {
      throw new Error("The place PNG must be smaller than 1 MB.");
    }
    imageUrl = `data:image/png;base64,${Buffer.from(
      await imageFile.arrayBuffer(),
    ).toString("base64")}`;
  }
  const basePlace = {
    user_id: user.id,
    nomos_id: nomosId,
    name: value(formData, "name"),
    location: value(formData, "location"),
    description: value(formData, "description"),
    altitude: value(formData, "altitude"),
    image_url: imageUrl,
    latitude: value(formData, "latitude") || null,
    longitude: value(formData, "longitude") || null,
    visibility: "public",
    is_global: true,
  };
  const richPlace = {
    ...basePlace,
    category: listValue(formData, "category"),
    historical_period: listValue(formData, "historicalPeriod"),
    construction_date: value(formData, "constructionDate"),
    main_use_period: value(formData, "mainUsePeriod"),
    destruction_or_end: value(formData, "destructionOrEnd"),
    built_by: value(formData, "builtBy"),
    purpose: value(formData, "purpose"),
    use_changed_description: value(formData, "useChangedDescription"),
    access_level: value(formData, "accessLevel"),
    access_description: value(formData, "accessDescription"),
    ancient_affiliation: value(formData, "ancientAffiliation"),
    connected_monuments: listValue(formData, "connectedMonuments"),
    image_suggestion: value(formData, "imageSuggestion"),
  };
  const { error } = await supabase.from("places").insert(richPlace);
  if (error && isMissingRichPlaceColumn(error)) {
    const { error: fallbackError } = await supabase.from("places").insert(basePlace);
    if (fallbackError) throw new Error(fallbackError.message);
    revalidatePath("/dashboard");
    return;
  }
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function toggleFavoritePlace(placeId: string, shouldFavorite: boolean) {
  const { supabase, user } = await authenticatedClient();
  const favoriteListId = await ensureFavoritesList(supabase, user.id);
  const { error } = shouldFavorite
    ? await supabase.from("user_place_favorites").upsert({
        user_id: user.id,
        place_id: placeId,
      })
    : await supabase
        .from("user_place_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", placeId);
  if (error && !isMissingOptionalTable(error)) {
    throw new Error(error.message);
  }

  if (favoriteListId) {
    const listItemResult = shouldFavorite
      ? await supabase.from("user_place_list_items").upsert({
          list_id: favoriteListId,
          place_id: placeId,
        })
      : await supabase
          .from("user_place_list_items")
          .delete()
          .eq("list_id", favoriteListId)
          .eq("place_id", placeId);

    if (listItemResult.error && !isMissingOptionalTable(listItemResult.error)) {
      throw new Error(listItemResult.error.message);
    }
  }

  revalidatePath("/dashboard");
}

export async function createPlaceList(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const name = value(formData, "listName");
  if (!name) throw new Error("List name is required.");
  if (isFavoritesListName(name)) {
    await ensureFavoritesList(supabase, user.id);
    revalidatePath("/dashboard");
    return;
  }
  const { error } = await supabase.from("user_place_lists").insert({
    user_id: user.id,
    name,
  });
  if (isMissingOptionalTable(error)) return;
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function addPlaceToList(placeId: string, formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const listId = value(formData, "listId");
  if (!listId) return;
  const { error } = await supabase.from("user_place_list_items").upsert({
    list_id: listId,
    place_id: placeId,
  });
  if (isMissingOptionalTable(error)) return;
  if (error) throw new Error(error.message);

  const { data: list } = await supabase
    .from("user_place_lists")
    .select("name,is_favorites")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (list?.is_favorites || isFavoritesListName(list?.name ?? "")) {
    const { error: favoriteError } = await supabase.from("user_place_favorites").upsert({
      user_id: user.id,
      place_id: placeId,
    });
    if (favoriteError && !isMissingOptionalTable(favoriteError)) {
      throw new Error(favoriteError.message);
    }
  }

  revalidatePath("/dashboard");
}

export async function setPlaceListMembership(
  placeId: string,
  listId: string,
  formData: FormData,
) {
  const { supabase, user } = await authenticatedClient();
  const shouldInclude = formData.get("include") === "on";
  const { data: list, error: listError } = await supabase
    .from("user_place_lists")
    .select("id,name,is_favorites")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (isMissingOptionalTable(listError)) return;
  if (listError) throw new Error(listError.message);
  if (!list) return;

  const result = shouldInclude
    ? await supabase.from("user_place_list_items").upsert({
        list_id: listId,
        place_id: placeId,
      })
    : await supabase
        .from("user_place_list_items")
        .delete()
        .eq("list_id", listId)
        .eq("place_id", placeId);

  if (isMissingOptionalTable(result.error)) return;
  if (result.error) throw new Error(result.error.message);

  if (list.is_favorites || isFavoritesListName(list.name ?? "")) {
    const favoriteResult = shouldInclude
      ? await supabase.from("user_place_favorites").upsert({
          user_id: user.id,
          place_id: placeId,
        })
      : await supabase
          .from("user_place_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("place_id", placeId);

    if (favoriteResult.error && !isMissingOptionalTable(favoriteResult.error)) {
      throw new Error(favoriteResult.error.message);
    }
  }

  revalidatePath("/dashboard");
}

export async function removePlaceFromList(listId: string, placeId: string) {
  const { supabase, user } = await authenticatedClient();
  const { data: list } = await supabase
    .from("user_place_lists")
    .select("name,is_favorites")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (list?.is_favorites || isFavoritesListName(list?.name ?? "")) {
    const { error: favoriteError } = await supabase
      .from("user_place_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("place_id", placeId);
    if (favoriteError && !isMissingOptionalTable(favoriteError)) {
      throw new Error(favoriteError.message);
    }
  }

  const { error } = await supabase
    .from("user_place_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("place_id", placeId);
  if (isMissingOptionalTable(error)) return;
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function updatePlace(id: string, formData: FormData) {
  const { supabase } = await adminClient();
  const basePlace = {
    name: value(formData, "name"),
    location: value(formData, "location"),
    description: value(formData, "description"),
    altitude: value(formData, "altitude"),
    image_url: value(formData, "imageUrl"),
    nomos_id: value(formData, "nomosId"),
    latitude: value(formData, "latitude") || null,
    longitude: value(formData, "longitude") || null,
    visibility: "public",
  };
  const richPlace = {
    ...basePlace,
    category: listValue(formData, "category"),
    historical_period: listValue(formData, "historicalPeriod"),
    construction_date: value(formData, "constructionDate"),
    main_use_period: value(formData, "mainUsePeriod"),
    destruction_or_end: value(formData, "destructionOrEnd"),
    built_by: value(formData, "builtBy"),
    purpose: value(formData, "purpose"),
    use_changed_description: value(formData, "useChangedDescription"),
    access_level: value(formData, "accessLevel"),
    access_description: value(formData, "accessDescription"),
    ancient_affiliation: value(formData, "ancientAffiliation"),
    connected_monuments: listValue(formData, "connectedMonuments"),
    image_suggestion: value(formData, "imageSuggestion"),
  };
  const { error } = await supabase
    .from("places")
    .update(richPlace)
    .eq("id", id)
    .eq("is_global", true);
  if (error && isMissingRichPlaceColumn(error)) {
    const { error: fallbackError } = await supabase
      .from("places")
      .update(basePlace)
      .eq("id", id)
      .eq("is_global", true);
    if (fallbackError) throw new Error(fallbackError.message);
    revalidatePath("/dashboard");
    const returnTo = value(formData, "returnTo");
    redirect(
      returnTo.startsWith("/dashboard/places/")
        ? returnTo
        : "/dashboard",
    );
  }
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  const returnTo = value(formData, "returnTo");
  redirect(
    returnTo.startsWith("/dashboard/places/")
      ? returnTo
      : "/dashboard",
  );
}

export async function markVisited(id: string, formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const photo = formData.get("visitPhoto");
  const visitDate = value(formData, "visitDate");
  const visitVisibility =
    value(formData, "visitVisibility") === "public" ? "public" : "private";
  const visitNote = value(formData, "visitNote").slice(0, 500);

  if (!(photo instanceof File) || !photo.type.startsWith("image/") || !visitDate) {
    throw new Error("A visit date and image are required.");
  }
  if (photo.size > 750_000) {
    throw new Error("The visit image must be smaller than 750 KB.");
  }

  const encodedPhoto = `data:${photo.type};base64,${Buffer.from(
    await photo.arrayBuffer(),
  ).toString("base64")}`;
  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("user_id,is_global")
    .eq("id", id)
    .maybeSingle();
  if (placeError) throw new Error(placeError.message);
  if (!place) throw new Error("Place not found.");

  if (place.is_global || place.user_id !== user.id) {
    const { error } = await supabase.from("place_visits").upsert({
      user_id: user.id,
      place_id: id,
      visit_date: visitDate,
      visit_photo: encodedPhoto,
      visibility: visitVisibility,
      visit_note: visitNote,
    }, { onConflict: "user_id,place_id" });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return;
  }

  const { error } = await supabase
    .from("places")
    .update({
      visited: true,
      visit_date: visitDate,
      visit_photo: encodedPhoto,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function clearVisited(id: string) {
  const { supabase, user } = await authenticatedClient();
  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("user_id,is_global")
    .eq("id", id)
    .maybeSingle();
  if (placeError) throw new Error(placeError.message);
  if (!place) throw new Error("Place not found.");

  if (place.is_global || place.user_id !== user.id) {
    const { error } = await supabase
      .from("place_visits")
      .delete()
      .eq("user_id", user.id)
      .eq("place_id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return;
  }

  const { error } = await supabase
    .from("places")
    .update({ visited: false, visit_date: null, visit_photo: "" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function deletePlace(id: string) {
  const { supabase } = await adminClient();
  const { error } = await supabase
    .from("places")
    .delete()
    .eq("id", id)
    .eq("is_global", true);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export type FriendRequestFormState = {
  error: string | null;
  success: string | null;
};

export type DashboardImportState = { message: string };

export async function importDashboardSave(
  _previousState: DashboardImportState,
  formData: FormData,
): Promise<DashboardImportState> {
  const file = formData.get("saveFile");
  if (!(file instanceof File) || !file.size) return { message: "Choose a JSON save file." };

  try {
    const parsed = JSON.parse(await file.text()) as {
      version?: unknown;
      places?: unknown;
      nomosPreferences?: unknown;
      regionPreferences?: unknown;
    };
    if (parsed.version !== 1 || !Array.isArray(parsed.places)) {
      return { message: "This is not a valid private dashboard save." };
    }

    const { supabase, user } = await authenticatedClient();
    const places = parsed.places.map((item) => {
      const place = item as Record<string, unknown>;
      return {
        // Exported IDs may belong to another account. A fresh ID keeps the
        // imported row owned entirely by the currently authenticated user.
        id: crypto.randomUUID(),
        user_id: user.id,
        nomos_id: String(place.nomos_id ?? ""),
        name: String(place.name ?? ""),
        location: String(place.location ?? ""),
        altitude: String(place.altitude ?? ""),
        description: String(place.description ?? ""),
        category: Array.isArray(place.category) ? place.category.map(String) : [],
        historical_period: Array.isArray(place.historical_period)
          ? place.historical_period.map(String)
          : Array.isArray(place.historicalPeriod)
            ? place.historicalPeriod.map(String)
            : [],
        construction_date: String(place.construction_date ?? place.constructionDate ?? ""),
        main_use_period: String(place.main_use_period ?? place.mainUsePeriod ?? ""),
        destruction_or_end: String(place.destruction_or_end ?? place.destructionOrEnd ?? ""),
        built_by: String(place.built_by ?? place.builtBy ?? ""),
        purpose: String(place.purpose ?? ""),
        use_changed_description: String(place.use_changed_description ?? place.useChangedDescription ?? ""),
        access_level: String(place.access_level ?? place.accessLevel ?? ""),
        access_description: String(place.access_description ?? place.accessDescription ?? ""),
        ancient_affiliation: String(place.ancient_affiliation ?? place.ancientAffiliation ?? ""),
        connected_monuments: Array.isArray(place.connected_monuments)
          ? place.connected_monuments.map(String)
          : Array.isArray(place.connectedMonuments)
            ? place.connectedMonuments.map(String)
            : [],
        image_suggestion: String(place.image_suggestion ?? place.imageSuggestion ?? ""),
        image_url: String(place.image_url ?? ""),
        latitude: typeof place.latitude === "number" ? place.latitude : null,
        longitude: typeof place.longitude === "number" ? place.longitude : null,
        visited: place.visited === true,
        visit_date: typeof place.visit_date === "string" ? place.visit_date : null,
        visit_photo: String(place.visit_photo ?? ""),
        visibility: place.visibility === "public" ? "public" : "private",
      };
    });
    if (places.some((place) => !place.nomos_id || !place.name)) {
      return { message: "The save contains an invalid place." };
    }

    if (places.length) {
      const { error } = await supabase.from("places").insert(places);
      if (error) return { message: error.message };
    }

    const nomoi = Array.isArray(parsed.nomosPreferences)
      ? parsed.nomosPreferences.map((item) => {
          const value = item as Record<string, unknown>;
          return {
            user_id: user.id,
            nomos_id: String(value.nomos_id ?? ""),
            display_name: String(value.display_name ?? ""),
            image_url: String(value.image_url ?? ""),
            updated_at: new Date().toISOString(),
          };
        }).filter((item) => item.nomos_id)
      : [];
    const regions = Array.isArray(parsed.regionPreferences)
      ? parsed.regionPreferences.map((item) => {
          const value = item as Record<string, unknown>;
          return {
            user_id: user.id,
            region_id: String(value.region_id ?? ""),
            display_name: String(value.display_name ?? ""),
            image_url: String(value.image_url ?? ""),
            updated_at: new Date().toISOString(),
          };
        }).filter((item) => item.region_id)
      : [];
    if (nomoi.length) await supabase.from("user_nomoi").upsert(nomoi);
    if (regions.length) await supabase.from("user_regions").upsert(regions);

    revalidatePath("/dashboard");
    return { message: `Imported ${places.length} places successfully.` };
  } catch {
    return { message: "The selected file is not valid JSON." };
  }
}

async function adminClient() {
  const authenticated = await authenticatedClient();
  const { data } = await authenticated.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authenticated.user.id)
    .maybeSingle();
  if (data?.is_admin !== true) throw new Error("Administrator access required.");
  return authenticated;
}

export async function sendFriendRequest(
  _previousState: FriendRequestFormState,
  formData: FormData,
): Promise<FriendRequestFormState> {
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("send_friend_request", {
    target_username: value(formData, "username"),
  });
  if (error) {
    return {
      error: error.message.includes("No account has that username")
        ? "Username Not Found :("
        : error.message,
      success: null,
    };
  }
  revalidatePath("/dashboard");
  return { error: null, success: "Friend request sent." };
}

export async function answerFriendRequest(
  requestId: string,
  status: "accepted" | "rejected",
) {
  const { supabase, user } = await authenticatedClient();
  const query = supabase
    .from("friend_requests");
  const { error } =
    status === "rejected"
      ? await query
          .delete()
          .eq("id", requestId)
          .eq("receiver_id", user.id)
          .eq("status", "pending")
      : await query
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", requestId)
          .eq("receiver_id", user.id)
          .eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function removeFriend(friendshipId: string) {
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", friendshipId)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function updatePrivateNomos(
  nomosId: string,
  formData: FormData,
) {
  if (!initialNomoi.some((nomos) => nomos.id === nomosId)) {
    throw new Error("Unknown folder.");
  }
  const { supabase, user } = await adminClient();
  const { error } = await supabase.from("global_nomoi").upsert(
    {
      nomos_id: nomosId,
      display_name: value(formData, "displayName"),
      image_url: value(formData, "imageUrl"),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "nomos_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateGlobalNomosInline(
  nomosId: string,
  formData: FormData,
) {
  if (!initialNomoi.some((nomos) => nomos.id === nomosId)) {
    throw new Error("Unknown folder.");
  }
  const { supabase, user } = await adminClient();
  const imageUrl = value(formData, "imageUrl");
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Picture URL must begin with http:// or https://.");
  }
  const { error } = await supabase.from("global_nomoi").upsert(
    {
      nomos_id: nomosId,
      display_name: value(formData, "displayName"),
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "nomos_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function updatePrivateRegion(
  regionId: string,
  formData: FormData,
) {
  if (!initialRegions.some((region) => region.id === regionId)) {
    throw new Error("Unknown region.");
  }
  const { supabase, user } = await adminClient();
  const imageUrl = value(formData, "imageUrl");
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Picture URL must begin with http:// or https://.");
  }
  const { error } = await supabase.from("global_regions").upsert(
    {
      region_id: regionId,
      display_name: value(formData, "displayName"),
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "region_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateGlobalRegionInline(
  regionId: string,
  formData: FormData,
) {
  if (!initialRegions.some((region) => region.id === regionId)) {
    throw new Error("Unknown region.");
  }
  const { supabase, user } = await adminClient();
  const imageUrl = value(formData, "imageUrl");
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Picture URL must begin with http:// or https://.");
  }
  const { error } = await supabase.from("global_regions").upsert(
    {
      region_id: regionId,
      display_name: value(formData, "displayName"),
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "region_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

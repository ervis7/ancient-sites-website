import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendProfile from "./FriendProfile";

type FriendProfileRow = {
  friend_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  background_url: string | null;
  is_admin: boolean | null;
  presence_state: string | null;
  last_seen: string | null;
  bio: string | null;
  profile_location: string | null;
  website: string | null;
  place_id: string | null;
  place_name: string | null;
  place_location: string | null;
  place_description: string | null;
  place_image_url: string | null;
  visit_date: string | null;
  visit_photo: string | null;
  visit_note: string | null;
  visit_reactions: Record<string, number> | null;
  visit_reactors: {
    emoji: string;
    userId: string;
    name: string;
    avatarUrl: string | null;
  }[] | null;
  viewer_reaction: string | null;
};

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const [
    { data, error },
    { data: friendList },
    { data: ownProfile },
    { data: profileGifUrl },
  ] = await Promise.all([
    supabase.rpc("get_friend_profile", { target_friend_id: id }),
    supabase.rpc("get_friend_list"),
    supabase
      .from("profiles")
      .select("points")
      .eq("id", authData.user.id)
      .maybeSingle(),
    supabase.rpc("get_visible_profile_gif", { target_profile_id: id }),
  ]);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as FriendProfileRow[];
  const profile = rows[0];
  if (!profile) notFound();
  const points =
    id === authData.user.id
      ? ownProfile?.points ?? 0
      : (friendList ?? []).find(
          (friend: { friend_id: string }) => friend.friend_id === id,
        )?.points ?? 0;

  return (
    <FriendProfile
      isOwnProfile={id === authData.user.id}
      friend={{
        id: profile.friend_id,
        fullName: profile.full_name ?? "",
        username: profile.username ?? "",
        avatarUrl: profile.avatar_url ?? "",
        backgroundUrl: profile.background_url ?? "",
        isAdmin: profile.is_admin === true,
        presenceState: profile.presence_state ?? "offline",
        lastSeen: profile.last_seen ?? "",
        bio: profile.bio ?? "",
        location: profile.profile_location ?? "",
        website: profile.website ?? "",
        profileGifUrl: profileGifUrl ?? "",
        points,
      }}
      places={rows
        .filter((row) => row.place_id)
        .map((row) => ({
          id: row.place_id!,
          name: row.place_name ?? "",
          location: row.place_location ?? "",
          description: row.place_description ?? "",
          imageUrl: row.place_image_url ?? "",
          visitDate: row.visit_date ?? "",
          visitPhoto: row.visit_photo ?? "",
          visitNote: row.visit_note ?? "",
          reactions: row.visit_reactions ?? {},
          reactors: row.visit_reactors ?? [],
          viewerReaction: row.viewer_reaction ?? "",
        }))}
    />
  );
}

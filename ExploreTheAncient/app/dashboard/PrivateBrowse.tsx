"use client";

import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  MouseEvent,
  SetStateAction,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GreeceNomosMap from "@/app/browse/GreeceNomosMap";
import type { MapRegionRanking } from "@/app/browse/GreeceNomosMap";
import BrowseViewToggle, {
  BrowseView,
} from "@/app/browse/BrowseViewToggle";
import { signOut } from "@/app/auth/actions";
import { initialNomoi, initialRegions } from "@/app/browse/places";
import { DEFAULT_PLACE_IMAGE_URL } from "@/app/placeImages";
import RankBadge from "./RankBadge";
import { getRankProgress } from "./ranks";
import PresenceIndicator from "./PresenceIndicator";
import {
  clearVisited,
  createPlace,
  createPlaceList,
  markVisited,
  answerFriendRequest,
  importDashboardSave,
  markNotificationsRead,
  removePlaceFromList,
  sendFriendRequest,
  setPlaceListMembership,
  toggleFavoritePlace,
  updateGlobalNomosInline,
  updateGlobalRegionInline,
  updatePresence,
  updateProfile,
} from "./actions";

type PrivatePlace = {
  id: string;
  user_id: string;
  catalog_id: number | null;
  is_global: boolean;
  nomos_id: string;
  name: string;
  location: string;
  altitude: string;
  description: string;
  category: string[] | string | null;
  historical_period: string[] | string | null;
  construction_date: string | null;
  main_use_period: string | null;
  destruction_or_end: string | null;
  built_by: string | null;
  purpose: string | null;
  use_changed_description: string | null;
  access_level: string | null;
  access_description: string | null;
  ancient_affiliation: string | null;
  connected_monuments: string[] | string | null;
  image_suggestion: string | null;
  needs_manual_review?: boolean | null;
  image_url: string;
  latitude: number | null;
  longitude: number | null;
  visited: boolean;
  visit_date: string | null;
  visit_photo: string;
  visit_note: string;
  visibility: "private" | "public";
  is_favorite?: boolean;
  list_ids?: string[];
};

type PlaceList = {
  id: string;
  name: string;
  created_at: string;
  is_favorites?: boolean | null;
};

type PlaceFilters = {
  regionIds: string[];
  categories: string[];
  periods: string[];
  accessLevels: string[];
  flags: string[];
};

type Panel = "account" | "settings" | "friends" | "lists" | null;

type Friend = {
  friendship_id: string;
  friend_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string;
  points: number;
  is_admin: boolean;
  presence_state: string;
  last_seen: string;
};

type FriendRequest = {
  request_id: string;
  sender_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string;
  points: number;
  is_admin: boolean;
  presence_state: string;
  last_seen: string;
};

type NomosPreference = {
  nomos_id: string;
  display_name: string;
  image_url: string;
};

type RegionPreference = {
  region_id: string;
  display_name: string;
  image_url: string;
};

type PointActivity = {
  event_id: string;
  friend_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string;
  background_url: string;
  total_points: number;
  is_admin: boolean;
  action_type: "place_added" | "place_visited";
  points_awarded: number;
  place_id: string | null;
  place_name: string;
  created_at: string;
};

type EditableRegion = {
  id: string;
  name: string;
  image: string;
};

type EditableNomos = {
  id: string;
  name: string;
  image: string;
};

type ReactionNotification = {
  reaction_id: string;
  notification_type: "visit_reaction" | "friend_request" | "friend_accepted";
  reactor_id: string;
  reactor_name: string;
  reactor_avatar_url: string;
  place_id: string | null;
  place_name: string;
  reaction: string;
  reacted_at: string;
  is_unread: boolean;
};

function asTextList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function hasPlaceText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function placeImageStyle(imageUrl: string | null | undefined) {
  return { backgroundImage: `url("${imageUrl || DEFAULT_PLACE_IMAGE_URL}")` };
}

const defaultPlaceFilters: PlaceFilters = {
  regionIds: [],
  categories: [],
  periods: [],
  accessLevels: [],
  flags: [],
};

const fallbackCategoryOptions = [
  "Ναός",
  "Θέατρο",
  "Ανάκτορο",
  "Ιερό",
  "Οχύρωση",
  "Σπήλαιο",
  "Πόλη",
  "Τάφος",
  "Λιμάνι",
];

const fallbackPeriodOptions = [
  "Νεολιθική",
  "Μινωική",
  "Μυκηναϊκή",
  "Αρχαϊκή",
  "Κλασική",
  "Ελληνιστική",
  "Ρωμαϊκή",
];

const fallbackAccessOptions = ["Εύκολη", "Μέτρια", "Δύσκολη", "Άγνωστη"];

function canonicalAccessLevel(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "";

  const optionIndex = fallbackAccessOptions.findIndex(
    (option) => option.toLowerCase() === normalized,
  );
  if (optionIndex === 0) return "easy";
  if (optionIndex === 1) return "medium";
  if (optionIndex === 2) return "hard";
  if (optionIndex === 3) return "unknown";

  if (["easy", "ευκολη", "εύκολη"].includes(normalized)) return "easy";
  if (["medium", "moderate", "μετρια", "μέτρια"].includes(normalized)) return "medium";
  if (["hard", "difficult", "δυσκολη", "δύσκολη"].includes(normalized)) return "hard";
  if (["unknown", "αγνωστη", "άγνωστη"].includes(normalized)) return "unknown";

  return normalized;
}

function activeFilterCount(filters: PlaceFilters) {
  return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

function loadLocalImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image format could not be opened."));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Image compression failed.")),
      "image/jpeg",
      quality,
    );
  });
}

async function compressVisitPhoto(file: File) {
  const image = await loadLocalImage(file);
  const initialScale = Math.min(
    1,
    1600 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
  let bestBlob: Blob | null = null;

  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable.");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.84, 0.74, 0.64, 0.54]) {
      const blob = await canvasBlob(canvas, quality);
      bestBlob = blob;
      if (blob.size <= 700_000) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "visit";
        return new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
    width = Math.max(1, Math.round(width * 0.78));
    height = Math.max(1, Math.round(height * 0.78));
  }

  if (!bestBlob) throw new Error("Image compression failed.");
  return new File([bestBlob], "visit.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function RegionEditModal({
  region,
  onClose,
}: {
  region: EditableRegion;
  onClose: () => void;
}) {
  const [image, setImage] = useState(region.image);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        await updateGlobalRegionInline(region.id, formData);
        onClose();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save region.");
      }
    });
  }

  return createPortal(
    <div className="regionEditBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onClose();
    }}>
      <section className="regionEditModal" role="dialog" aria-modal="true"
        aria-labelledby="region-edit-title">
        <button type="button" className="panelClose" onClick={onClose}
          disabled={pending} aria-label="Close">×</button>
        <p className="eyebrow">Admin controls</p>
        <h2 id="region-edit-title">Edit Region</h2>
        <form onSubmit={save} className="dashboardForm">
          <label>
            Display name
            <input name="displayName" defaultValue={region.name} required />
          </label>
          <label>
            Background picture URL
            <input name="imageUrl" type="url" value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder="https://..." />
          </label>
          {image && (
            <div className="editImagePreview regionImagePreview" role="img"
              aria-label={`${region.name} background preview`}
              style={{ backgroundImage: `url("${image}")` }} />
          )}
          {error && <p className="friendRequestError" role="alert">{error}</p>}
          <div className="editActions">
            <button type="button" className="secondaryButton" onClick={onClose}
              disabled={pending}>Cancel</button>
            <button className="addAncientButton" disabled={pending}>
              {pending ? "Saving…" : "Save Region"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function NomosEditModal({
  nomos,
  onClose,
}: {
  nomos: EditableNomos;
  onClose: () => void;
}) {
  const [image, setImage] = useState(nomos.image);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        await updateGlobalNomosInline(nomos.id, formData);
        onClose();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save Νομός.");
      }
    });
  }

  return createPortal(
    <div className="regionEditBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onClose();
    }}>
      <section className="regionEditModal" role="dialog" aria-modal="true"
        aria-labelledby="nomos-edit-title">
        <button type="button" className="panelClose" onClick={onClose}
          disabled={pending} aria-label="Close">×</button>
        <p className="eyebrow">Admin controls</p>
        <h2 id="nomos-edit-title">Edit Νομός</h2>
        <form onSubmit={save} className="dashboardForm">
          <label>
            Display name
            <input name="displayName" defaultValue={nomos.name} required />
          </label>
          <label>
            Folder picture URL
            <input name="imageUrl" type="url" value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder="https://..." />
          </label>
          {image && (
            <div className="editImagePreview" role="img"
              aria-label={`${nomos.name} folder preview`}
              style={{ backgroundImage: `url("${image}")` }} />
          )}
          {error && <p className="friendRequestError" role="alert">{error}</p>}
          <div className="editActions">
            <button type="button" className="secondaryButton" onClick={onClose}
              disabled={pending}>Cancel</button>
            <button className="addAncientButton" disabled={pending}>
              {pending ? "Saving…" : "Save Νομός"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function FriendsPanel({
  friends,
  requests,
  userId,
  avatarUrl,
  displayName,
}: {
  friends: Friend[];
  requests: FriendRequest[];
  userId: string;
  avatarUrl: string;
  displayName: string;
}) {
  const [state, action] = useActionState(sendFriendRequest, {
    error: null,
    success: null,
  });
  return (
    <>
      <div className="friendsSelfProfile">
        <div
          className={`friendsSelfAvatar${avatarUrl ? "" : " friendsSelfAvatarFallback"}`}
          role="img"
          aria-label={`${displayName || "Your"} profile picture`}
          style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}
        >
          {!avatarUrl && (displayName || "Y").slice(0, 1).toUpperCase()}
          <PresenceIndicator state="active" lastSeen={new Date().toISOString()} />
        </div>
        <Link
          className="profilePreviewButton"
          href={`/dashboard/friends/${userId}`}
        >
          Review your profile
        </Link>
      </div>
      <h2>Friends</h2>
      <details className="friendAdd" open>
        <summary>Add a friend</summary>
        <form action={action}>
          <input name="username" placeholder="Exact username" aria-label="Friend username" required />
          {state.error && <p className="friendRequestError" role="alert">{state.error}</p>}
          {state.success && (
            <p className="friendRequestSuccess" role="status">{state.success}</p>
          )}
          <button className="primaryButton">Send request</button>
        </form>
      </details>
      {requests.length > 0 && (
        <section className="friendRequests">
          <h3>Requests</h3>
          {requests.map((request) => (
            <article key={request.request_id} className="friendRequest">
              {request.avatar_url ? (
                <span className="friendAvatar" style={{ backgroundImage: `url("${request.avatar_url}")` }}>
                  <PresenceIndicator state={request.presence_state} lastSeen={request.last_seen} />
                </span>
              ) : (
                <span className="friendAvatar friendAvatarFallback">
                  {(request.full_name || request.username || "?").slice(0, 1)}
                  <PresenceIndicator state={request.presence_state} lastSeen={request.last_seen} />
                </span>
              )}
              <div><strong className={request.is_admin ? "adminAccountName" : undefined}>{request.full_name || request.username} <span className="pointsBadge">{request.points} pts</span> <RankBadge points={request.points} isAdmin={request.is_admin} /></strong>
                {request.username && <small>@{request.username}</small>}</div>
              <div className="friendRequestActions">
                <form action={answerFriendRequest.bind(null, request.request_id, "accepted")}>
                  <button className="friendAccept">Accept</button>
                </form>
                <form action={answerFriendRequest.bind(null, request.request_id, "rejected")}>
                  <button className="friendReject">Reject</button>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="friendList">
        <h3>Friends</h3>
        {friends.map((friend) => (
          <Link key={friend.friendship_id} className="friendItem friendItemLink"
            href={`/dashboard/friends/${friend.friend_id}`}>
            {friend.avatar_url ? (
              <span className="friendAvatar" style={{ backgroundImage: `url("${friend.avatar_url}")` }}>
                <PresenceIndicator state={friend.presence_state} lastSeen={friend.last_seen} />
              </span>
            ) : (
              <span className="friendAvatar friendAvatarFallback">
                {(friend.full_name || friend.username || "?").slice(0, 1)}
                <PresenceIndicator state={friend.presence_state} lastSeen={friend.last_seen} />
              </span>
            )}
            <span><strong className={friend.is_admin ? "adminAccountName" : undefined}>{friend.full_name || friend.username} <span className="pointsBadge">{friend.points} pts</span> <RankBadge points={friend.points} isAdmin={friend.is_admin} /></strong>
              {friend.username && <small>@{friend.username}</small>}</span>
            <span className="friendItemArrow" aria-hidden="true">→</span>
          </Link>
        ))}
        {!friends.length && <p className="friendEmpty">No friends yet.</p>}
      </section>
    </>
  );
}

function ProfileEditForm({
  profile,
}: {
  profile: {
    fullName: string;
    username: string;
    bio: string;
    location: string;
    avatarUrl: string;
    backgroundUrl: string;
    profileGifUrl: string;
  };
}) {
  return (
    <details className="accountEditProfile">
      <summary>Edit profile</summary>
      <form action={updateProfile} className="dashboardForm">
        <label>
          Full name
          <input name="fullName" defaultValue={profile.fullName} maxLength={100} required />
        </label>
        <label>
          Username
          <input
            name="username"
            defaultValue={profile.username}
            maxLength={40}
            pattern="[A-Za-z0-9_-]+"
            placeholder="letters, numbers, _ or -"
          />
        </label>
        <label>
          Bio
          <textarea name="bio" defaultValue={profile.bio} maxLength={500} rows={4} />
        </label>
        <label>
          Location
          <input
            name="profileLocation"
            defaultValue={profile.location}
            maxLength={100}
          />
        </label>
        <label>
          Profile GIF URL
          <input
            name="profileGifUrl"
            type="url"
            defaultValue={profile.profileGifUrl}
            placeholder="https://.../animation.gif"
          />
        </label>
        <label>
          Avatar picture URL
          <input
            name="avatarUrl"
            type="url"
            defaultValue={profile.avatarUrl}
            placeholder="https://..."
          />
        </label>
        <label>
          Profile background URL
          <input name="currentBackgroundUrl" type="hidden" value={profile.backgroundUrl} />
          <input
            name="profileBackgroundUrl"
            type="url"
            defaultValue={
              profile.backgroundUrl.startsWith("data:") ? "" : profile.backgroundUrl
            }
            placeholder="https://..."
          />
        </label>
        <label>
          Or upload a local PNG
          <input
            name="profileBackgroundFile"
            type="file"
            accept="image/png,.png"
          />
        </label>
        {profile.backgroundUrl && (
          <label className="profileBackgroundRemove">
            <input name="removeProfileBackground" type="checkbox" />
            Remove current background
          </label>
        )}
        <button className="primaryButton">Save profile</button>
      </form>
    </details>
  );
}

function ListsPanel({
  lists,
  places,
}: {
  lists: PlaceList[];
  places: PrivatePlace[];
}) {
  return (
    <>
      <p className="eyebrow">Saved routes</p>
      <h2>Lists</h2>
      <form action={createPlaceList} className="placeListPanelCreate">
        <input name="listName" placeholder="New list name" required />
        <button className="primaryButton">Create</button>
      </form>
      <section className="placeListsPanel">
        {lists.map((list) => {
          const listPlaces = places.filter((place) =>
            (place.list_ids ?? []).includes(list.id),
          );
          const isFavoritesList = list.is_favorites || list.name === "Αγαπημένα";

          return (
            <article key={list.id} className={`placeListBlock${isFavoritesList ? " placeListBlockFavorites" : ""}`}>
              <div className="placeListBlockHeader">
                <h3>{list.name}</h3>
                <span>{listPlaces.length}</span>
              </div>
              {listPlaces.length > 0 ? (
                <ul className="placeListItems">
                  {listPlaces.map((place) => (
                    <li key={`${list.id}-${place.id}`}>
                      <Link href={`/dashboard/places/${place.id}`}>
                        <strong>{place.name}</strong>
                        {place.location && <small>{place.location}</small>}
                      </Link>
                      <form action={removePlaceFromList.bind(null, list.id, place.id)}>
                        <button type="submit">
                          {isFavoritesList ? "Unfavorite" : "Remove"}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="emptyMessage">This list is empty.</p>
              )}
            </article>
          );
        })}
        {!lists.length && (
          <p className="emptyMessage">Lists will appear after the database migration is applied.</p>
        )}
      </section>
    </>
  );
}

function PrivateAncientCard({
  place,
  onVisit,
  onUnvisit,
  canEdit,
  placeLists,
}: {
  place: PrivatePlace;
  onVisit: (place: PrivatePlace) => void;
  onUnvisit: (place: PrivatePlace) => void;
  canEdit: boolean;
  placeLists: PlaceList[];
}) {
  const [previewPosition, setPreviewPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const customPlaceLists = placeLists.filter((list) => !list.is_favorites);

  function movePreview(event: MouseEvent<HTMLElement>) {
    if (!place.visited || !place.visit_photo) return;
    setPreviewPosition({
      x: Math.max(8, Math.min(event.clientX + 18, window.innerWidth - 280)),
      y: Math.max(8, Math.min(event.clientY + 18, window.innerHeight - 260)),
    });
  }

  return (
    <article
      className={`ancientCard${place.visited ? " ancientCardVisited" : ""}`}
      onMouseMove={movePreview}
      onMouseLeave={() => setPreviewPosition(null)}
    >
      {canEdit ? (
      <Link href={`/dashboard/places/${place.id}`} className="ancientCardOpen"
        aria-label={`View ${place.name}`}>
        {place.image_url ? (
          <div
            className="ancientImage"
            role="img"
            aria-label={place.name}
            style={placeImageStyle(place.image_url)}
          />
        ) : (
          <div
            className="ancientImage ancientImagePlaceholder"
            role="img"
            aria-label="Default ancient place image"
            style={placeImageStyle(place.image_url)}
          />
        )}
        <div className="ancientDetails">
          <div className="placeTitleRow">
            <h2>{place.name}</h2>
            <span className={`visibilityBadge visibilityBadge${place.visibility === "public" ? "Public" : "Private"}`}>
              {place.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>
          <dl>
            <div><dt>Location</dt><dd>{place.location}</dd></div>
            <div><dt>Altitude</dt><dd>{place.altitude || "Not specified"}</dd></div>
          </dl>
          {place.description && <p className="ancientDescription">{place.description}</p>}
        </div>
      </Link>
      ) : (
        <Link
          href={`/dashboard/places/${place.id}`}
          className="ancientCardOpen"
          aria-label={`View ${place.name}`}
        >
          {place.image_url ? (
            <div className="ancientImage" role="img" aria-label={place.name}
              style={placeImageStyle(place.image_url)} />
          ) : (
            <div
              className="ancientImage ancientImagePlaceholder"
              role="img"
              aria-label="Default ancient place image"
              style={placeImageStyle(place.image_url)}
            />
          )}
          <div className="ancientDetails">
            <div className="placeTitleRow">
              <h2>{place.name}</h2>
              <span className="visibilityBadge visibilityBadgePublic">Public</span>
            </div>
            <dl>
              <div><dt>Location</dt><dd>{place.location}</dd></div>
              <div><dt>Altitude</dt><dd>{place.altitude || "Not specified"}</dd></div>
            </dl>
            {place.description && <p className="ancientDescription">{place.description}</p>}
            <small className="sharedPlaceLabel">Shared place</small>
          </div>
        </Link>
      )}

      <div className="placeCardQuickActions">
        <form action={toggleFavoritePlace.bind(null, place.id, !place.is_favorite)}>
          <button
            type="submit"
            className={`heartFavoriteButton${place.is_favorite ? " heartFavoriteButtonActive" : ""}`}
            aria-pressed={place.is_favorite ? "true" : "false"}
            aria-label={place.is_favorite ? `Remove ${place.name} from favorites` : `Add ${place.name} to favorites`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s-7.5-4.8-9.5-9.1C1 8.6 2.7 5 6.2 4.3c2-.4 3.8.5 4.8 2 1-1.5 2.8-2.4 4.8-2 3.5.7 5.2 4.3 3.7 7.6C19.5 16.2 12 21 12 21Z" />
            </svg>
          </button>
        </form>
        <div className="placeCardListMenu">
          <button
            type="button"
            className="addToListButton"
            aria-expanded={listMenuOpen}
            onClick={() => setListMenuOpen((open) => !open)}
          >
            Add to list
          </button>
          {listMenuOpen && (
            <div className="placeCardListPopover">
              {customPlaceLists.length > 0 ? (
                customPlaceLists.map((list) => {
                  const isInList = (place.list_ids ?? []).includes(list.id);
                  return (
                    <form
                      key={list.id}
                      action={setPlaceListMembership.bind(null, place.id, list.id)}
                    >
                      <label>
                        <input
                          name="include"
                          type="checkbox"
                          defaultChecked={isInList}
                          onChange={(event) => event.currentTarget.form?.requestSubmit()}
                        />
                        <span>{list.name}</span>
                      </label>
                    </form>
                  );
                })
              ) : (
                <p>No custom lists yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <label className="visitedToggle">
        <input
          type="checkbox"
          checked={place.visited}
          onChange={(event) =>
            event.target.checked ? onVisit(place) : onUnvisit(place)
          }
        />
        Visited
      </label>
      {place.visited && (
        <Link
          className="visitedAncientInfoButton"
          href={`/dashboard/places/${place.id}`}
        >
          View ancient
        </Link>
      )}

      {previewPosition &&
        createPortal(
          <aside
            className="visitHoverPreview"
            style={{ left: previewPosition.x, top: previewPosition.y }}
            aria-hidden="true"
          >
            <div
              className="visitHoverPhoto"
              style={{ backgroundImage: `url("${place.visit_photo}")` }}
            />
            <p>Visited on {place.visit_date}</p>
            {place.visit_note && <p>{place.visit_note}</p>}
          </aside>,
          document.body,
        )}
    </article>
  );
}

export default function PrivateBrowse({
  email,
  userId,
  profile,
  isAdmin,
  places,
  friends,
  requests,
  nomosPreferences,
  regionPreferences,
  pointActivity,
  notifications,
  regionVisitRankings,
  placeLists,
}: {
  email: string;
  userId: string;
  isAdmin: boolean;
  profile: {
    fullName: string;
    username: string;
    bio: string;
    location: string;
    website: string;
    profileGifUrl: string;
    avatarUrl: string;
    backgroundUrl: string;
    presenceState: string;
    lastSeen: string;
    points: number;
  };
  places: PrivatePlace[];
  placeLists: PlaceList[];
  friends: Friend[];
  requests: FriendRequest[];
  nomosPreferences: NomosPreference[];
  regionPreferences: RegionPreference[];
  pointActivity: PointActivity[];
  notifications: ReactionNotification[];
  regionVisitRankings: MapRegionRanking[];
}) {
  const router = useRouter();
  const [panel, setPanelState] = useState<Panel>(null);
  const [panelClosing, setPanelClosing] = useState(false);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [nomosId, setNomosId] = useState<string | null>(null);
  const [browseView, setBrowseView] = useState<BrowseView>("map");
  const [visitPlace, setVisitPlace] = useState<PrivatePlace | null>(null);
  const [visitPhotoPreview, setVisitPhotoPreview] = useState("");
  const [visitPhotoError, setVisitPhotoError] = useState("");
  const [editingRegion, setEditingRegion] = useState<EditableRegion | null>(null);
  const [editingNomos, setEditingNomos] = useState<EditableNomos | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardClosing, setLeaderboardClosing] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<PlaceFilters>(defaultPlaceFilters);
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  const [folderFilters, setFolderFilters] = useState<PlaceFilters>(defaultPlaceFilters);
  const [folderFiltersOpen, setFolderFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [importState, importAction] = useActionState(importDashboardSave, { message: "" });
  const selectedRegion = initialRegions.find((region) => region.id === regionId);
  const selectedNomos = initialNomoi.find((nomos) => nomos.id === nomosId);
  const visiblePlaces = places.filter((place) => place.nomos_id === nomosId);
  const regionFilterOptions = useMemo(
    () =>
      initialRegions.map((region) => {
        const preference = regionPreferences.find(
          (item) => item.region_id === region.id,
        );
        return {
          id: region.id,
          name: preference?.display_name || region.name,
        };
      }),
    [regionPreferences],
  );
  const categoryFilterOptions = fallbackCategoryOptions;
  const periodFilterOptions = fallbackPeriodOptions;
  const accessFilterOptions = fallbackAccessOptions;

  function placeMatchesFilters(
    place: PrivatePlace,
    query: string,
    filters: PlaceFilters,
  ) {
    const nomos = initialNomoi.find((item) => item.id === place.nomos_id);
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      const searchText = [
        place.name,
        place.location,
        nomos?.name,
        initialRegions.find((region) => region.id === nomos?.regionId)?.name,
        place.description,
        place.ancient_affiliation,
        place.access_level,
        ...asTextList(place.category),
        ...asTextList(place.historical_period),
        ...asTextList(place.connected_monuments),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchText.includes(normalizedQuery)) return false;
    }

    if (filters.regionIds.length && !filters.regionIds.includes(nomos?.regionId ?? "")) {
      return false;
    }

    const placeCategories = asTextList(place.category).map((value) => value.toLowerCase());
    if (
      filters.categories.length &&
      !filters.categories.some((category) =>
        placeCategories.some((value) => value.includes(category.toLowerCase())),
      )
    ) {
      return false;
    }

    const placePeriods = asTextList(place.historical_period).map((value) => value.toLowerCase());
    if (
      filters.periods.length &&
      !filters.periods.some((period) =>
        placePeriods.some((value) => value.includes(period.toLowerCase())),
      )
    ) {
      return false;
    }

    const accessLevel = canonicalAccessLevel(place.access_level);
    if (
      filters.accessLevels.length &&
      !filters.accessLevels.some(
        (level) => accessLevel === canonicalAccessLevel(level),
      )
    ) {
      return false;
    }

    if (filters.flags.includes("with-image") && !hasPlaceText(place.image_url)) return false;
    if (filters.flags.includes("visited") && !place.visited) return false;
    if (filters.flags.includes("favorite") && !place.is_favorite) return false;
    if (filters.flags.includes("review") && !place.needs_manual_review) return false;

    return true;
  }

  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim() && activeFilterCount(searchFilters) === 0) return [];
    return places
      .filter((place) => placeMatchesFilters(place, searchQuery, searchFilters))
      .slice(0, 24);
  }, [places, searchQuery, searchFilters]);
  const folderFilteredPlaces = useMemo(() => {
    if (activeFilterCount(folderFilters) === 0) return [];
    return places.filter((place) => placeMatchesFilters(place, "", folderFilters));
  }, [places, folderFilters]);
  const folderHasFilters = activeFilterCount(folderFilters) > 0;
  const rankProgress = getRankProgress(profile.points, isAdmin);
  const hasUnreadNotifications =
    !notificationsRead && notifications.some((notification) => notification.is_unread);

  useEffect(() => {
    const report = () => {
      void updatePresence(document.hidden ? "away" : "active");
    };
    report();
    const heartbeat = window.setInterval(() => {
      report();
      router.refresh();
    }, 60_000);
    document.addEventListener("visibilitychange", report);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", report);
    };
  }, [router]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function openPanel(nextPanel: Exclude<Panel, null>) {
    setPanelClosing(false);
    setPanelState(nextPanel);
  }

  function setPanel(nextPanel: Panel) {
    if (nextPanel === null) {
      closePanel();
      return;
    }
    setPanelState(nextPanel);
  }

  function toggleFilterValue(
    setter: Dispatch<SetStateAction<PlaceFilters>>,
    key: keyof PlaceFilters,
    value: string,
  ) {
    setter((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  function placeFilterControls(
    filters: PlaceFilters,
    setFilters: Dispatch<SetStateAction<PlaceFilters>>,
  ) {
    const flagOptions = [
      { id: "with-image", label: "Με εικόνα" },
      { id: "visited", label: "Επισκέφθηκα" },
      { id: "favorite", label: "Αγαπημένα" },
      { id: "review", label: "Θέλει έλεγχο" },
    ];

    return (
      <div className="placeFilterControls">
        <fieldset>
          <legend>ΠΕΡΙΟΧΗ</legend>
          <div className="placeFilterOptions">
            {regionFilterOptions.map((region) => (
              <label key={region.id}>
                <input
                  type="checkbox"
                  checked={filters.regionIds.includes(region.id)}
                  onChange={() => toggleFilterValue(setFilters, "regionIds", region.id)}
                />
                <span>{region.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>ΚΑΤΗΓΟΡΙΑ</legend>
          <div className="placeFilterOptions">
            {categoryFilterOptions.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={() => toggleFilterValue(setFilters, "categories", category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>ΠΕΡΙΟΔΟΣ</legend>
          <div className="placeFilterOptions">
            {periodFilterOptions.map((period) => (
              <label key={period}>
                <input
                  type="checkbox"
                  checked={filters.periods.includes(period)}
                  onChange={() => toggleFilterValue(setFilters, "periods", period)}
                />
                <span>{period}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>ΠΡΟΣΒΑΣΗ</legend>
          <div className="placeFilterOptions">
            {accessFilterOptions.map((level) => (
              <label key={level}>
                <input
                  type="checkbox"
                  checked={filters.accessLevels.includes(level)}
                  onChange={() => toggleFilterValue(setFilters, "accessLevels", level)}
                />
                <span>{level}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>ΑΛΛΑ</legend>
          <div className="placeFilterOptions">
            {flagOptions.map((option) => (
              <label key={option.id}>
                <input
                  type="checkbox"
                  checked={filters.flags.includes(option.id)}
                  onChange={() => toggleFilterValue(setFilters, "flags", option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {activeFilterCount(filters) > 0 && (
          <button
            type="button"
            className="placeFilterClear"
            onClick={() => setFilters(defaultPlaceFilters)}
          >
            Καθαρισμός φίλτρων
          </button>
        )}
      </div>
    );
  }

  function placeFilterToggle(
    label: string,
    filters: PlaceFilters,
    isOpen: boolean,
    onToggle: () => void,
  ) {
    const count = activeFilterCount(filters);
    return (
      <button
        type="button"
        className="placeFilterToggle"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h6" />
          <path d="M14 7h6" />
          <circle cx="12" cy="7" r="2" />
          <path d="M4 12h11" />
          <path d="M19 12h1" />
          <circle cx="17" cy="12" r="2" />
          <path d="M4 17h8" />
          <path d="M16 17h4" />
          <circle cx="14" cy="17" r="2" />
        </svg>
        <span>{label}</span>
        {count > 0 && <strong>{count}</strong>}
      </button>
    );
  }

  function closePanel() {
    if (panelClosing) return;
    setPanelClosing(true);
    window.setTimeout(() => {
      setPanelState(null);
      setPanelClosing(false);
    }, 260);
  }

  async function previewVisitPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setVisitPhotoPreview("");
      setVisitPhotoError("Choose an image from your gallery or computer.");
      return;
    }
    setVisitPhotoError("");
    let uploadFile = file;
    try {
      if (
        file.size > 700_000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ) {
        uploadFile = await compressVisitPhoto(file);
        const transfer = new DataTransfer();
        transfer.items.add(uploadFile);
        input.files = transfer.files;
      }
    } catch (error) {
      input.value = "";
      setVisitPhotoPreview("");
      setVisitPhotoError(
        error instanceof Error
          ? `${error.message} Try a JPG or PNG image.`
          : "This picture could not be prepared for upload.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setVisitPhotoPreview(String(reader.result));
    reader.readAsDataURL(uploadFile);
  }

  async function unvisit(place: PrivatePlace) {
    await clearVisited(place.id);
  }

  function exportDashboard() {
    const save = {
      version: 1,
      exportedAt: new Date().toISOString(),
      places,
      nomosPreferences,
      regionPreferences,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], {
      type: "application/json",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "explore-the-ancients-private-save.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function closeLeaderboard() {
    if (leaderboardClosing) return;
    setLeaderboardClosing(true);
    window.setTimeout(() => {
      setLeaderboardOpen(false);
      setLeaderboardClosing(false);
      setActivityExpanded(false);
    }, 260);
  }

  function toggleLeaderboard() {
    if (leaderboardOpen) {
      closeLeaderboard();
    } else {
      setLeaderboardClosing(false);
      setLeaderboardOpen(true);
    }
  }

  return (
    <main className="browsePage privateBrowsePage">
      <BrowseViewToggle value={browseView} onChange={setBrowseView} />
      <button type="button" className="leaderboardTab"
        aria-expanded={leaderboardOpen}
        onClick={toggleLeaderboard}>
        Ranked
      </button>
      {leaderboardOpen && (
        <div
          className={`leaderboardWindowMotion${leaderboardClosing ? " leaderboardWindowClosing" : ""}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLeaderboard();
          }}
        >
        <aside className="leaderboardWindow rankedWindow" aria-label="Explorer ranking and points leaderboard">
          {profile.backgroundUrl && (
            <span
              className="leaderboardEntryBackground"
              aria-hidden="true"
              style={{ backgroundImage: `url("${profile.backgroundUrl}")` }}
            />
          )}
          <section className="rankedSummary" aria-label="Explorer rank progress">
            <p className="eyebrow">Explorer rank</p>
            {profile.avatarUrl ? (
              <span
                className="rankedSummaryAvatar"
                style={{ backgroundImage: `url("${profile.avatarUrl}")` }}
              >
                <PresenceIndicator state={profile.presenceState} lastSeen={profile.lastSeen} />
              </span>
            ) : (
              <span className="rankedSummaryAvatar rankedSummaryAvatarFallback">
                {(profile.fullName || profile.username || "Y").slice(0, 1)}
                <PresenceIndicator state={profile.presenceState} lastSeen={profile.lastSeen} />
              </span>
            )}
            <h2>{rankProgress.current.name}</h2>
            <RankBadge points={profile.points} isAdmin={isAdmin} />
            <p className="rankedPoints">{profile.points} points</p>
            {rankProgress.next ? (
              <>
                <div
                  className="rankProgressTrack"
                  role="progressbar"
                  aria-label={`Progress to ${rankProgress.next.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(rankProgress.progress)}
                >
                  <span
                    style={{
                      width: `${rankProgress.progress}%`,
                      background: rankProgress.current.color,
                    }}
                  />
                </div>
                <p>
                  <strong>{rankProgress.remaining} points</strong> until{" "}
                  <span style={{ color: rankProgress.next.color }}>
                    {rankProgress.next.name}
                  </span>
                </p>
              </>
            ) : (
              <p>
                {isAdmin
                  ? "Admin rank does not level up."
                  : "Maximum explorer rank reached."}
              </p>
            )}
          </section>
          <div className="rankedDivider" aria-hidden="true" />
          <p className="eyebrow">Leaderboard</p>
          <h2>Your points</h2>
          <div className="leaderboardSelf">
            {profile.backgroundUrl && (
              <span
                className="leaderboardEntryBackground"
                aria-hidden="true"
                style={{ backgroundImage: `url("${profile.backgroundUrl}")` }}
              />
            )}
            {profile.avatarUrl ? (
              <span className="leaderboardAvatar"
                style={{ backgroundImage: `url("${profile.avatarUrl}")` }}>
                <PresenceIndicator state={profile.presenceState} lastSeen={profile.lastSeen} />
              </span>
            ) : (
              <span className="leaderboardAvatar leaderboardAvatarFallback">
                {(profile.fullName || profile.username || "Y").slice(0, 1)}
                <PresenceIndicator state={profile.presenceState} lastSeen={profile.lastSeen} />
              </span>
            )}
            <strong className={isAdmin ? "adminAccountName" : undefined}>{profile.fullName || profile.username || "You"}</strong>
            <span>{profile.points} pts</span>
            <RankBadge points={profile.points} isAdmin={isAdmin} />
          </div>
          <h3>Recent friend activity</h3>
          <div className="leaderboardActivity">
            {pointActivity.slice(0, activityExpanded ? undefined : 4).map((event) => (
              <article key={event.event_id}>
                {event.background_url && (
                  <span
                    className="leaderboardEntryBackground"
                    aria-hidden="true"
                    style={{ backgroundImage: `url("${event.background_url}")` }}
                  />
                )}
                {event.avatar_url ? (
                  <span className="leaderboardAvatar"
                    style={{ backgroundImage: `url("${event.avatar_url}")` }}>
                    <PresenceIndicator
                      state={friends.find((friend) => friend.friend_id === event.friend_id)?.presence_state}
                      lastSeen={friends.find((friend) => friend.friend_id === event.friend_id)?.last_seen}
                    />
                  </span>
                ) : (
                  <span className="leaderboardAvatar leaderboardAvatarFallback">
                    {(event.full_name || event.username || "?").slice(0, 1)}
                    <PresenceIndicator
                      state={friends.find((friend) => friend.friend_id === event.friend_id)?.presence_state}
                      lastSeen={friends.find((friend) => friend.friend_id === event.friend_id)?.last_seen}
                    />
                  </span>
                )}
                <div>
                  <strong className={event.is_admin ? "adminAccountName" : undefined}>{event.full_name || event.username} <span className="pointsBadge">{event.total_points} pts</span> <RankBadge points={event.total_points} isAdmin={event.is_admin} /></strong>
                  <p>
                    {event.action_type === "place_added" ? "Added" : "Visited"}{" "}
                    <b>{event.place_name}</b> · +{event.points_awarded}
                  </p>
                  <time dateTime={event.created_at}>
                    {event.created_at.slice(0, 10)}
                  </time>
                </div>
                <Link href={`/dashboard/friends/${event.friend_id}${event.place_id ? `#place-${event.place_id}` : ""}`}>
                  Inspect
                </Link>
              </article>
            ))}
            {!pointActivity.length && <p className="friendEmpty">No friend point activity yet.</p>}
            {pointActivity.length > 4 && (
              <button
                type="button"
                className="leaderboardShowMore"
                aria-expanded={activityExpanded}
                onClick={() => setActivityExpanded((expanded) => !expanded)}
              >
                {activityExpanded
                  ? "Show less"
                  : `Show more (${pointActivity.length - 4})`}
              </button>
            )}
          </div>
        </aside>
        </div>
      )}
      <button
        type="button"
        className={`mapSearchButton${searchOpen ? " mapSearchButtonActive" : ""}`}
        aria-label={searchOpen ? "Close place search" : "Open place search"}
        aria-expanded={searchOpen}
        onClick={() => {
          const nextOpen = !searchOpen;
          setSearchOpen(nextOpen);
          if (nextOpen) {
            setNotificationsOpen(false);
            setPanel(null);
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5 21 21" />
        </svg>
      </button>
      {searchOpen && (
        <aside className="mapSearchDrawer" aria-label="Search places">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search an Ancient place"
            aria-label="Search an Ancient place"
          />
          {placeFilterToggle("Filters", searchFilters, searchFiltersOpen, () =>
            setSearchFiltersOpen((open) => !open),
          )}
          {searchFiltersOpen && placeFilterControls(searchFilters, setSearchFilters)}
          <div className="mapSearchResults">
            {globalSearchResults.map((place) => {
              const nomos = initialNomoi.find((item) => item.id === place.nomos_id);
              return (
                <Link
                  key={place.id}
                  href={`/dashboard/places/${place.id}`}
                  className="mapSearchResult"
                  onClick={() => setSearchOpen(false)}
                >
                  <span
                    className={`mapSearchResultImage${place.image_url ? "" : " mapSearchResultPlaceholder"}`}
                    style={placeImageStyle(place.image_url)}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{place.name}</strong>
                    <small>{[place.location, nomos?.name].filter(Boolean).join(" · ")}</small>
                  </span>
                </Link>
              );
            })}
            {(searchQuery.trim() || activeFilterCount(searchFilters) > 0) &&
              !globalSearchResults.length && (
              <p className="friendEmpty">No places found.</p>
            )}
          </div>
        </aside>
      )}
      <button
        type="button"
        className={`notificationButton${
          hasUnreadNotifications ? " notificationButtonUnread" : ""
        }`}
        aria-label={
          hasUnreadNotifications
            ? "Open notifications, unread updates available"
            : "Open notifications"
        }
        aria-expanded={notificationsOpen}
        onClick={() => {
          const nextOpen = !notificationsOpen;
          setNotificationsOpen(nextOpen);
          if (nextOpen) {
            setSearchOpen(false);
            setPanel(null);
            if (hasUnreadNotifications) {
              setNotificationsRead(true);
              void markNotificationsRead();
            }
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {hasUnreadNotifications && <span className="notificationUnreadDot" />}
      </button>
      {notificationsOpen && (
        <aside className="notificationDrawer" aria-label="Notifications">
          <div className="notificationDrawerHeading">
            <h2>Notifications</h2>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setNotificationsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="notificationList">
            {notifications.map((notification) => (
              <article
                key={notification.reaction_id}
                className={notification.is_unread && !notificationsRead
                  ? "notificationItem notificationItemUnread"
                  : "notificationItem"}
              >
                {notification.reactor_avatar_url ? (
                  <span
                    className="notificationAvatar"
                    style={{
                      backgroundImage: `url("${notification.reactor_avatar_url}")`,
                    }}
                  />
                ) : (
                  <span className="notificationAvatar notificationAvatarFallback">
                    {notification.reactor_name.slice(0, 1)}
                  </span>
                )}
                <div>
                  <p>
                    {notification.notification_type === "friend_request" ? (
                      <><strong>{notification.reactor_name}</strong> sent you a friend request.</>
                    ) : notification.notification_type === "friend_accepted" ? (
                      <>You and <strong>{notification.reactor_name}</strong> are now friends.</>
                    ) : (
                      <>
                      <strong>{notification.reactor_name}</strong> reacted{" "}
                      {notification.reaction === "kilian" ? (
                      <img
                        className="notificationReactionImage"
                        src="/reactions/kiliandictator.jpg"
                        alt="Kilian reaction"
                      />
                      ) : (
                      <span>{notification.reaction}</span>
                      )}{" "}
                      to your visit at <b>{notification.place_name}</b>.
                      </>
                    )}
                  </p>
                  <time dateTime={notification.reacted_at}>
                    {notification.reacted_at.slice(0, 10)}
                  </time>
                </div>
              </article>
            ))}
            {!notifications.length && (
              <p className="friendEmpty">No notifications yet.</p>
            )}
          </div>
        </aside>
      )}
      <button
        type="button"
        className="accountMenuButton"
        aria-label={panel ? "Close account drawer" : "Open account drawer"}
        aria-expanded={panel !== null}
        onClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(false);
          panel ? setPanel(null) : openPanel("account");
        }}
      >
        <span /><span /><span />
      </button>

      <h1>
        {selectedNomos?.name ?? selectedRegion?.name ?? "Explore the Ancients"}
      </h1>

      {selectedNomos ? (
        <>
          <button type="button" className="backButton" onClick={() => setNomosId(null)}>
            ← {selectedRegion?.name}
          </button>
          <section className="ancientGrid">
            {visiblePlaces.map((place) => (
              <PrivateAncientCard
                key={place.id}
                place={place}
                onVisit={(selectedPlace) => {
                  setVisitPhotoPreview("");
                  setVisitPhotoError("");
                  setVisitPlace(selectedPlace);
                }}
                onUnvisit={unvisit}
                canEdit={isAdmin && place.is_global}
                placeLists={placeLists}
              />
            ))}
            {!visiblePlaces.length && (
              <p className="emptyMessage">No ancient places have been added here yet.</p>
            )}
          </section>

          <section className="dashboardPanel privateAddPanel">
            <h2>Add an Ancient</h2>
            <form action={createPlace} className="dashboardForm">
              <input type="hidden" name="nomosId" value={nomosId ?? ""} />
              <input name="name" placeholder="Place name" required />
              <input name="location" placeholder="Location" required />
              <input name="altitude" placeholder="Altitude" />
              <input name="imageUrl" type="url" placeholder="Picture URL" />
              <label>
                Or upload a PNG
                <input name="imageFile" type="file" accept="image/png,.png" />
              </label>
              <input name="latitude" type="number" step="any" placeholder="Latitude" />
              <input name="longitude" type="number" step="any" placeholder="Longitude" />
              <textarea name="description" placeholder="Description" rows={4} />
              <input name="category" placeholder="Category badges, comma separated" />
              <input name="historicalPeriod" placeholder="Historical period badges, comma separated" />
              <input name="constructionDate" placeholder="Construction date" />
              <input name="mainUsePeriod" placeholder="Main use period" />
              <input name="destructionOrEnd" placeholder="Destruction or end" />
              <input name="builtBy" placeholder="Built by" />
              <textarea name="purpose" placeholder="Purpose" rows={3} />
              <textarea name="useChangedDescription" placeholder="Use changed description" rows={3} />
              <input name="accessLevel" placeholder="Access level" />
              <textarea name="accessDescription" placeholder="Access description" rows={3} />
              <input name="ancientAffiliation" placeholder="Ancient affiliation" />
              <input name="connectedMonuments" placeholder="Connected monuments, comma separated" />
              <textarea name="imageSuggestion" placeholder="Image suggestion" rows={3} />
              <label className="visibilityControl">
                <strong>Who can see this place?</strong>
                <select name="visibility" defaultValue={isAdmin ? "public" : "private"}>
                  <option value="private">Private — only me</option>
                  <option value="public">
                    {isAdmin ? "Public — everyone" : "Public — my friends"}
                  </option>
                </select>
              </label>
              <button className="primaryButton">Add place</button>
            </form>
          </section>
          {isAdmin && (
            <button
              type="button"
              className="addAncientButton addAncientModalTrigger"
              onClick={() => setAddingPlace(true)}
            >
              Add an Ancient
            </button>
          )}
        </>
      ) : selectedRegion ? (
        <section className="nomoiGrid">
          <button type="button" className="backButton regionBackButton" onClick={() => setRegionId(null)}>
            ← All regions
          </button>
          {initialNomoi
            .filter((nomos) => nomos.regionId === regionId)
            .map((nomos) => {
              const preference = nomosPreferences.find(
                (item) => item.nomos_id === nomos.id,
              );
              const displayName = preference?.display_name || nomos.name;
              const image = preference?.image_url || nomos.image;
              const placeCount = places.filter(
                (place) => place.nomos_id === nomos.id,
              ).length;

              return (
                <article className="nomosFolder" key={nomos.id}>
                  <button
                    type="button"
                    className="folderOpenButton"
                    onClick={() => setNomosId(nomos.id)}
                  >
                    <div
                      className={`folderImage${image ? "" : " folderImagePlaceholder"}`}
                      style={image ? { backgroundImage: `url("${image}")` } : undefined}
                    >
                      {!image && <span aria-hidden="true">📁</span>}
                    </div>
                    <div className="folderDetails">
                      <h2>{displayName}</h2>
                      <p>{placeCount} {placeCount === 1 ? "place" : "places"}</p>
                    </div>
                  </button>
                  {isAdmin && (
                    <button type="button" className="folderEditButton"
                      onClick={() => setEditingNomos({
                        id: nomos.id,
                        name: displayName,
                        image,
                      })}>
                      Edit
                    </button>
                  )}
                </article>
              );
            })}
        </section>
      ) : (
        browseView === "map" ? (
          <>
          <GreeceNomosMap
            regions={initialRegions.map((region) => {
              const preference = regionPreferences.find(
                (item) => item.region_id === region.id,
              );
              return {
                id: region.id,
                name: preference?.display_name || region.name,
                image: preference?.image_url || region.image,
              };
            })}
            rankings={regionVisitRankings}
            nomoi={initialNomoi.map((nomos) => {
              const preference = nomosPreferences.find(
                (item) => item.nomos_id === nomos.id,
              );
              return {
                id: nomos.id,
                regionId: nomos.regionId,
                name: preference?.display_name || nomos.name,
                image: preference?.image_url || nomos.image,
                placeCount: places.filter(
                  (place) => place.nomos_id === nomos.id,
                ).length,
              };
            })}
            onSelect={(selectedId) => {
              const nomos = initialNomoi.find((item) => item.id === selectedId);
              setRegionId(nomos?.regionId ?? null);
              setNomosId(selectedId);
            }}
            onRegionSelect={(selectedId) => {
              setNomosId(null);
              setRegionId(selectedId);
            }}
          />
          </>
        ) : (
          <>
          <section className="folderSearchPanel" aria-label="Folder search filters">
            {placeFilterToggle("Filters", folderFilters, folderFiltersOpen, () =>
              setFolderFiltersOpen((open) => !open),
            )}
            {folderFiltersOpen && placeFilterControls(folderFilters, setFolderFilters)}
          </section>

          {folderHasFilters ? (
            <section className="ancientGrid folderFilteredGrid" aria-label="Filtered places">
              {folderFilteredPlaces.map((place) => (
                <PrivateAncientCard
                  key={place.id}
                  place={place}
                  onVisit={(selectedPlace) => {
                    setVisitPhotoPreview("");
                    setVisitPhotoError("");
                    setVisitPlace(selectedPlace);
                  }}
                  onUnvisit={unvisit}
                  canEdit={isAdmin && place.is_global}
                  placeLists={placeLists}
                />
              ))}
              {!folderFilteredPlaces.length && (
                <p className="emptyMessage">No places match these filters.</p>
              )}
            </section>
          ) : (
          <section className="regionsGrid">
            {initialRegions.map((region) => {
              const preference = regionPreferences.find(
                (item) => item.region_id === region.id,
              );
              const displayName = preference?.display_name || region.name;
              const image = preference?.image_url || region.image;
              return (
                <article className="regionFolderCard" key={region.id}>
                  <button
                    type="button"
                    className={`regionFolder${image ? " regionFolderWithImage" : ""}`}
                    onClick={() => setRegionId(region.id)}
                  >
                    {image && (
                      <span
                        className="regionFolderBackground"
                        style={{ backgroundImage: `url("${image}")` }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="regionFolderContent">
                      <strong>{displayName}</strong>
                      <small>
                        {initialNomoi.filter(
                          (nomos) => nomos.regionId === region.id,
                        ).length}{" "}
                        νομοί
                      </small>
                    </span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="folderEditButton regionEditButton"
                      onClick={() =>
                        setEditingRegion({
                          id: region.id,
                          name: displayName,
                          image,
                        })
                      }
                    >
                      Edit
                    </button>
                  )}
                </article>
              );
            })}
          </section>
          )}
          </>
        )
      )}

      {visitPlace && (
        <div className="visitModalBackdrop">
          <form
            className="visitModal"
            action={async (formData) => {
              await markVisited(visitPlace.id, formData);
              setVisitPlace(null);
              setVisitPhotoPreview("");
              setVisitPhotoError("");
            }}
          >
            <h2>Mark as Visited</h2>
            <p>{visitPlace.name}</p>
            <label>
              Visit date
              <input
                name="visitDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Visit picture
              <input
                name="visitPhoto"
                type="file"
                accept="image/*"
                onChange={previewVisitPhoto}
                required
              />
            </label>
            <label>
              Who can see this visit picture?
              <select name="visitVisibility" defaultValue="private">
                <option value="private">Private — only me</option>
                <option value="public">Public — friends can see it</option>
              </select>
            </label>
            <label>
              Visit note
              <textarea
                name="visitNote"
                maxLength={500}
                rows={3}
                placeholder="Add a short memory from this visit..."
              />
            </label>
            {visitPhotoPreview && (
              <div
                className="visitPhotoPreview"
                role="img"
                aria-label="Visit preview"
                style={{ backgroundImage: `url("${visitPhotoPreview}")` }}
              />
            )}
            {visitPhotoError && (
              <p className="visitError" role="alert">{visitPhotoError}</p>
            )}
            <div className="editActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => {
                  setVisitPlace(null);
                  setVisitPhotoPreview("");
                  setVisitPhotoError("");
                }}
              >
                Cancel
              </button>
              <button className="addAncientButton">Confirm Visit</button>
            </div>
          </form>
        </div>
      )}

      {editingRegion && (
        <RegionEditModal region={editingRegion} onClose={() => setEditingRegion(null)} />
      )}

      {editingNomos && (
        <NomosEditModal nomos={editingNomos} onClose={() => setEditingNomos(null)} />
      )}

      {addingPlace && selectedNomos && isAdmin && (
        <div
          className="regionEditBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAddingPlace(false);
          }}
        >
          <section
            className="regionEditModal addAncientModal noWindowAnimation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-ancient-title"
          >
            <button
              type="button"
              className="panelClose"
              aria-label="Close add place window"
              onClick={() => setAddingPlace(false)}
            >
              ×
            </button>
            <h2 id="add-ancient-title">Add an Ancient</h2>
            <p className="addAncientDestination">{selectedNomos.name}</p>
            <form
              action={async (formData) => {
                await createPlace(formData);
                setAddingPlace(false);
              }}
              className="dashboardForm"
            >
              <input type="hidden" name="nomosId" value={nomosId ?? ""} />
              <input name="name" placeholder="Place name" required />
              <input name="location" placeholder="Location" required />
              <input name="altitude" placeholder="Altitude" />
              <input name="imageUrl" type="url" placeholder="Picture URL" />
              <label>
                Or upload a PNG
                <input name="imageFile" type="file" accept="image/png,.png" />
              </label>
              <input name="latitude" type="number" step="any" placeholder="Latitude" />
              <input name="longitude" type="number" step="any" placeholder="Longitude" />
              <textarea name="description" placeholder="Description" rows={4} />
              <input name="category" placeholder="Category badges, comma separated" />
              <input name="historicalPeriod" placeholder="Historical period badges, comma separated" />
              <input name="constructionDate" placeholder="Construction date" />
              <input name="mainUsePeriod" placeholder="Main use period" />
              <input name="destructionOrEnd" placeholder="Destruction or end" />
              <input name="builtBy" placeholder="Built by" />
              <textarea name="purpose" placeholder="Purpose" rows={3} />
              <textarea name="useChangedDescription" placeholder="Use changed description" rows={3} />
              <input name="accessLevel" placeholder="Access level" />
              <textarea name="accessDescription" placeholder="Access description" rows={3} />
              <input name="ancientAffiliation" placeholder="Ancient affiliation" />
              <input name="connectedMonuments" placeholder="Connected monuments, comma separated" />
              <textarea name="imageSuggestion" placeholder="Image suggestion" rows={3} />
              <div className="editActions">
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => setAddingPlace(false)}
                >
                  Cancel
                </button>
                <button className="primaryButton">Add place</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {panel && (
        <div className={`accountPanelBackdrop${panelClosing ? " accountPanelBackdropClosing" : ""}`} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePanel();
        }}>
          <aside className={`accountPanel${panelClosing ? " accountPanelClosing" : ""}`}>
            {profile.backgroundUrl && (
              <div
                className="accountPanelBackground"
                aria-hidden="true"
                style={{ backgroundImage: `url("${profile.backgroundUrl}")` }}
              />
            )}
            <nav className="accountPanelNavigation" aria-label="Account sections">
              <button
                type="button"
                className={panel === "account" ? "accountPanelNavigationActive" : ""}
                onClick={() => openPanel("account")}
              >
                Account
              </button>
              <button
                type="button"
                className={panel === "friends" ? "accountPanelNavigationActive" : ""}
                onClick={() => openPanel("friends")}
              >
                Friends
              </button>
              <button
                type="button"
                className={panel === "lists" ? "accountPanelNavigationActive" : ""}
                onClick={() => openPanel("lists")}
              >
                Lists
              </button>
              <button
                type="button"
                className={panel === "settings" ? "accountPanelNavigationActive" : ""}
                onClick={() => openPanel("settings")}
              >
                Settings
              </button>
            </nav>
            {panel === "account" ? (
              <>
                <p className="eyebrow">Private dashboard</p>
                <h2>Account</h2>
                {profile.avatarUrl && (
                  <div
                    className="accountAvatar"
                    role="img"
                    aria-label={`${profile.fullName || "Account"} avatar`}
                    style={{ backgroundImage: `url("${profile.avatarUrl}")` }}
                  >
                    <PresenceIndicator state={profile.presenceState} lastSeen={profile.lastSeen} />
                  </div>
                )}
                <h3 className={isAdmin ? "adminAccountName" : undefined}>{profile.fullName || "Unnamed explorer"} <span className="pointsBadge">{profile.points} pts</span> <RankBadge points={profile.points} isAdmin={isAdmin} /></h3>
                {profile.username && <p>@{profile.username}</p>}
                <p>{email}</p>
                {profile.bio && <p className="accountBio">{profile.bio}</p>}
                {profile.location && <p>Based in {profile.location}</p>}
                {profile.profileGifUrl && (
                  <img
                    className="accountProfileGif"
                    src={profile.profileGifUrl}
                    alt={`${profile.fullName || profile.username}'s chosen GIF`}
                  />
                )}

                <form action={signOut}>
                  <button className="secondaryButton">Sign out</button>
                </form>
              </>
            ) : panel === "friends" ? (
              <FriendsPanel
                friends={friends}
                requests={requests}
                userId={userId}
                avatarUrl={profile.avatarUrl}
                displayName={profile.fullName || profile.username || "You"}
              />
            ) : panel === "lists" ? (
              <ListsPanel lists={placeLists} places={places} />
            ) : (
              <>
                <p className="eyebrow">Preferences</p>
                <h2>Settings</h2>
                <ProfileEditForm profile={profile} />
                {isAdmin && (
                  <details className="mapAdminRegionSettings">
                    <summary>Manage region appearance</summary>
                    <div className="regionsGrid">
                      {initialRegions.map((region) => {
                        const preference = regionPreferences.find(
                          (item) => item.region_id === region.id,
                        );
                        const displayName = preference?.display_name || region.name;
                        const image = preference?.image_url || "";
                        return (
                          <button
                            type="button"
                            className="secondaryButton"
                            key={region.id}
                            onClick={() => setEditingRegion({
                              id: region.id,
                              name: displayName,
                              image,
                            })}
                          >
                            Edit {displayName}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
                <section className="settingsSaveSection">
                  <h3>Import / Export Save</h3>
                  <p>Back up or restore your places and folder customizations.</p>
                  <div className="settingsSaveActions">
                    <button type="button" className="secondaryButton" onClick={exportDashboard}>
                      Export Save
                    </button>
                    <button type="button" className="secondaryButton"
                      onClick={() => saveInputRef.current?.click()}>
                      Import Save
                    </button>
                  </div>
                  <form action={importAction}>
                    <input ref={saveInputRef} className="visuallyHidden" type="file"
                      name="saveFile" accept="application/json,.json"
                      onChange={(event) => event.currentTarget.form?.requestSubmit()} />
                  </form>
                  {importState.message && <p className="fileMessage" role="status">{importState.message}</p>}
                </section>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}


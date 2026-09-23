"use client";

import { MouseEvent, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_PLACE_IMAGE_URL } from "@/app/placeImages";
import RankBadge from "../../RankBadge";
import PresenceIndicator from "../../PresenceIndicator";
import { reactToVisit } from "../../actions";

type FriendPlace = {
  id: string;
  name: string;
  location: string;
  description: string;
  imageUrl: string;
  visitDate: string;
  visitPhoto: string;
  visitNote: string;
  reactions: Record<string, number>;
  reactors: {
    emoji: string;
    userId: string;
    name: string;
    avatarUrl: string | null;
  }[];
  viewerReaction: string;
};

function placeImageStyle(imageUrl: string | null | undefined) {
  return { backgroundImage: `url("${imageUrl || DEFAULT_PLACE_IMAGE_URL}")` };
}

export default function FriendProfile({
  friend,
  places,
  isOwnProfile = false,
}: {
  friend: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string;
    backgroundUrl: string;
    isAdmin: boolean;
    presenceState: string;
    lastSeen: string;
    bio: string;
    location: string;
    website: string;
    profileGifUrl: string;
    points: number;
  };
  places: FriendPlace[];
  isOwnProfile?: boolean;
}) {
  const router = useRouter();
  const [reactionPending, startReactionTransition] = useTransition();
  const [preview, setPreview] = useState<{
    photo: string;
    placeName: string;
    x: number;
    y: number;
  } | null>(null);
  const [inspectingVisit, setInspectingVisit] = useState<FriendPlace | null>(null);
  const reactionEmoji = [
    "\u{1F44D}",
    "\u{2764}\u{FE0F}",
    "\u{1F525}",
    "\u{1F62E}",
    "\u{1F602}",
    "\u{1F44F}",
    "\u{1F3DB}\u{FE0F}",
    "\u{1F5FA}\u{FE0F}",
    "kilian",
  ];

  function react(place: FriendPlace, emoji: string) {
    const previousReaction = place.viewerReaction;
    const nextReaction = previousReaction === emoji ? "" : emoji;
    const nextReactions = { ...place.reactions };

    if (previousReaction) {
      nextReactions[previousReaction] = Math.max(
        0,
        (nextReactions[previousReaction] ?? 0) - 1,
      );
    }
    if (nextReaction) {
      nextReactions[nextReaction] = (nextReactions[nextReaction] ?? 0) + 1;
    }

    const optimisticPlace = {
      ...place,
      reactions: nextReactions,
      viewerReaction: nextReaction,
    };
    setInspectingVisit(optimisticPlace);

    startReactionTransition(async () => {
      try {
        await reactToVisit(friend.id, place.id, emoji);
        router.refresh();
      } catch {
        setInspectingVisit(place);
      }
    });
  }

  function reactionSummary(place: FriendPlace) {
    return Object.entries(place.reactions).filter(([, count]) => count > 0);
  }

  function reactorsFor(place: FriendPlace, emoji: string) {
    return place.reactors.filter((reactor) => reactor.emoji === emoji);
  }

  function reactionVisual(reaction: string) {
    if (reaction === "kilian") {
      return (
        <img
          className="customReactionImage"
          src="/reactions/kiliandictator.jpg"
          alt="Kilian reaction"
        />
      );
    }
    return reaction;
  }

  function reactionPeople(place: FriendPlace, emoji: string) {
    const reactors = reactorsFor(place, emoji);
    if (!reactors.length) return null;

    return (
      <span className="visitReactionPeople" role="tooltip">
        {reactors.map((reactor) => (
          <span className="visitReactionPerson" key={`${emoji}-${reactor.userId}`}>
            {reactor.avatarUrl ? (
              <span
                className="visitReactionAvatar"
                role="img"
                aria-label={`${reactor.name} profile picture`}
                style={{ backgroundImage: `url("${reactor.avatarUrl}")` }}
              />
            ) : (
              <span className="visitReactionAvatar visitReactionAvatarFallback">
                {reactor.name.slice(0, 1)}
              </span>
            )}
            <strong>{reactor.name}</strong>
          </span>
        ))}
      </span>
    );
  }

  function movePreview(event: MouseEvent<HTMLElement>, place: FriendPlace) {
    if (!place.visitPhoto) return;
    setPreview({
      photo: place.visitPhoto,
      placeName: place.name,
      x: Math.max(8, Math.min(event.clientX + 18, window.innerWidth - 300)),
      y: Math.max(8, Math.min(event.clientY + 18, window.innerHeight - 300)),
    });
  }

  return (
    <main className="friendProfilePage">
      {friend.backgroundUrl && (
        <div
          className="friendProfileBackground"
          aria-hidden="true"
          style={{ backgroundImage: `url("${friend.backgroundUrl}")` }}
        />
      )}
      <Link href="/dashboard" className="friendProfileBack">← Dashboard</Link>
      {isOwnProfile && (
        <p className="profilePreviewNotice">
          Profile preview — this is what your friends can see.
        </p>
      )}

      <header className="friendProfileHero">
        {friend.avatarUrl ? (
          <div
            className="friendProfileAvatar"
            role="img"
            aria-label={`${friend.fullName || friend.username} profile picture`}
            style={{ backgroundImage: `url("${friend.avatarUrl}")` }}
          >
            <PresenceIndicator state={friend.presenceState} lastSeen={friend.lastSeen} />
          </div>
        ) : (
          <div className="friendProfileAvatar friendProfileAvatarFallback">
            {(friend.fullName || friend.username || "?").slice(0, 1)}
            <PresenceIndicator state={friend.presenceState} lastSeen={friend.lastSeen} />
          </div>
        )}
        <div>
          <p className="eyebrow">Fellow explorer</p>
          <h1 className={friend.isAdmin ? "adminAccountName" : undefined}>
            {friend.fullName || friend.username || "Unnamed explorer"}{" "}
            <span className="pointsBadge">{friend.points} pts</span>
            {" "}
            <RankBadge points={friend.points} isAdmin={friend.isAdmin} />
          </h1>
          {friend.username && <p className="friendProfileUsername">@{friend.username}</p>}
          {friend.bio && <p className="friendProfileBio">{friend.bio}</p>}
          <div className="friendProfileMeta">
            {friend.location && <span>Based in {friend.location}</span>}
          </div>
          {friend.profileGifUrl && (
            <img
              className="friendProfileGif"
              src={friend.profileGifUrl}
              alt={`${friend.fullName || friend.username}'s chosen GIF`}
            />
          )}
        </div>
      </header>

      <section className="friendVisitedSection">
        <div className="friendVisitedHeading">
          <div>
            <p className="eyebrow">Travel journal</p>
            <h2>Places visited</h2>
          </div>
          <span>{places.length} {places.length === 1 ? "place" : "places"}</span>
        </div>

        {places.length ? (
          <div className="friendVisitedGrid">
            {places.map((place) => (
              <article
                className="friendVisitedCard"
                key={place.id}
                id={`place-${place.id}`}
                role="button"
                tabIndex={0}
                onMouseMove={(event) => movePreview(event, place)}
                onMouseLeave={() => setPreview(null)}
                onClick={() => {
                  setPreview(null);
                  setInspectingVisit(place);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setPreview(null);
                  setInspectingVisit(place);
                }}
              >
                {place.imageUrl ? (
                  <div
                    className="friendPlaceImage"
                    role="img"
                    aria-label={place.name}
                    style={placeImageStyle(place.imageUrl)}
                  />
                ) : (
                  <div
                    className="friendPlaceImage friendPlaceImageFallback"
                    role="img"
                    aria-label="Default ancient place image"
                    style={placeImageStyle(place.imageUrl)}
                  />
                )}
                <div className="friendPlaceDetails">
                  <time dateTime={place.visitDate}>{place.visitDate}</time>
                  <h3>{place.name}</h3>
                  <p className="friendPlaceLocation">{place.location}</p>
                  {place.description && <p>{place.description}</p>}
                  <div className="visitReactionSummary" aria-label="Visit reactions">
                    {reactionSummary(place).map(([emoji, count]) => (
                      <span className="visitReactionBadge" tabIndex={0} key={emoji}>
                        {reactionVisual(emoji)} {count}
                        {reactionPeople(place, emoji)}
                      </span>
                    ))}
                  </div>
                  <small>
                    {place.visitPhoto
                      ? "Hover or click to inspect this visit"
                      : "Click to inspect this visit"}
                  </small>
                  <Link
                    className="friendVisitedInfoButton"
                    href={`/dashboard/places/${place.id}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    View ancient
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="friendProfileEmpty">No visited places shared yet.</p>
        )}
      </section>

      {preview &&
        createPortal(
          <aside
            className="friendVisitHoverPreview"
            style={{ left: preview.x, top: preview.y }}
            aria-hidden="true"
          >
            <div
              className="friendVisitHoverPhoto"
              style={{ backgroundImage: `url("${preview.photo}")` }}
            />
            <strong>{preview.placeName}</strong>
          </aside>,
          document.body,
        )}

      {inspectingVisit &&
        createPortal(
          <div
            className="visitInspectionBackdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setInspectingVisit(null);
            }}
          >
            <section
              className="visitInspectionWindow"
              role="dialog"
              aria-modal="true"
              aria-labelledby="visit-inspection-title"
            >
              <button
                type="button"
                className="visitInspectionClose"
                aria-label="Close visit inspection"
                onClick={() => setInspectingVisit(null)}
              >
                ×
              </button>
              {inspectingVisit.visitPhoto ? (
                <img
                  src={inspectingVisit.visitPhoto}
                  alt={`Visit to ${inspectingVisit.name}`}
                />
              ) : (
                <div className="visitInspectionPrivatePhoto">
                  This visit photo is private.
                </div>
              )}
              <div className="visitInspectionDetails">
                <time dateTime={inspectingVisit.visitDate}>
                  {inspectingVisit.visitDate}
                </time>
                <h2 id="visit-inspection-title">{inspectingVisit.name}</h2>
                {inspectingVisit.visitNote ? (
                  <p>{inspectingVisit.visitNote}</p>
                ) : (
                  <p className="friendEmpty">No visit note was added.</p>
                )}
                {!isOwnProfile && (
                  <div className="visitReactionPicker" aria-label="React to this visit">
                    {reactionEmoji.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        className={
                          inspectingVisit.viewerReaction === emoji
                            ? "visitReactionOption visitReactionOptionActive"
                            : "visitReactionOption"
                        }
                        aria-label={
                          emoji === "kilian"
                            ? "React with Kilian"
                            : `React with ${emoji}`
                        }
                        aria-pressed={inspectingVisit.viewerReaction === emoji}
                        disabled={reactionPending}
                        onClick={() => react(inspectingVisit, emoji)}
                      >
                        <span>{reactionVisual(emoji)}</span>
                        {(inspectingVisit.reactions[emoji] ?? 0) > 0 && (
                          <small>{inspectingVisit.reactions[emoji]}</small>
                        )}
                        {reactionPeople(inspectingVisit, emoji)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </main>
  );
}

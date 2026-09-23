export type PresenceState = "active" | "away" | "offline";

export function resolvedPresence(
  state: string | null | undefined,
  lastSeen: string | null | undefined,
): PresenceState {
  if (!lastSeen) return "offline";
  const age = Date.now() - new Date(lastSeen).getTime();
  if (!Number.isFinite(age) || age > 150_000) return "offline";
  return state === "away" ? "away" : state === "active" ? "active" : "offline";
}

export default function PresenceIndicator({
  state,
  lastSeen,
}: {
  state: string | null | undefined;
  lastSeen: string | null | undefined;
}) {
  const presence = resolvedPresence(state, lastSeen);
  return (
    <span
      className={`presenceIndicator presence${presence[0].toUpperCase()}${presence.slice(1)}`}
      aria-label={presence}
      title={presence[0].toUpperCase() + presence.slice(1)}
    />
  );
}

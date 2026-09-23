import type { CSSProperties } from "react";
import { getExplorerRank } from "./ranks";

export default function RankBadge({
  points,
  isAdmin = false,
}: {
  points: number;
  isAdmin?: boolean;
}) {
  const rank = getExplorerRank(points, isAdmin);
  return (
    <span
      className="rankBadge"
      style={{
        "--rank-color": rank.color,
      } as CSSProperties}
    >
      {rank.name}
    </span>
  );
}

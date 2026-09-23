export type ExplorerRank = {
  id: string;
  name: string;
  minimumPoints: number;
  color: string;
};

export const explorerRanks: ExplorerRank[] = [
  { id: "newbie", name: "Newbie", minimumPoints: 0, color: "#79bff2" },
  { id: "wanderer", name: "Wanderer", minimumPoints: 50, color: "#55c7c2" },
  { id: "pathfinder", name: "Pathfinder", minimumPoints: 150, color: "#72bd78" },
  { id: "antiquarian", name: "Antiquarian", minimumPoints: 350, color: "#a98bd4" },
  { id: "historian", name: "Historian", minimumPoints: 700, color: "#df9258" },
  { id: "elite-explorer", name: "Elite Explorer", minimumPoints: 1200, color: "#b8c2cc" },
  { id: "master-explorer", name: "Master Explorer", minimumPoints: 2000, color: "#e2b93f" },
];

export const adminRank: ExplorerRank = {
  id: "admin",
  name: "Admin",
  minimumPoints: 0,
  color: "#d94b4b",
};

export function getExplorerRank(points: number, isAdmin = false) {
  if (isAdmin) return adminRank;
  return [...explorerRanks]
    .reverse()
    .find((rank) => points >= rank.minimumPoints) ?? explorerRanks[0];
}

export function getNextExplorerRank(points: number, isAdmin = false) {
  if (isAdmin) return null;
  return explorerRanks.find((rank) => rank.minimumPoints > points) ?? null;
}

export function getRankProgress(points: number, isAdmin = false) {
  const current = getExplorerRank(points, isAdmin);
  const next = getNextExplorerRank(points, isAdmin);
  if (!next) return { current, next, progress: 100, remaining: 0 };
  const span = next.minimumPoints - current.minimumPoints;
  const earned = points - current.minimumPoints;
  return {
    current,
    next,
    progress: Math.max(0, Math.min(100, (earned / span) * 100)),
    remaining: next.minimumPoints - points,
  };
}

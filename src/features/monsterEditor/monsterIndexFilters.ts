import type { MonsterIndexEntry } from "./storage";

export type MonsterRankFilter = "all" | "minion" | "standard" | "elite" | "solo";

export type MonsterLeaderFilter = "both" | "leader" | "notLeader";

export type MonsterIndexSortBy = "name" | "level";

export type MonsterIndexSortDir = "asc" | "desc";

export interface MonsterIndexListFilters {
  nameQuery: string;
  levelQuery: string;
  roleQuery: string;
  rankFilter: MonsterRankFilter;
  leaderFilter: MonsterLeaderFilter;
  sortBy: MonsterIndexSortBy;
  sortDir: MonsterIndexSortDir;
}

export function parseLevelFilter(rawFilter: string): { exact?: number; range?: { min: number; max: number } } {
  const trimmed = rawFilter.trim();
  if (!trimmed) return {};

  if (/^-?\d+$/.test(trimmed)) {
    return { exact: Number(trimmed) };
  }

  const rangeMatch = trimmed.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return { range: { min: Math.min(start, end), max: Math.max(start, end) } };
    }
  }

  return {};
}

export function detectMonsterRank(entry: MonsterIndexEntry): Exclude<MonsterRankFilter, "all"> {
  const normalized = String(entry.groupRole ?? entry.role ?? "")
    .trim()
    .toLowerCase();
  if (normalized.includes("minion")) return "minion";
  if (normalized.includes("elite")) return "elite";
  if (normalized.includes("solo")) return "solo";
  return "standard";
}

export function filterAndSortMonsterIndexRows(
  indexRows: MonsterIndexEntry[],
  {
    nameQuery,
    levelQuery,
    roleQuery,
    rankFilter,
    leaderFilter,
    sortBy,
    sortDir
  }: MonsterIndexListFilters
): MonsterIndexEntry[] {
  const nameNeedle = nameQuery.trim().toLowerCase();
  const roleNeedle = roleQuery.trim().toLowerCase();
  const rawLevelFilter = levelQuery.trim();
  const parsedLevelFilter = parseLevelFilter(rawLevelFilter);

  const rows = indexRows.filter((entry) => {
    if (nameNeedle && !entry.name.toLowerCase().includes(nameNeedle)) {
      return false;
    }

    if (roleNeedle && !entry.role.toLowerCase().includes(roleNeedle)) {
      return false;
    }

    if (rankFilter !== "all" && detectMonsterRank(entry) !== rankFilter) {
      return false;
    }

    const isLeader = entry.isLeader === true;
    if (leaderFilter === "leader" && !isLeader) {
      return false;
    }
    if (leaderFilter === "notLeader" && isLeader) {
      return false;
    }

    if (!rawLevelFilter) {
      return true;
    }

    const levelAsNumber = Number(entry.level);
    if (!Number.isFinite(levelAsNumber)) {
      return false;
    }

    if (parsedLevelFilter.exact !== undefined) {
      return levelAsNumber === parsedLevelFilter.exact;
    }
    if (parsedLevelFilter.range) {
      return levelAsNumber >= parsedLevelFilter.range.min && levelAsNumber <= parsedLevelFilter.range.max;
    }
    return false;
  });

  return [...rows].sort((a, b) => {
    if (sortBy === "level") {
      const levelA = Number(a.level);
      const levelB = Number(b.level);
      const hasLevelA = Number.isFinite(levelA);
      const hasLevelB = Number.isFinite(levelB);
      if (hasLevelA && hasLevelB && levelA !== levelB) {
        return sortDir === "asc" ? levelA - levelB : levelB - levelA;
      }
      if (hasLevelA !== hasLevelB) {
        return hasLevelA ? -1 : 1;
      }
    }

    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (byName !== 0) {
      return sortDir === "asc" ? byName : -byName;
    }
    return a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
  });
}

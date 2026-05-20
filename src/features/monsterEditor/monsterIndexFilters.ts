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
  keywordQuery: string;
  sourceBookQuery: string;
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

export function normalizeMonsterIndexKeywords(keywords: MonsterIndexEntry["keywords"]): string[] {
  if (!Array.isArray(keywords)) return [];
  return keywords.map((kw) => String(kw ?? "").trim()).filter(Boolean);
}

export function normalizeMonsterIndexSourceBooks(sourceBooks: MonsterIndexEntry["sourceBooks"]): string[] {
  if (!Array.isArray(sourceBooks)) return [];
  return sourceBooks.map((book) => String(book ?? "").trim()).filter(Boolean);
}

export function entryMatchesKeywordFilter(entry: MonsterIndexEntry, keywordQuery: string): boolean {
  const needle = keywordQuery.trim().toLowerCase();
  if (!needle) return true;
  const keywords = normalizeMonsterIndexKeywords(entry.keywords);
  if (keywords.length === 0) return false;
  return keywords.some((kw) => kw.toLowerCase().includes(needle));
}

export function entryMatchesSourceBookFilter(entry: MonsterIndexEntry, sourceBookQuery: string): boolean {
  const needle = sourceBookQuery.trim().toLowerCase();
  if (!needle) return true;
  const books = normalizeMonsterIndexSourceBooks(entry.sourceBooks);
  if (books.length === 0) return false;
  return books.some((book) => book.toLowerCase().includes(needle));
}

export function collectMonsterIndexFilterOptions(indexRows: MonsterIndexEntry[]): {
  roles: string[];
  keywords: string[];
  sourceBooks: string[];
  hasKeywordMetadata: boolean;
  hasSourceBookMetadata: boolean;
} {
  const roles = new Set<string>();
  const keywords = new Set<string>();
  const sourceBooks = new Set<string>();
  let hasKeywordMetadata = false;
  let hasSourceBookMetadata = false;

  for (const row of indexRows) {
    const role = (row.role ?? "").trim();
    if (role) roles.add(role);
    const rowKeywords = normalizeMonsterIndexKeywords(row.keywords);
    if (rowKeywords.length > 0) hasKeywordMetadata = true;
    for (const kw of rowKeywords) keywords.add(kw);
    const rowBooks = normalizeMonsterIndexSourceBooks(row.sourceBooks);
    if (rowBooks.length > 0) hasSourceBookMetadata = true;
    for (const book of rowBooks) sourceBooks.add(book);
  }

  return {
    roles: Array.from(roles).sort((a, b) => a.localeCompare(b)),
    keywords: Array.from(keywords).sort((a, b) => a.localeCompare(b)),
    sourceBooks: Array.from(sourceBooks).sort((a, b) => a.localeCompare(b)),
    hasKeywordMetadata,
    hasSourceBookMetadata
  };
}

export function monsterIndexHasActiveFilters(filters: MonsterIndexListFilters): boolean {
  return Boolean(
    filters.nameQuery.trim() ||
      filters.levelQuery.trim() ||
      filters.roleQuery.trim() ||
      filters.rankFilter !== "all" ||
      filters.leaderFilter !== "both" ||
      filters.keywordQuery.trim() ||
      filters.sourceBookQuery.trim()
  );
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
    keywordQuery,
    sourceBookQuery,
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

    if (!entryMatchesKeywordFilter(entry, keywordQuery)) {
      return false;
    }

    if (!entryMatchesSourceBookFilter(entry, sourceBookQuery)) {
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

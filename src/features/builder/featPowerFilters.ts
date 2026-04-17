import type { Feat, Power } from "../../rules/models";

/** Case-insensitive match on name, slug, or source (for themes, paths, etc.). */
export function matchesNameSourceSearch(
  item: { name: string; slug: string; source?: string | null },
  queryLower: string
): boolean {
  if (!queryLower) return true;
  if (item.name.toLowerCase().includes(queryLower)) return true;
  if (item.slug.toLowerCase().includes(queryLower)) return true;
  if (item.source?.toLowerCase().includes(queryLower)) return true;
  return false;
}

export function filterRulesEntitiesByQuery<T extends { name: string; slug: string; source?: string | null }>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => matchesNameSourceSearch(i, q));
}

export function ensureSelectedEntityInFiltered<T extends { id: string }>(
  filtered: T[],
  selectedId: string | undefined,
  pool: T[]
): T[] {
  if (!selectedId) return filtered;
  if (filtered.some((x) => x.id === selectedId)) return filtered;
  const row = pool.find((x) => x.id === selectedId);
  return row ? [row, ...filtered] : filtered;
}
import type { ResolvedOption } from "../../rules/optionResolver";

export type FeatSortMode = "tier-alpha" | "alpha" | "source-alpha";

export interface FeatFilterState {
  query: string;
  tier: "all" | "HEROIC" | "PARAGON" | "EPIC";
  category: string;
  source: string;
}

function normalized(value: string | null | undefined): string {
  return String(value || "").trim();
}

function lower(value: string | null | undefined): string {
  return normalized(value).toLowerCase();
}

function normalizedFeatTier(feat: Feat): "HEROIC" | "PARAGON" | "EPIC" | "" {
  const tier = lower(feat.tier);
  if (tier.startsWith("heroic")) return "HEROIC";
  if (tier.startsWith("paragon")) return "PARAGON";
  if (tier.startsWith("epic")) return "EPIC";
  return "";
}

function featSearchHaystack(feat: Feat): string {
  const raw = feat.raw as Record<string, unknown>;
  const specific = (raw.specific as Record<string, unknown> | undefined) || {};
  const specificShort = typeof specific["Short Description"] === "string" ? specific["Short Description"] : "";
  const body = typeof raw.body === "string" ? raw.body : "";
  const category = normalized(feat.category);
  const tags = (feat.tags || []).join(" ");
  const prereqSummary = normalized(feat.prereqSummary);
  const prereqsRaw = normalized(feat.prereqsRaw);
  return [
    feat.name,
    feat.slug,
    feat.source,
    feat.tier,
    feat.shortDescription,
    specificShort,
    category,
    tags,
    prereqSummary,
    prereqsRaw,
    body
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getFeatFacetCategory(feat: Feat): string {
  const category = normalized(feat.category);
  if (category) return category;
  if (feat.tags && feat.tags.length > 0) {
    const candidate = feat.tags.find((t) => !t.toLowerCase().startsWith("tier:"));
    if (candidate) return candidate;
  }
  return "General";
}

function featTierRank(feat: Feat): number {
  const t = normalizedFeatTier(feat);
  if (t === "HEROIC") return 0;
  if (t === "PARAGON") return 1;
  if (t === "EPIC") return 2;
  return 3;
}

export function matchesFeatSearch(feat: Feat, queryLower: string): boolean {
  if (!queryLower) return true;
  return featSearchHaystack(feat).includes(queryLower);
}

/** Filter feat options (any mix of legal/illegal) by search string (trimmed, case-insensitive). */
export function filterFeatOptionsByQuery(options: ResolvedOption<Feat>[], query: string): ResolvedOption<Feat>[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => matchesFeatSearch(o.item, q));
}

/** @deprecated Use filterFeatOptionsByQuery */
export const filterLegalFeatOptions = filterFeatOptionsByQuery;

export function filterFeatOptions(options: ResolvedOption<Feat>[], filters: FeatFilterState): ResolvedOption<Feat>[] {
  const q = filters.query.trim().toLowerCase();
  const tier = filters.tier;
  const category = lower(filters.category);
  const source = lower(filters.source);

  return options.filter((o) => {
    const feat = o.item;
    if (q && !matchesFeatSearch(feat, q)) return false;
    if (tier !== "all" && normalizedFeatTier(feat) !== tier) return false;
    if (category && category !== "all" && lower(getFeatFacetCategory(feat)) !== category) return false;
    if (source && source !== "all" && lower(feat.source) !== source) return false;
    return true;
  });
}

export function sortFeatOptions(options: ResolvedOption<Feat>[], mode: FeatSortMode): ResolvedOption<Feat>[] {
  const rows = [...options];
  rows.sort((a, b) => {
    if (mode === "tier-alpha") {
      const tierA = featTierRank(a.item);
      const tierB = featTierRank(b.item);
      if (tierA !== tierB) return tierA - tierB;
      return a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
    }
    if (mode === "source-alpha") {
      const sourceA = lower(a.item.source);
      const sourceB = lower(b.item.source);
      if (sourceA !== sourceB) return sourceA.localeCompare(sourceB, undefined, { sensitivity: "base" });
      return a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
    }
    return a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
  });
  return rows;
}

/**
 * If the selected feat would be hidden by the filter, prepend it so the user still sees the current pick.
 * `lookupPool` should be the full resolved list (e.g. all feats) so a selected-but-illegal feat still appears when only legal rows are shown.
 */
export function ensureSelectedFeatInList(
  filtered: ResolvedOption<Feat>[],
  selectedId: string | undefined,
  lookupPool: ResolvedOption<Feat>[]
): ResolvedOption<Feat>[] {
  if (!selectedId) return filtered;
  if (filtered.some((o) => o.item.id === selectedId)) return filtered;
  const selected = lookupPool.find((o) => o.item.id === selectedId);
  if (!selected) return filtered;
  return [selected, ...filtered];
}

/** Keep every selected feat visible when filtered out of search (e.g. multi-feat builds). */
export function ensureSelectedFeatsInList(
  filtered: ResolvedOption<Feat>[],
  selectedIds: string[],
  lookupPool: ResolvedOption<Feat>[]
): ResolvedOption<Feat>[] {
  if (selectedIds.length === 0) return filtered;
  const have = new Set(filtered.map((o) => o.item.id));
  const prepend: ResolvedOption<Feat>[] = [];
  for (const id of selectedIds) {
    if (have.has(id)) continue;
    const row = lookupPool.find((o) => o.item.id === id);
    if (row) {
      prepend.push(row);
      have.add(id);
    }
  }
  return prepend.length > 0 ? [...prepend, ...filtered] : filtered;
}

function powerHaystack(power: Power): string {
  const spec = (power.raw?.specific as Record<string, unknown> | undefined) || {};
  const kw = String(spec["Keywords"] ?? power.keywords ?? "");
  return `${power.name} ${power.usage ?? ""} ${kw}`.toLowerCase();
}

export function filterPowersByQuery(powers: Power[], query: string): Power[] {
  const q = query.trim().toLowerCase();
  if (!q) return powers;
  return powers.filter((p) => powerHaystack(p).includes(q));
}

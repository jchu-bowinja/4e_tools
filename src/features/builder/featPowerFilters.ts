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

export type FeatSourceFilterMode = "all" | "include" | "exclude";

export interface FeatSourceFilter {
  mode: FeatSourceFilterMode;
  /** Canonical source labels from compendium data. */
  sources: string[];
}

export const EMPTY_FEAT_SOURCE_FILTER: FeatSourceFilter = { mode: "all", sources: [] };

export type FeatTier = "HEROIC" | "PARAGON" | "EPIC";

export const FEAT_TIER_OPTIONS: readonly { value: FeatTier; label: string }[] = [
  { value: "HEROIC", label: "Heroic" },
  { value: "PARAGON", label: "Paragon" },
  { value: "EPIC", label: "Epic" }
];

export interface FeatFilterState {
  query: string;
  /** When false (default), query matches feat name only; when true, matches full feat text haystack. */
  filterAllText?: boolean;
  /** Empty = no tier restriction (all tiers). */
  tiers: FeatTier[];
  /** Empty = no category restriction (all categories). */
  categories: string[];
  source: FeatSourceFilter;
}

/** Closed-control summary for facet multiselects (e.g. "All tiers" or "Tier: Heroic, Paragon"). */
export function formatFeatFacetMultiSelectSummary(
  prefix: string,
  selectedLabels: string[],
  allLabel: string
): string {
  if (selectedLabels.length === 0) return allLabel;
  return `${prefix}: ${selectedLabels.join(", ")}`;
}

/** Closed-control summary for the feat source filter dropdown. */
export function formatFeatSourceFilterSummary(filter: FeatSourceFilter, allLabel = "All sources"): string {
  if (filter.mode === "all" || filter.sources.length === 0) return allLabel;
  const prefix = filter.mode === "include" ? "Include" : "Exclude";
  return `${prefix}: ${filter.sources.join(", ")}`;
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

export interface FeatTagPillStyle {
  background: string;
  color: string;
}

function featTagPill(accentVar: string, mixPercent = 20): FeatTagPillStyle {
  return {
    background: `color-mix(in srgb, ${accentVar} ${mixPercent}%, var(--surface-2))`,
    color: accentVar
  };
}

const FEAT_TAG_PILL_STYLES: Record<string, FeatTagPillStyle> = {
  defense: featTagPill("var(--status-info)"),
  class: featTagPill("var(--status-warning)", 22),
  racial: featTagPill("var(--status-success)"),
  combat: featTagPill("var(--status-danger)", 18),
  mobility: featTagPill("var(--status-info)", 14),
  weapon: featTagPill("var(--status-danger)", 14),
  ability: featTagPill("var(--status-warning)", 16),
  healing: featTagPill("var(--status-success)", 18),
  implement: featTagPill("var(--status-info)", 16),
  armor: featTagPill("var(--status-warning)", 18),
  power: featTagPill("var(--status-danger)", 20),
  skill: featTagPill("var(--status-success)", 14),
  tagged: {
    background: "color-mix(in srgb, var(--text-muted) 14%, var(--surface-2))",
    color: "var(--text-secondary)"
  }
};

const FEAT_TAG_PREREQ_PILL: FeatTagPillStyle = {
  background: "color-mix(in srgb, var(--text-muted) 12%, var(--surface-1))",
  color: "var(--text-muted)"
};

const FEAT_TAG_DEFAULT_PILL: FeatTagPillStyle = {
  background: "var(--surface-2)",
  color: "var(--text-secondary)"
};

/** Tags shown in feat list rows (excludes tier:* compendium markers). */
export function getFeatDisplayTags(feat: Feat): string[] {
  return (feat.tags || []).filter((t) => !String(t).toLowerCase().startsWith("tier:"));
}

export function getFeatTagPillStyle(tag: string): FeatTagPillStyle {
  const key = tag.trim().toLowerCase();
  if (key.includes("prereq")) return FEAT_TAG_PREREQ_PILL;
  return FEAT_TAG_PILL_STYLES[key] ?? FEAT_TAG_DEFAULT_PILL;
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

function matchesFeatNameFilter(feat: Feat, queryLower: string): boolean {
  if (feat.name.toLowerCase().includes(queryLower)) return true;
  if (feat.slug.toLowerCase().includes(queryLower)) return true;
  return false;
}

export function matchesFeatSearch(feat: Feat, queryLower: string, filterAllText = false): boolean {
  if (!queryLower) return true;
  if (filterAllText) return featSearchHaystack(feat).includes(queryLower);
  return matchesFeatNameFilter(feat, queryLower);
}

export function matchesFeatSourceFilter(feat: Feat, filter: FeatSourceFilter): boolean {
  if (filter.mode === "all" || filter.sources.length === 0) return true;
  const featSource = lower(feat.source);
  const selected = new Set(filter.sources.map((s) => lower(s)));
  const inSet = selected.has(featSource);
  return filter.mode === "include" ? inSet : !inSet;
}

export function matchesFeatTierFilter(feat: Feat, tiers: FeatTier[]): boolean {
  if (tiers.length === 0) return true;
  const t = normalizedFeatTier(feat);
  return tiers.includes(t as FeatTier);
}

export function matchesFeatCategoryFilter(feat: Feat, categories: string[]): boolean {
  if (categories.length === 0) return true;
  const cat = lower(getFeatFacetCategory(feat));
  const selected = new Set(categories.map((c) => lower(c)));
  return selected.has(cat);
}

/** Filter feat options (any mix of legal/illegal) by text filter (trimmed, case-insensitive). */
export function filterFeatOptionsByQuery(
  options: ResolvedOption<Feat>[],
  query: string,
  filterAllText = false
): ResolvedOption<Feat>[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => matchesFeatSearch(o.item, q, filterAllText));
}

/** @deprecated Use filterFeatOptionsByQuery */
export const filterLegalFeatOptions = filterFeatOptionsByQuery;

export function filterFeatOptions(options: ResolvedOption<Feat>[], filters: FeatFilterState): ResolvedOption<Feat>[] {
  const q = filters.query.trim().toLowerCase();
  const sourceFilter = filters.source;
  const filterAllText = filters.filterAllText ?? false;

  return options.filter((o) => {
    const feat = o.item;
    if (q && !matchesFeatSearch(feat, q, filterAllText)) return false;
    if (!matchesFeatTierFilter(feat, filters.tiers)) return false;
    if (!matchesFeatCategoryFilter(feat, filters.categories)) return false;
    if (!matchesFeatSourceFilter(feat, sourceFilter)) return false;
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

/**
 * Keep every selected feat visible when filtered out of facet controls (tier/category/source).
 * Skip when a text query is active — selected feats belong in the Selected Feats panel only.
 */
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

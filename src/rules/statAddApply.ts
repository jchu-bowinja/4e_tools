import type { StatAddEntry } from "./models";

export interface RacialTraitStatAddContext {
  traitId: string;
  traitSlug: string;
  traitName: string;
}

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Tier gates in compendium `requires` (paragon / epic). */
export function appliesTierRequires(requires: string | undefined, level: number): boolean {
  if (!requires?.trim()) return true;
  const r = requires.toLowerCase();
  if (r.includes("paragon")) return level >= 11;
  if (r.includes("epic")) return level >= 21;
  return true;
}

/**
 * Genasi-style `requires="watersoul|firesoul|…"` — true when this trait's slug/name matches a token.
 * Other non-tier requires strings still pass (legacy behavior).
 */
export function appliesTraitRequires(requires: string | undefined, ctx: RacialTraitStatAddContext): boolean {
  if (!requires?.trim()) return true;
  const r = requires.trim();
  if (!r.includes("|")) return true;
  const tokens = r.split("|").map((t) => normalizeToken(t)).filter(Boolean);
  const slug = normalizeToken(ctx.traitSlug);
  const name = normalizeToken(ctx.traitName);
  return tokens.some((t) => t === slug || t === name || slug.includes(t) || name.includes(t));
}

/** `while manifesting firesoul` on the Firesoul trait counts when that trait is active. */
export function manifestationConditionApplies(
  condition: string | undefined,
  ctx: RacialTraitStatAddContext
): boolean {
  if (!condition?.trim()) return true;
  const c = condition.trim().toLowerCase();
  if (!c.includes("manifesting")) return false;
  const target = normalizeToken(c.replace(/.*manifesting\s+/, ""));
  if (!target) return false;
  const slug = normalizeToken(ctx.traitSlug);
  const name = normalizeToken(ctx.traitName);
  return slug.includes(target) || name.includes(target) || target.includes(slug);
}

/** Whether a statadd row on an active racial trait contributes to always-on sheet math. */
export function racialTraitStatAddRowApplies(
  entry: StatAddEntry,
  level: number,
  ctx: RacialTraitStatAddContext
): boolean {
  if (entry.wearing) return false;
  if (!appliesTierRequires(entry.requires, level)) return false;
  if (!appliesTraitRequires(entry.requires, ctx)) return false;
  if (entry.condition) return manifestationConditionApplies(entry.condition, ctx);
  return true;
}

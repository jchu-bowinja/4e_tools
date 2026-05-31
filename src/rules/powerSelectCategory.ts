import type { RulesIndex } from "./models";
import { getDilettanteCandidatePowers } from "./classPowersQuery";

export type PowerSelectCategoryKind =
  | "staticPowerIds"
  | "classAtWillBonus"
  | "dilettanteAtWill"
  | "unknown";

export type ParsedPowerSelectCategory = {
  kind: PowerSelectCategoryKind;
  /** Set when kind is `staticPowerIds`. */
  powerIds?: string[];
  raw: string;
};

const DYNAMIC_PREFIX = "$$";

/** Parse compendium Power select `Category` (e.g. `$$CLASS,at-will,1`, `$$NOT_CLASS,at-will,1`). */
export function parsePowerSelectCategory(category: string): ParsedPowerSelectCategory {
  const raw = category.trim();
  const lower = raw.toLowerCase();
  if (!lower.startsWith(DYNAMIC_PREFIX)) {
    const powerIds = raw
      .split("|")
      .map((p) => p.trim())
      .filter((id) => id.startsWith("ID_") && id.includes("_POWER_"));
    return {
      kind: powerIds.length ? "staticPowerIds" : "unknown",
      powerIds,
      raw
    };
  }
  const parts = lower.slice(2).split(",").map((p) => p.trim());
  const head = parts[0] ?? "";
  const usage = parts[1] ?? "";
  const level = parts[2] ?? "";
  if (head === "class" && usage === "at-will" && level === "1") {
    return { kind: "classAtWillBonus", raw };
  }
  if (head === "not_class" && usage === "at-will" && level === "1") {
    return { kind: "dilettanteAtWill", raw };
  }
  return { kind: "unknown", raw };
}

export function isDynamicPowerSelectCategory(category: string): boolean {
  return category.trim().toLowerCase().startsWith(DYNAMIC_PREFIX);
}

export function categoryGrantsBonusClassAtWill(category: string): boolean {
  return parsePowerSelectCategory(category).kind === "classAtWillBonus";
}

export function categoryIsDilettanteAtWill(category: string): boolean {
  return parsePowerSelectCategory(category).kind === "dilettanteAtWill";
}

export type PowerSelectResolveContext = {
  classId?: string;
  hybridClassIdA?: string;
  hybridClassIdB?: string;
};

/**
 * Resolve a Power select category to compendium power ids, or `"dynamic"` when class context is required.
 */
export function resolvePowerIdsFromCategory(
  category: string,
  index: RulesIndex,
  ctx: PowerSelectResolveContext
): string[] | "dynamic" {
  const parsed = parsePowerSelectCategory(category);
  if (parsed.kind === "staticPowerIds") {
    return parsed.powerIds ?? [];
  }
  if (parsed.kind === "dilettanteAtWill") {
    if (!ctx.classId) return "dynamic";
    const also = ctx.hybridClassIdB;
    return getDilettanteCandidatePowers(index, ctx.classId, also).map((p) => p.id);
  }
  if (parsed.kind === "classAtWillBonus") {
    return [];
  }
  return [];
}

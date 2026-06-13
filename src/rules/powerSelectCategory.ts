import type { RulesIndex } from "./models";
import {
  type ClassPowerPoolUsage,
  getClassPowerIdsForUsagePool,
  getDilettanteCandidatePowers
} from "./classPowersQuery";

export type PowerSelectCategoryKind =
  | "staticPowerIds"
  | "classAtWillBonus"
  | "dilettanteAtWill"
  | "classPowerPool"
  | "explicitClassPowerPool"
  | "levelScopedClassPowerPool"
  | "unknown";

export type ParsedPowerSelectCategory = {
  kind: PowerSelectCategoryKind;
  /** Set when kind is `staticPowerIds`. */
  powerIds?: string[];
  /** Set when kind is `classPowerPool` or `levelScopedClassPowerPool`. */
  poolUsage?: ClassPowerPoolUsage;
  /** Set when kind is `classPowerPool` or `explicitClassPowerPool`. */
  poolLevel?: number;
  /** Set when kind is `explicitClassPowerPool` or `levelScopedClassPowerPool`. */
  poolClassId?: string;
  raw: string;
};

const DYNAMIC_PREFIX = "$$";

/** Parse compendium Power select `Category` (e.g. `$$CLASS,at-will,1`, `$$NOT_CLASS,at-will,1`). */
export function parsePowerSelectCategory(category: string): ParsedPowerSelectCategory {
  const raw = category.trim();
  const lower = raw.toLowerCase();
  if (!lower.startsWith(DYNAMIC_PREFIX)) {
    const explicit = parseExplicitClassPowerPoolCategory(raw);
    if (explicit) {
      return { kind: "explicitClassPowerPool", ...explicit, raw };
    }
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
  const rawParts = raw.slice(2).split(",").map((p) => p.trim());
  const parts = rawParts.map((p) => p.toLowerCase());
  const head = parts[0] ?? "";
  const usageToken = parts[1] ?? "";
  const levelText = parts[2] ?? "";
  if (head === "level" && parts.length >= 3) {
    const poolClassId = rawParts[1]?.trim();
    const poolUsage = parseClassPowerPoolUsage(parts[2] ?? "");
    if (poolClassId?.startsWith("ID_FMP_CLASS_") && poolUsage) {
      return { kind: "levelScopedClassPowerPool", poolClassId, poolUsage, raw };
    }
  }
  if (head === "class" && usageToken === "at-will" && levelText === "1") {
    return { kind: "classAtWillBonus", raw };
  }
  if (head === "not_class" && usageToken === "at-will" && levelText === "1") {
    return { kind: "dilettanteAtWill", raw };
  }
  if (head === "class" && levelText) {
    const poolUsage = parseClassPowerPoolUsage(usageToken);
    const poolLevel = Number.parseInt(levelText, 10);
    if (poolUsage && Number.isFinite(poolLevel) && poolLevel >= 1) {
      return { kind: "classPowerPool", poolUsage, poolLevel, raw };
    }
  }
  if (head === "class" && !levelText) {
    const poolUsage = parseClassPowerPoolUsage(usageToken);
    if (poolUsage) {
      return { kind: "classPowerPool", poolUsage, poolLevel: 1, raw };
    }
  }
  return { kind: "unknown", raw };
}

function parseExplicitClassPowerPoolCategory(
  category: string
): { poolClassId: string; poolUsage: ClassPowerPoolUsage; poolLevel: number } | undefined {
  const parts = category.split(",").map((p) => p.trim());
  if (parts.length < 3) return undefined;
  const classId = parts[0] ?? "";
  if (!classId.startsWith("ID_FMP_CLASS_") || classId.includes("_CLASS_FEATURE_")) {
    return undefined;
  }
  const poolUsage = parseClassPowerPoolUsage(parts[1] ?? "");
  const poolLevel = Number.parseInt(parts[2] ?? "", 10);
  if (!poolUsage || !Number.isFinite(poolLevel) || poolLevel < 1) return undefined;
  return { poolClassId: classId, poolUsage, poolLevel };
}

function parseClassPowerPoolUsage(token: string): ClassPowerPoolUsage | undefined {
  const lower = token.toLowerCase();
  if (lower === "encounter" || lower === "daily" || lower === "utility") {
    return lower;
  }
  if (lower === "at-will" || lower === "at_will" || lower === "atwill") {
    return "at-will";
  }
  const upper = token.toUpperCase();
  if (upper.includes("ENCOUNTER")) return "encounter";
  if (upper.includes("DAILY")) return "daily";
  if (upper.includes("UTILITY")) return "utility";
  if (upper.includes("AT_WILL") || upper.includes("AT-WILL")) return "at-will";
  return undefined;
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
  /** Character level for `$$LEVEL,<class>,<usage>` pools (e.g. Tome of Readiness). */
  characterLevel?: number;
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
  if (parsed.kind === "classPowerPool") {
    if (!ctx.classId || parsed.poolUsage == null || parsed.poolLevel == null) {
      return "dynamic";
    }
    return getClassPowerIdsForUsagePool(index, ctx.classId, parsed.poolUsage, parsed.poolLevel);
  }
  if (parsed.kind === "explicitClassPowerPool") {
    if (!parsed.poolClassId || parsed.poolUsage == null || parsed.poolLevel == null) {
      return "dynamic";
    }
    return getClassPowerIdsForUsagePool(
      index,
      parsed.poolClassId,
      parsed.poolUsage,
      parsed.poolLevel
    );
  }
  if (parsed.kind === "levelScopedClassPowerPool") {
    const level = ctx.characterLevel ?? 0;
    if (!parsed.poolClassId || parsed.poolUsage == null || level < 1) {
      return "dynamic";
    }
    return getClassPowerIdsForUsagePool(index, parsed.poolClassId, parsed.poolUsage, level);
  }
  return [];
}

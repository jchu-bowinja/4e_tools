import type { Power, RulesIndex } from "./models";
import { collapseAugmentablePowersForPicker } from "./psionicPowerAugments";

export function powerTypeCategory(p: Power): "attack" | "utility" | "other" {
  const pt = String((p.raw?.specific as Record<string, unknown> | undefined)?.["Power Type"] || "").toLowerCase();
  if (pt.includes("attack")) return "attack";
  if (pt.includes("utility")) return "utility";
  return "other";
}

/** Class attack or utility powers whose printed level is at most `maxLevel`. */
export function getClassPowersForLevelRange(
  index: RulesIndex,
  classId: string | undefined,
  maxLevel: number,
  kind: "attack" | "utility"
): Power[] {
  if (!classId || maxLevel < 1) {
    return [];
  }
  const list = index.powers.filter((p) => {
    if (p.classId !== classId) return false;
    const level = p.level ?? 0;
    if (level < 1 || level > maxLevel) return false;
    return powerTypeCategory(p) === kind;
  });
  const sorted = [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return collapseAugmentablePowersForPicker(sorted);
}

/**
 * Attack or utility powers tied to a non-class owner id (same `classId` field on Power), e.g. paragon path
 * (`ID_FMP_PARAGON_PATH_*`) or epic destiny (`ID_FMP_EPIC_DESTINY_*`).
 */
function isClassLikePowerOwner(classId: string | null | undefined): boolean {
  const s = String(classId || "");
  return s.startsWith("ID_FMP_CLASS_") || s.startsWith("ID_FMP_HYBRID_CLASS_");
}

/**
 * Half-elf Dilettante: 1st-level at-will **attack** powers from compendium classes other than `myClassId`.
 * Powers must have `classId` on a PHB-style class or hybrid class entry.
 */
export function getDilettanteCandidatePowers(
  index: RulesIndex,
  myClassId: string | undefined,
  /** Hybrid: also exclude your second base class's powers from "another class" picks. */
  alsoMyClassId?: string
): Power[] {
  if (!myClassId) return [];
  const className = (id: string | null | undefined) =>
    String(index.classes.find((c) => c.id === id)?.name || id || "").trim();
  const list = index.powers.filter((p) => {
    if (!isClassLikePowerOwner(p.classId)) return false;
    if (p.classId === myClassId || (alsoMyClassId && p.classId === alsoMyClassId)) return false;
    if ((p.level ?? 0) !== 1) return false;
    if (powerTypeCategory(p) !== "attack") return false;
    const u = String(p.usage || "").toLowerCase();
    if (!u.includes("at-will")) return false;
    return true;
  });
  const sorted = [...list].sort((a, b) => {
    const ca = className(a.classId);
    const cb = className(b.classId);
    if (ca !== cb) return ca.localeCompare(cb, undefined, { sensitivity: "base" });
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return collapseAugmentablePowersForPicker(sorted);
}

export type ClassPowerPoolUsage = "encounter" | "daily" | "at-will" | "utility";

function parentClassIdForPowerPool(index: RulesIndex, classId: string): string | undefined {
  const cls = index.classes.find((c) => c.id === classId);
  const parent = (cls?.raw?.specific as Record<string, unknown> | undefined)?.["_ParentClass"];
  return typeof parent === "string" && parent.startsWith("ID_FMP_") ? parent : undefined;
}

function powerMatchesUsagePool(p: Power, usage: ClassPowerPoolUsage, level: number): boolean {
  const lv = p.level ?? 0;
  if (lv !== level) return false;
  const u = String(p.usage || "").toLowerCase();
  const pt = powerTypeCategory(p);
  if (usage === "utility") return pt === "utility";
  if (usage === "at-will") return u.includes("at-will") && pt === "attack";
  if (usage === "encounter") return u.includes("encounter") && pt === "attack";
  if (usage === "daily") return u.includes("daily") && pt === "attack";
  return false;
}

/** Class (and parent class) powers for `$$CLASS,<usage>,<level>` / internal category pools. */
export function getClassPowerIdsForUsagePool(
  index: RulesIndex,
  classId: string | undefined,
  usage: ClassPowerPoolUsage,
  level: number
): string[] {
  if (!classId || level < 1) return [];
  const ownerIds = [classId, parentClassIdForPowerPool(index, classId)].filter(
    (id, i, arr): id is string => !!id && arr.indexOf(id) === i
  );
  const list = index.powers.filter((p) => {
    const owner = (p.classId || "").trim();
    if (!ownerIds.includes(owner)) return false;
    return powerMatchesUsagePool(p, usage, level);
  });
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return collapseAugmentablePowersForPicker(sorted).map((p) => p.id);
}

export function getPowersForOwnerId(
  index: RulesIndex,
  ownerId: string | undefined,
  maxLevel: number,
  kind: "attack" | "utility"
): Power[] {
  if (!ownerId || maxLevel < 1) {
    return [];
  }
  const list = index.powers.filter((p) => {
    if (p.classId !== ownerId) return false;
    const lv = p.level ?? 0;
    if (lv < 1 || lv > maxLevel) return false;
    return powerTypeCategory(p) === kind;
  });
  const sorted = [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return collapseAugmentablePowersForPicker(sorted);
}

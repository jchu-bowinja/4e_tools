import type { Power, RulesIndex } from "./models";

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
  return [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
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
  return [...list].sort((a, b) => {
    const ca = className(a.classId);
    const cb = className(b.classId);
    if (ca !== cb) return ca.localeCompare(cb, undefined, { sensitivity: "base" });
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
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
  return [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

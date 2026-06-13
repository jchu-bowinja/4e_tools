import type { Power, RulesIndex, Theme } from "./models";
import { collectPowerIdsFromClassFeature, grantedPowerIdsFromClassFeatureGrants } from "./grantedPowersQuery";
import { collapseAugmentablePowersForPicker } from "./psionicPowerAugments";
import { featureIsAvailableAtLevel, parseTraitIdsFromField, specOf } from "./supportTraits";

export const MAX_CHARACTER_LEVEL = 30;

export type GatedPower = {
  power: Power;
  availableAtLevel: boolean;
  requiredLevel: number;
};

function gatePower(index: RulesIndex, power: Power, characterLevel: number): GatedPower {
  const requiredLevel = effectivePowerLevel(index, power);
  const level = requiredLevel >= 1 ? requiredLevel : 1;
  return {
    power,
    requiredLevel: level,
    availableAtLevel: requiredLevel < 1 || requiredLevel <= characterLevel
  };
}

function sortGatedPowers(index: RulesIndex, list: GatedPower[]): GatedPower[] {
  return [...list].sort((a, b) => {
    const la = effectivePowerLevel(index, a.power);
    const lb = effectivePowerLevel(index, b.power);
    if (la !== lb) return la - lb;
    return a.power.name.localeCompare(b.power.name, undefined, { sensitivity: "base" });
  });
}

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

function parsePositiveLevel(raw: unknown): number | undefined {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

/** Printed level for owner-based powers; falls back to `_ParentFeature` level when the power row omits Level. */
export function effectivePowerLevel(index: RulesIndex, power: Power): number {
  const direct = power.level;
  if (direct != null && direct >= 1) return direct;
  const parentId = String(
    (power.raw?.specific as Record<string, unknown> | undefined)?.["_ParentFeature"] ?? ""
  ).trim();
  if (!parentId.startsWith("ID_")) return 0;
  const parent = index.classFeatures?.find((f) => f.id === parentId);
  const fromParent = parsePositiveLevel((parent?.raw?.specific as Record<string, unknown> | undefined)?.Level);
  return fromParent ?? 0;
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
    const lv = effectivePowerLevel(index, p);
    if (lv < 1 || lv > maxLevel) return false;
    return powerTypeCategory(p) === kind;
  });
  const sorted = [...list].sort((a, b) => {
    const la = effectivePowerLevel(index, a);
    const lb = effectivePowerLevel(index, b);
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return collapseAugmentablePowersForPicker(sorted);
}

/** All owner powers up to level 30, marked available or not at `characterLevel`. */
export function getAllPowersForOwnerId(
  index: RulesIndex,
  ownerId: string | undefined,
  characterLevel: number,
  kind: "attack" | "utility"
): GatedPower[] {
  const powers = getPowersForOwnerId(index, ownerId, MAX_CHARACTER_LEVEL, kind);
  return sortGatedPowers(
    index,
    powers.map((power) => gatePower(index, power, characterLevel))
  );
}

/** Theme attack/utility powers plus level-gated grants from theme sub-features (`_PARSED_SUB_FEATURES`). */
export function getThemeGrantedPowers(
  index: RulesIndex,
  themeId: string | undefined,
  maxLevel: number
): Power[] {
  if (!themeId || maxLevel < 1) return [];
  const theme = index.themes?.find((t) => t.id === themeId);
  if (!theme) return [];

  const byPowerId = new Map(index.powers.map((p) => [p.id, p]));
  const byFeatureId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const seen = new Set<string>();
  const out: Power[] = [];

  const addPowerId = (pid: string) => {
    if (seen.has(pid)) return;
    const power = byPowerId.get(pid);
    if (!power) return;
    const lv = effectivePowerLevel(index, power);
    if (lv >= 1 && lv > maxLevel) return;
    seen.add(pid);
    out.push(power);
  };

  for (const cfId of parseTraitIdsFromField(specOf(theme as Theme), "_PARSED_SUB_FEATURES")) {
    const feature = byFeatureId.get(cfId);
    if (!feature || !featureIsAvailableAtLevel(feature, maxLevel)) continue;
    for (const pid of grantedPowerIdsFromClassFeatureGrants(feature, [])) {
      addPowerId(pid);
    }
    const spec = feature.raw?.specific as Record<string, unknown> | undefined;
    const powersField = String(spec?.["Powers"] ?? "").trim();
    if (powersField) {
      for (const part of powersField.split(",")) {
        const pid = part.trim();
        if (pid.startsWith("ID_FMP_POWER")) addPowerId(pid);
      }
    }
  }

  for (const kind of ["attack", "utility"] as const) {
    for (const power of getPowersForOwnerId(index, themeId, maxLevel, kind)) {
      addPowerId(power.id);
    }
  }

  return out.sort((a, b) => {
    const la = effectivePowerLevel(index, a);
    const lb = effectivePowerLevel(index, b);
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** All theme-granted powers up to level 30, marked available or not at `characterLevel`. */
export function getAllThemeGrantedPowers(
  index: RulesIndex,
  themeId: string | undefined,
  characterLevel: number
): GatedPower[] {
  if (!themeId || characterLevel < 1) return [];
  const theme = index.themes?.find((t) => t.id === themeId);
  if (!theme) return [];

  const byPowerId = new Map(index.powers.map((p) => [p.id, p]));
  const byFeatureId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const seen = new Set<string>();
  const out: GatedPower[] = [];

  const addPowerId = (pid: string) => {
    if (seen.has(pid)) return;
    const power = byPowerId.get(pid);
    if (!power) return;
    seen.add(pid);
    out.push(gatePower(index, power, characterLevel));
  };

  for (const cfId of parseTraitIdsFromField(specOf(theme as Theme), "_PARSED_SUB_FEATURES")) {
    const feature = byFeatureId.get(cfId);
    if (!feature) continue;
    for (const pid of grantedPowerIdsFromClassFeatureGrants(feature, [])) {
      addPowerId(pid);
    }
    const spec = feature.raw?.specific as Record<string, unknown> | undefined;
    const powersField = String(spec?.["Powers"] ?? "").trim();
    if (powersField) {
      for (const part of powersField.split(",")) {
        const pid = part.trim();
        if (pid.startsWith("ID_FMP_POWER")) addPowerId(pid);
      }
    }
  }

  for (const kind of ["attack", "utility"] as const) {
    for (const gated of getAllPowersForOwnerId(index, themeId, characterLevel, kind)) {
      if (seen.has(gated.power.id)) continue;
      seen.add(gated.power.id);
      out.push(gated);
    }
  }

  return sortGatedPowers(index, out);
}

function collectAllParagonPathClassFeaturePowerIds(
  index: RulesIndex,
  paragonPathId: string | undefined
): string[] {
  if (!paragonPathId) return [];
  const path = index.paragonPaths.find((p) => p.id === paragonPathId);
  if (!path) return [];
  const byId = new Map((index.classFeatures ?? []).map((cf) => [cf.id, cf]));
  const ids = new Set<string>();
  for (const cfId of parseTraitIdsFromField(specOf(path), "Class Features")) {
    const cf = byId.get(cfId);
    if (!cf) continue;
    for (const pid of collectPowerIdsFromClassFeature(cf)) {
      ids.add(pid);
    }
  }
  return [...ids];
}

/** All paragon path powers up to level 30, marked available or not at `characterLevel`. */
export function getAllParagonPathGrantedPowers(
  index: RulesIndex,
  paragonPathId: string | undefined,
  characterLevel: number
): GatedPower[] {
  if (!paragonPathId || characterLevel < 1) return [];
  const byPowerId = new Map(index.powers.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: GatedPower[] = [];

  const addPowerId = (pid: string) => {
    if (seen.has(pid)) return;
    const power = byPowerId.get(pid);
    if (!power) return;
    seen.add(pid);
    out.push(gatePower(index, power, characterLevel));
  };

  for (const kind of ["attack", "utility"] as const) {
    for (const gated of getAllPowersForOwnerId(index, paragonPathId, characterLevel, kind)) {
      addPowerId(gated.power.id);
    }
  }
  for (const pid of collectAllParagonPathClassFeaturePowerIds(index, paragonPathId)) {
    addPowerId(pid);
  }

  return sortGatedPowers(index, out);
}

/** All epic destiny powers up to level 30, marked available or not at `characterLevel`. */
export function getAllEpicDestinyGrantedPowers(
  index: RulesIndex,
  epicDestinyId: string | undefined,
  characterLevel: number
): GatedPower[] {
  if (!epicDestinyId || characterLevel < 1) return [];
  const seen = new Set<string>();
  const out: GatedPower[] = [];
  for (const kind of ["attack", "utility"] as const) {
    for (const gated of getAllPowersForOwnerId(index, epicDestinyId, characterLevel, kind)) {
      if (seen.has(gated.power.id)) continue;
      seen.add(gated.power.id);
      out.push(gated);
    }
  }
  return sortGatedPowers(index, out);
}

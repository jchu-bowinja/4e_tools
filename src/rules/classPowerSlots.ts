import type { CharacterBuild, Power, RulesIndex } from "./models";
import {
  expectedClassAtWillAttackSlots,
  expectedClassEncounterAttackSlots,
  expectedClassDailyAttackSlots,
  expectedClassUtilityPowerCount
} from "./advancement";
import { getClassPowersForLevelRange, powerTypeCategory } from "./classPowersQuery";

/** PHB-style class encounter attack slot unlock levels (1st slot at 1st, 2nd at 3rd, …). */
export const ENCOUNTER_ATTACK_SLOT_GAIN_LEVELS = [1, 3, 7, 13] as const;

/** PHB-style class daily attack slot unlock levels. */
export const DAILY_ATTACK_SLOT_GAIN_LEVELS = [1, 5, 9, 15] as const;

/** PHB-style class utility slot unlock levels. */
export const CLASS_UTILITY_SLOT_GAIN_LEVELS = [2, 6, 10, 12, 16, 22, 26] as const;

export type ClassPowerSlotBucket = "atWill" | "encounter" | "daily" | "utility";

export interface ClassPowerSlotDef {
  key: string;
  bucket: ClassPowerSlotBucket;
  /** Character level at which this slot is first available; also max printed power level for this pick. */
  gainLevel: number;
  /** Short heading for the builder UI. */
  label: string;
}

/** PHB-style: a slot gained at level L may only hold a power whose printed level is ≤ L (and ≥ 1). */
export function powerPrintedLevelEligibleForSlot(p: Power, def: ClassPowerSlotDef): boolean {
  const pl = p.level ?? 0;
  if (pl < 1) return false;
  return pl <= def.gainLevel;
}

function ordinalWord(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/** Matches attack-power grouping used by the builder and validator. */
export function attackPowerBucketFromUsage(usage: string | null | undefined): "atWill" | "encounter" | "daily" {
  if (!usage) return "encounter";
  const lower = usage.toLowerCase();
  if (lower.includes("at-will")) return "atWill";
  if (lower.includes("encounter")) return "encounter";
  if (lower.includes("daily")) return "daily";
  return "encounter";
}

export function buildClassPowerSlotDefinitions(level: number, human: boolean): ClassPowerSlotDef[] {
  const defs: ClassPowerSlotDef[] = [];
  const nAw = expectedClassAtWillAttackSlots(level, human);
  for (let i = 0; i < nAw; i++) {
    defs.push({
      key: `atWill:${i}`,
      bucket: "atWill",
      gainLevel: 1,
      label:
        human && i === 2
          ? "1st-level at-will (human bonus)"
          : nAw > 1
            ? `${ordinalWord(1)}-level at-will (${i + 1} of ${nAw})`
            : `${ordinalWord(1)}-level at-will`
    });
  }

  const nEnc = expectedClassEncounterAttackSlots(level);
  for (let i = 0; i < nEnc; i++) {
    const gain = ENCOUNTER_ATTACK_SLOT_GAIN_LEVELS[i];
    defs.push({
      key: `encounter:${gain}`,
      bucket: "encounter",
      gainLevel: gain,
      label: `${ordinalWord(gain)}-level encounter attack`
    });
  }

  const nDaily = expectedClassDailyAttackSlots(level);
  for (let i = 0; i < nDaily; i++) {
    const gain = DAILY_ATTACK_SLOT_GAIN_LEVELS[i];
    defs.push({
      key: `daily:${gain}`,
      bucket: "daily",
      gainLevel: gain,
      label: `${ordinalWord(gain)}-level daily attack`
    });
  }

  const nUtil = expectedClassUtilityPowerCount(level);
  for (let i = 0; i < nUtil; i++) {
    const gain = CLASS_UTILITY_SLOT_GAIN_LEVELS[i];
    defs.push({
      key: `utility:${gain}`,
      bucket: "utility",
      gainLevel: gain,
      label: `${ordinalWord(gain)}-level utility`
    });
  }

  return defs;
}

export function orderedPowerIdsFromSlots(
  defs: ClassPowerSlotDef[],
  slots: Record<string, string> | undefined
): string[] {
  if (!slots) return [];
  const out: string[] = [];
  for (const d of defs) {
    const id = (slots[d.key] || "").trim();
    if (id) out.push(id);
  }
  return out;
}

/** Drop slot keys not valid for this level/human and values not legal for this class/level. */
export function reconcileClassPowerSlotsForBuild(
  build: CharacterBuild,
  level: number,
  human: boolean,
  index: RulesIndex
): { classPowerSlots?: Record<string, string>; powerIds: string[] } {
  const defs = buildClassPowerSlotDefinitions(level, human);
  const validKeys = new Set(defs.map((d) => d.key));
  const attacks = getClassPowersForLevelRange(index, build.classId, level, "attack");
  const utils = getClassPowersForLevelRange(index, build.classId, level, "utility");
  const allowed = new Set([...attacks, ...utils].map((p) => p.id));

  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const next: Record<string, string> = { ...(build.classPowerSlots || {}) };
  for (const k of Object.keys(next)) {
    if (!validKeys.has(k)) delete next[k];
  }
  for (const k of Object.keys(next)) {
    const v = next[k]?.trim();
    if (!v || !allowed.has(v)) {
      delete next[k];
      continue;
    }
    const def = defByKey.get(k);
    const p = index.powers.find((x) => x.id === v);
    if (def && p && !powerPrintedLevelEligibleForSlot(p, def)) delete next[k];
    else next[k] = v;
  }

  const cleaned = Object.keys(next).length > 0 ? next : undefined;
  return {
    classPowerSlots: cleaned,
    powerIds: orderedPowerIdsFromSlots(defs, cleaned)
  };
}

/** Best-effort: assign existing powerIds into slots by usage (for older saves without classPowerSlots). */
export function inferClassPowerSlotsFromPowerIds(
  defs: ClassPowerSlotDef[],
  selectedIds: string[],
  index: RulesIndex,
  classId: string | undefined,
  maxLevel: number
): Record<string, string> | undefined {
  if (!classId || maxLevel < 1 || selectedIds.length === 0) return undefined;
  const attacks = getClassPowersForLevelRange(index, classId, maxLevel, "attack");
  const utils = getClassPowersForLevelRange(index, classId, maxLevel, "utility");
  const byId = new Map<string, Power>([...attacks, ...utils].map((p) => [p.id, p]));
  const unused = new Set(selectedIds.filter((id) => byId.has(id)));
  if (unused.size === 0) return undefined;

  const out: Record<string, string> = {};
  for (const def of defs) {
    const pick = [...unused].find((id) => {
      const p = byId.get(id);
      if (!p || !powerPrintedLevelEligibleForSlot(p, def)) return false;
      if (def.bucket === "utility") return powerTypeCategory(p) === "utility";
      return powerTypeCategory(p) === "attack" && attackPowerBucketFromUsage(p.usage) === def.bucket;
    });
    if (pick) {
      out[def.key] = pick;
      unused.delete(pick);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function slotBucketSectionTitle(bucket: ClassPowerSlotBucket): string {
  switch (bucket) {
    case "atWill":
      return "At-will attack powers";
    case "encounter":
      return "Encounter attack powers";
    case "daily":
      return "Daily attack powers";
    case "utility":
      return "Utility powers";
    default:
      return "Powers";
  }
}

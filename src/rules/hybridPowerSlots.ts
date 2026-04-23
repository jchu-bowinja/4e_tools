import type { CharacterBuild, Power, RulesIndex } from "./models";
import {
  expectedClassAtWillAttackSlots,
  expectedClassDailyAttackSlots,
  expectedClassEncounterAttackSlots,
  expectedClassUtilityPowerCount
} from "./advancement";
import {
  attackPowerBucketFromUsage,
  buildClassPowerSlotDefinitions,
  ClassPowerSlotDef,
  ENCOUNTER_ATTACK_SLOT_GAIN_LEVELS,
  DAILY_ATTACK_SLOT_GAIN_LEVELS,
  CLASS_UTILITY_SLOT_GAIN_LEVELS,
  orderedPowerIdsFromSlots,
  powerPrintedLevelEligibleForSlot
} from "./classPowerSlots";
import { getClassPowersForLevelRange, powerTypeCategory } from "./classPowersQuery";

function ordinalWord(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Hybrid uses the same total slot counts as the PHB single-class schedule; at-will slots 0..1 are locked to each base class pool, further at-wills are flexible.
 */
export function buildHybridPowerSlotDefinitions(level: number, bonusThirdClassAtWill: boolean): ClassPowerSlotDef[] {
  const defs: ClassPowerSlotDef[] = [];
  const nAw = expectedClassAtWillAttackSlots(level, bonusThirdClassAtWill);
  for (let i = 0; i < nAw; i++) {
    let key: string;
    let label: string;
    if (i === 0) {
      key = "hybrid:awA:0";
      label = "At-will attack (first hybrid class)";
    } else if (i === 1) {
      key = "hybrid:awB:0";
      label = "At-will attack (second hybrid class)";
    } else {
      key = `hybrid:awFlex:${i - 2}`;
      label =
        bonusThirdClassAtWill && i === 2
          ? "At-will attack (racial bonus — either hybrid pool)"
          : `At-will attack (${ordinalWord(1)}-level, either hybrid pool)`;
    }
    defs.push({
      key,
      bucket: "atWill",
      gainLevel: 1,
      label
    });
  }

  const nEnc = expectedClassEncounterAttackSlots(level);
  for (let i = 0; i < nEnc; i++) {
    const gain = ENCOUNTER_ATTACK_SLOT_GAIN_LEVELS[i];
    defs.push({
      key: `hybrid:encounter:${gain}`,
      bucket: "encounter",
      gainLevel: gain,
      label: `${ordinalWord(gain)}-level encounter attack (either hybrid pool)`
    });
  }

  const nDaily = expectedClassDailyAttackSlots(level);
  for (let i = 0; i < nDaily; i++) {
    const gain = DAILY_ATTACK_SLOT_GAIN_LEVELS[i];
    defs.push({
      key: `hybrid:daily:${gain}`,
      bucket: "daily",
      gainLevel: gain,
      label: `${ordinalWord(gain)}-level daily attack (either hybrid pool)`
    });
  }

  const nUtil = expectedClassUtilityPowerCount(level);
  for (let i = 0; i < nUtil; i++) {
    const gain = CLASS_UTILITY_SLOT_GAIN_LEVELS[i];
    defs.push({
      key: `hybrid:utility:${gain}`,
      bucket: "utility",
      gainLevel: gain,
      label: `${ordinalWord(gain)}-level utility (either hybrid pool)`
    });
  }

  return defs;
}

export function hybridPowerPoolUnion(
  index: RulesIndex,
  baseClassIdA: string | undefined,
  baseClassIdB: string | undefined,
  maxLevel: number,
  kind: "attack" | "utility"
): Power[] {
  const a = baseClassIdA ? getClassPowersForLevelRange(index, baseClassIdA, maxLevel, kind) : [];
  const b = baseClassIdB ? getClassPowersForLevelRange(index, baseClassIdB, maxLevel, kind) : [];
  const byId = new Map<string, Power>();
  for (const p of [...a, ...b]) byId.set(p.id, p);
  return [...byId.values()].sort((x, y) => {
    const lx = x.level ?? 0;
    const ly = y.level ?? 0;
    if (lx !== ly) return lx - ly;
    return x.name.localeCompare(y.name, undefined, { sensitivity: "base" });
  });
}

export function powerAllowedForHybridSlot(
  slotKey: string,
  power: Power,
  baseClassIdA: string | undefined,
  baseClassIdB: string | undefined
): boolean {
  const cid = String(power.classId || "");
  if (slotKey === "hybrid:awA:0") return !!baseClassIdA && cid === baseClassIdA;
  if (slotKey === "hybrid:awB:0") return !!baseClassIdB && cid === baseClassIdB;
  if (slotKey.startsWith("hybrid:awFlex")) return cid === baseClassIdA || cid === baseClassIdB;
  return cid === baseClassIdA || cid === baseClassIdB;
}

export function reconcileHybridClassPowerSlotsForBuild(
  build: CharacterBuild,
  level: number,
  bonusThirdClassAtWill: boolean,
  index: RulesIndex,
  baseClassIdA: string | undefined,
  baseClassIdB: string | undefined
): { classPowerSlots?: Record<string, string>; powerIds: string[] } {
  const defs = buildHybridPowerSlotDefinitions(level, bonusThirdClassAtWill);
  const validKeys = new Set(defs.map((d) => d.key));
  const attacks = hybridPowerPoolUnion(index, baseClassIdA, baseClassIdB, level, "attack");
  const utils = hybridPowerPoolUnion(index, baseClassIdA, baseClassIdB, level, "utility");
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
    if (!def || !p) continue;
    if (!powerAllowedForHybridSlot(k, p, baseClassIdA, baseClassIdB)) {
      delete next[k];
      continue;
    }
    if (!powerPrintedLevelEligibleForSlot(p, def)) delete next[k];
    else next[k] = v;
  }

  const cleaned = Object.keys(next).length > 0 ? next : undefined;
  return {
    classPowerSlots: cleaned,
    powerIds: orderedPowerIdsFromSlots(defs, cleaned)
  };
}

/**
 * Best-effort backfill of class power slot keys from a flat `powerIds` list (e.g. after import or older saves).
 * Respects hybrid at-will A/B pool restrictions and flex rules.
 */
export function inferHybridClassPowerSlotsFromPowerIds(
  defs: ClassPowerSlotDef[],
  selectedIds: string[],
  index: RulesIndex,
  baseClassIdA: string | undefined,
  baseClassIdB: string | undefined,
  maxLevel: number
): Record<string, string> | undefined {
  if (!baseClassIdA || !baseClassIdB || maxLevel < 1 || selectedIds.length === 0) return undefined;
  const attacks = hybridPowerPoolUnion(index, baseClassIdA, baseClassIdB, maxLevel, "attack");
  const utils = hybridPowerPoolUnion(index, baseClassIdA, baseClassIdB, maxLevel, "utility");
  const byId = new Map<string, Power>([...attacks, ...utils].map((p) => [p.id, p]));
  const unused = new Set(selectedIds.filter((id) => byId.has(id)));
  if (unused.size === 0) return undefined;

  const out: Record<string, string> = {};
  for (const def of defs) {
    const pick = [...unused].find((id) => {
      const p = byId.get(id);
      if (!p || !powerPrintedLevelEligibleForSlot(p, def)) return false;
      if (!powerAllowedForHybridSlot(def.key, p, baseClassIdA, baseClassIdB)) return false;
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

/** When not hybrid, delegates to standard slot builder (for shared code paths). */
export function effectivePowerSlotDefinitions(
  build: CharacterBuild,
  level: number,
  bonusThirdClassAtWill: boolean
): ClassPowerSlotDef[] {
  if (build.characterStyle === "hybrid") {
    return buildHybridPowerSlotDefinitions(level, bonusThirdClassAtWill);
  }
  return buildClassPowerSlotDefinitions(level, bonusThirdClassAtWill);
}

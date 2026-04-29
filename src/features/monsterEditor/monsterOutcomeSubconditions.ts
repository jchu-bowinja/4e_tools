import type { MonsterPower, MonsterPowerAttack, MonsterPowerOutcome, MonsterPowerOutcomeEntry } from "./storage";

/**
 * Split 4e outcome prose (hit/miss/effect, nested attack lines) into structured subconditions.
 * Keep marker list aligned with tools/etl/outcome_subconditions.py.
 */
const MARKER_SPLIT_RE =
  /\s*\b(First Failed Saving Throw|Second Failed Saving Throw|Third Failed Saving Throw|Each Failed Saving Throw|Failed Saving Throw|Aftereffect|Additional Effect|Sustain Standard|Sustain Minor|Sustain Move|Sustain Free)\s*:\s*/gi;

export type SubconditionBuckets = {
  aftereffects: MonsterPowerOutcomeEntry[];
  sustains: MonsterPowerOutcomeEntry[];
  failedSavingThrows: MonsterPowerOutcomeEntry[];
};

function emptyBuckets(): SubconditionBuckets {
  return { aftereffects: [], sustains: [], failedSavingThrows: [] };
}

function pushEntry(buckets: SubconditionBuckets, labelRaw: string, body: string): void {
  const labelNorm = labelRaw.trim().toLowerCase();
  const entry: MonsterPowerOutcomeEntry = {
    kind: "MonsterAttackEntry",
    name: labelRaw.trim(),
    description: body.trim()
  };
  if (labelNorm.includes("failed saving throw")) {
    buckets.failedSavingThrows.push(entry);
  } else if (labelNorm.startsWith("aftereffect") || labelNorm.startsWith("additional effect")) {
    buckets.aftereffects.push(entry);
  } else if (labelNorm.startsWith("sustain")) {
    buckets.sustains.push(entry);
  }
}

export function splitSubconditionsFromDescription(description: string): { primary: string; buckets: SubconditionBuckets } {
  const text = String(description ?? "").trim();
  if (!text) return { primary: "", buckets: emptyBuckets() };

  const parts = text.split(MARKER_SPLIT_RE);
  if (parts.length < 3) return { primary: text, buckets: emptyBuckets() };

  const buckets = emptyBuckets();
  const primary = (parts[0] ?? "").trim();

  let i = 1;
  while (i + 1 < parts.length) {
    const labelRaw = (parts[i] ?? "").trim();
    const body = (parts[i + 1] ?? "").trim();
    if (labelRaw) pushEntry(buckets, labelRaw, body);
    i += 2;
  }

  const hasAny = buckets.aftereffects.length + buckets.sustains.length + buckets.failedSavingThrows.length > 0;
  if (!hasAny) return { primary: text, buckets: emptyBuckets() };
  return { primary, buckets };
}

function hasStructuredSubconditions(outcome: MonsterPowerOutcome): boolean {
  return Boolean(
    (outcome.aftereffects?.length ?? 0) > 0 ||
      (outcome.sustains?.length ?? 0) > 0 ||
      (outcome.failedSavingThrows?.length ?? 0) > 0
  );
}

function enrichOutcomeSubconditionsInPlace(outcome: MonsterPowerOutcome): void {
  const desc = String(outcome.description ?? "").trim();
  if (desc && !hasStructuredSubconditions(outcome)) {
    const { primary, buckets } = splitSubconditionsFromDescription(desc);
    const hasBuckets =
      buckets.aftereffects.length > 0 || buckets.sustains.length > 0 || buckets.failedSavingThrows.length > 0;
    if (hasBuckets) {
      outcome.description = primary;
      if (buckets.aftereffects.length) outcome.aftereffects = buckets.aftereffects;
      if (buckets.sustains.length) outcome.sustains = buckets.sustains;
      if (buckets.failedSavingThrows.length) outcome.failedSavingThrows = buckets.failedSavingThrows;
    }
  }

  const nad = outcome.nestedAttackDescriptions;
  if (Array.isArray(nad) && nad.length > 0) {
    const next: Array<string | MonsterPowerOutcome> = [];
    for (const item of nad) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        enrichOutcomeSubconditionsInPlace(item as MonsterPowerOutcome);
        next.push(item as MonsterPowerOutcome);
        continue;
      }
      if (typeof item !== "string") {
        next.push(item as string);
        continue;
      }
      const { primary, buckets } = splitSubconditionsFromDescription(item);
      const hasBuckets =
        buckets.aftereffects.length > 0 || buckets.sustains.length > 0 || buckets.failedSavingThrows.length > 0;
      if (hasBuckets) {
        const obj: MonsterPowerOutcome = { description: primary };
        if (buckets.aftereffects.length) obj.aftereffects = buckets.aftereffects;
        if (buckets.sustains.length) obj.sustains = buckets.sustains;
        if (buckets.failedSavingThrows.length) obj.failedSavingThrows = buckets.failedSavingThrows;
        enrichOutcomeSubconditionsInPlace(obj);
        next.push(obj);
      } else {
        next.push(item);
      }
    }
    outcome.nestedAttackDescriptions = next;
  }

  for (const key of ["aftereffects", "sustains", "failedSavingThrows"] as const) {
    const arr = outcome[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (entry && typeof entry === "object") {
        enrichOutcomeSubconditionsInPlace(entry as MonsterPowerOutcome);
      }
    }
  }
}

function isRedundantAttackStub(entry: MonsterPowerAttack): boolean {
  if (String(entry.kind ?? "") !== "MonsterAttackEntry") return false;
  const name = String(entry.name ?? "")
    .trim()
    .toLowerCase();
  const allowed = new Set([
    "each failed saving throw",
    "failed saving throw",
    "first failed saving throw",
    "second failed saving throw",
    "third failed saving throw"
  ]);
  if (!allowed.has(name)) return false;
  if (entry.range || entry.targets || (entry.attackBonuses?.length ?? 0) > 0) return false;
  if (entry.hit || entry.miss || entry.effect) return false;
  if (String(entry.description ?? "").trim()) return false;
  return true;
}

function enrichAttackOutcomesInPlace(attack: MonsterPowerAttack): void {
  for (const key of ["hit", "miss", "effect"] as const) {
    const oc = attack[key];
    if (oc && typeof oc === "object") {
      enrichOutcomeSubconditionsInPlace(oc);
    }
  }
}

/** Enrich hit/miss/effect subconditions and drop redundant stub attack rows. */
export function enrichMonsterPowerOutcomes(power: MonsterPower): MonsterPower {
  const attacks = power.attacks;
  if (!Array.isArray(attacks) || attacks.length === 0) return power;
  const filtered = attacks.filter((a) => !isRedundantAttackStub(a));
  for (const atk of filtered) {
    enrichAttackOutcomesInPlace(atk);
  }
  return { ...power, attacks: filtered };
}

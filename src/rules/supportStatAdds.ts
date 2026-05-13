import type { CharacterBuild, NadBonusesFromSpecific, RulesIndex, StatAddEntry } from "./models";

/** NAD keys as used on `CharacterBuild` / `DerivedStats` defenses (PascalCase). */
export type NadDefenseKey = "Fortitude" | "Reflex" | "Will";

export interface PassiveDefenseBonuses {
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
}

function appliesRequires(requires: string | undefined, level: number): boolean {
  if (!requires?.trim()) return true;
  const r = requires.toLowerCase();
  if (r.includes("paragon")) return level >= 11;
  if (r.includes("epic")) return level >= 21;
  return true;
}

function parseDirectPlusInt(value: string): number | null {
  const m = String(value || "")
    .trim()
    .match(/^\+(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Sums statadd rows whose `name` matches `bonusName` (e.g. Iron Will) with plain +N values and applicable `requires`. */
function resolveNamedTieredBonus(entries: StatAddEntry[], bonusName: string, level: number): number {
  let sum = 0;
  for (const e of entries) {
    if (e.name !== bonusName) continue;
    if (e.condition || e.wearing) continue;
    if (!appliesRequires(e.requires, level)) continue;
    const n = parseDirectPlusInt(e.value);
    if (n !== null) sum += n;
  }
  return sum;
}

function defenseBucketFromStatName(name: string): keyof PassiveDefenseBonuses | null {
  const n = name.trim().toLowerCase();
  if (n === "ac" || n === "armor class") return "ac";
  if (n === "fortitude" || n === "fortitude defense") return "fortitude";
  if (n === "reflex" || n === "reflex defense") return "reflex";
  if (n === "will" || n === "will defense") return "will";
  return null;
}

/**
 * Unconditional defense (and unconditional numeric AC) from ETL `statAdds`.
 * Skips entries with `condition` or `wearing` (situational CB bonuses).
 * Resolves "+FeatName" style references to other rows on the same entity (e.g. Iron Will → Will Defense).
 */
export function passiveDefenseBonusesFromStatAdds(
  statAdds: StatAddEntry[] | undefined,
  level: number
): PassiveDefenseBonuses {
  const entries = statAdds ?? [];
  const out: PassiveDefenseBonuses = { ac: 0, fortitude: 0, reflex: 0, will: 0 };
  for (const e of entries) {
    if (e.condition || e.wearing) continue;
    if (!appliesRequires(e.requires, level)) continue;
    const bucket = defenseBucketFromStatName(e.name);
    if (!bucket) continue;
    let n = 0;
    const direct = parseDirectPlusInt(e.value);
    if (direct !== null) n = direct;
    else if (e.value.startsWith("+")) {
      const refName = e.value.slice(1).trim();
      if (refName) n = resolveNamedTieredBonus(entries, refName, level);
    }
    out[bucket] += n;
  }
  return out;
}

/** Maps ETL `nadBonusesFromSpecific` (lowercase keys) onto PascalCase NAD totals. */
export function nadSpecificToDefensePartial(
  nad: NadBonusesFromSpecific | undefined
): Partial<Record<NadDefenseKey, number>> {
  if (!nad) return {};
  const out: Partial<Record<NadDefenseKey, number>> = {};
  if (nad.fortitude) out.Fortitude = nad.fortitude;
  if (nad.reflex) out.Reflex = nad.reflex;
  if (nad.will) out.Will = nad.will;
  return out;
}

export function mergePassiveDefenseBonuses(
  a: PassiveDefenseBonuses,
  b: PassiveDefenseBonuses
): PassiveDefenseBonuses {
  return {
    ac: a.ac + b.ac,
    fortitude: a.fortitude + b.fortitude,
    reflex: a.reflex + b.reflex,
    will: a.will + b.will
  };
}

const emptyPassiveDefense = (): PassiveDefenseBonuses => ({ ac: 0, fortitude: 0, reflex: 0, will: 0 });

function passiveFromStatAddsAndNad(
  level: number,
  statAdds: StatAddEntry[] | undefined,
  nad: NadBonusesFromSpecific | undefined
): PassiveDefenseBonuses {
  const fromAdds = passiveDefenseBonusesFromStatAdds(statAdds, level);
  const nadPartial = nadSpecificToDefensePartial(nad);
  const fromNad: PassiveDefenseBonuses = {
    ac: 0,
    fortitude: nadPartial.Fortitude ?? 0,
    reflex: nadPartial.Reflex ?? 0,
    will: nadPartial.Will ?? 0
  };
  return mergePassiveDefenseBonuses(fromAdds, fromNad);
}

/**
 * Sums unconditional defense bonuses from selected feats, theme, paragon path, and epic destiny
 * (ETL `statAdds` + `nadBonusesFromSpecific`). Situational `statAdds` rows (condition / wearing) are skipped.
 */
export function aggregateSupportPassiveDefenseBonuses(index: RulesIndex, build: CharacterBuild): PassiveDefenseBonuses {
  let total = emptyPassiveDefense();
  for (const id of build.featIds ?? []) {
    const f = index.feats.find((x) => x.id === id);
    if (!f) continue;
    total = mergePassiveDefenseBonuses(total, passiveFromStatAddsAndNad(build.level, f.statAdds, f.nadBonusesFromSpecific));
  }
  if (build.themeId) {
    const t = index.themes.find((x) => x.id === build.themeId);
    if (t) total = mergePassiveDefenseBonuses(total, passiveFromStatAddsAndNad(build.level, t.statAdds, t.nadBonusesFromSpecific));
  }
  if (build.paragonPathId) {
    const p = index.paragonPaths.find((x) => x.id === build.paragonPathId);
    if (p) total = mergePassiveDefenseBonuses(total, passiveFromStatAddsAndNad(build.level, p.statAdds, p.nadBonusesFromSpecific));
  }
  if (build.epicDestinyId) {
    const e = index.epicDestinies.find((x) => x.id === build.epicDestinyId);
    if (e) total = mergePassiveDefenseBonuses(total, passiveFromStatAddsAndNad(build.level, e.statAdds, e.nadBonusesFromSpecific));
  }
  return total;
}

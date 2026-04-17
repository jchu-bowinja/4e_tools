import type { Feat, Power, Race, RacialTrait, RulesIndex } from "./models";
import { parseRacialTraitIdsFromRace } from "./racialTraits";

function parseCommaSeparatedPowerIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.startsWith("ID_FMP_POWER"));
}

/** Power IDs listed on a racial trait (grant rules + specific.Powers). */
export function collectPowerIdsFromRacialTrait(trait: RacialTrait): string[] {
  const ids = new Set<string>();
  const spec = trait.raw?.specific as Record<string, unknown> | undefined;
  const powersField = String(spec?.["Powers"] ?? "").trim();
  if (powersField) {
    for (const id of parseCommaSeparatedPowerIds(powersField)) {
      ids.add(id);
    }
  }
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const grants = (rules?.["grant"] as Array<{ attrs?: Record<string, unknown> }> | undefined) ?? [];
  for (const g of grants) {
    const a = g.attrs || {};
    if (String(a["type"]) === "Power" && typeof a["name"] === "string" && a["name"].startsWith("ID_FMP_POWER")) {
      ids.add(a["name"]);
    }
  }
  return [...ids];
}

/** Power IDs offered by a racial trait that uses a `select` rule for powers (e.g. Lolthtouched). */
export function collectSelectablePowerIdsFromRacialTrait(trait: RacialTrait): string[] {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  const ids = new Set<string>();
  for (const s of selects) {
    if (String(s.attrs?.["type"]) !== "Power") continue;
    const cat = String(s.attrs?.["Category"] ?? "");
    for (const part of cat.split("|")) {
      const id = part.trim();
      if (id.startsWith("ID_FMP_POWER")) ids.add(id);
    }
  }
  return [...ids];
}

function traitHasPowerSelect(trait: RacialTrait): boolean {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  return selects.some((s) => String(s.attrs?.["type"]) === "Power");
}

export interface RacePowerGroup {
  traitId: string;
  traitName: string;
  /** True when the character must pick one of the listed powers elsewhere (builder does not model the pick yet). */
  choiceOnly: boolean;
  powerIds: string[];
}

export function racePowerGroupsForRace(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  extraTraitIds: string[] = []
): RacePowerGroup[] {
  if (!race) return [];
  const out: RacePowerGroup[] = [];
  const seen = new Set<string>();
  const allTraitIds = [...parseRacialTraitIdsFromRace(race), ...extraTraitIds].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const traitId of allTraitIds) {
    const trait = traitsById.get(traitId);
    const traitName = trait?.name || traitId;
    if (!trait) {
      out.push({ traitId, traitName, choiceOnly: false, powerIds: [] });
      continue;
    }
    const granted = collectPowerIdsFromRacialTrait(trait);
    if (granted.length > 0) {
      out.push({ traitId, traitName, choiceOnly: false, powerIds: granted });
      continue;
    }
    if (traitHasPowerSelect(trait)) {
      const opts = collectSelectablePowerIdsFromRacialTrait(trait);
      if (opts.length > 0) {
        out.push({ traitId, traitName, choiceOnly: true, powerIds: opts });
      }
    }
  }
  return out;
}

/** Parse feat `Associated Powers` (comma-separated display names). */
export function parseFeatAssociatedPowerNames(feat: Feat): string[] {
  const spec = feat.raw?.specific as Record<string, unknown> | undefined;
  const raw = String(spec?.["Associated Powers"] ?? "").trim();
  if (!raw || raw.toLowerCase() === "null") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolve display names to powers. If multiple powers share a name, the first index match is used
 * (rare; feat text is meant to reference unambiguous class powers).
 */
export function resolvePowersByLooseNames(index: RulesIndex, names: string[]): Power[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const byName = new Map<string, Power[]>();
  for (const p of index.powers) {
    const key = norm(p.name);
    const arr = byName.get(key);
    if (arr) arr.push(p);
    else byName.set(key, [p]);
  }
  const out: Power[] = [];
  for (const n of names) {
    const list = byName.get(norm(n));
    if (list?.length) out.push(list[0]);
  }
  return out;
}

export function autoGrantedClassPowers(index: RulesIndex, classId: string | undefined): Power[] {
  if (!classId) return [];
  const ids = index.autoGrantedPowerIdsByClassId?.[classId];
  if (!ids?.length) return [];
  const byId = new Map(index.powers.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Power => !!p);
}

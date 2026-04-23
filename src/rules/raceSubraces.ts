import type { Race, RacialTrait } from "./models";
import { parseRacialTraitIdsFromRace } from "./racialTraits";

export interface RaceSubraceData {
  parentTraitId: string;
  parentTraitName: string;
  options: RacialTrait[];
}

function parseIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isLikelySubraceParentTrait(trait: RacialTrait): boolean {
  if (/subrace/i.test(trait.name)) return true;
  const spec = (trait.raw?.specific as Record<string, unknown> | undefined) || {};
  const parsed = parseIdList(spec["_PARSED_SUB_FEATURES"]);
  if (parsed.length > 0) return true;
  const rules = (trait.raw?.rules as Record<string, unknown> | undefined) || {};
  const selects = (rules["select"] as Array<{ attrs?: Record<string, unknown> }> | undefined) || [];
  return selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Racial Trait") return false;
    return /subrace/i.test(String(s.attrs?.["Category"] ?? ""));
  });
}

function hasSubraceSignal(trait: RacialTrait, optionIds: string[]): boolean {
  if (/subrace/i.test(trait.name)) return true;
  if (optionIds.some((id) => id.includes("_SUBRACE_"))) return true;
  const rules = (trait.raw?.rules as Record<string, unknown> | undefined) || {};
  const selects = (rules["select"] as Array<{ attrs?: Record<string, unknown> }> | undefined) || [];
  return selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Racial Trait") return false;
    const cat = String(s.attrs?.["Category"] ?? "").trim();
    if (/subrace/i.test(cat)) return true;
    // Essentials-style "pick one of these racial traits" (e.g. Half-Elf: Dilettante vs Knack for Success).
    // Do not match "Dragonborn Racial Power" (category ends with "Racial Power", not "Power Selection").
    if (/\bpower selection$/i.test(cat)) return true;
    return false;
  });
}

function resolveTraitId(
  id: string,
  traitsById: Map<string, RacialTrait>
): RacialTrait | undefined {
  const direct = traitsById.get(id);
  if (direct) return direct;
  // Some source rows reference SUBRACE ids while the concrete trait row uses RACIAL_TRAIT.
  const subraceToTrait = id.replace("_SUBRACE_", "_RACIAL_TRAIT_");
  if (subraceToTrait !== id) {
    const mapped = traitsById.get(subraceToTrait);
    if (mapped) return mapped;
  }
  return undefined;
}

function resolveSubraceOptionTraits(
  optionIds: string[],
  traitsById: Map<string, RacialTrait>
): RacialTrait[] {
  const out: RacialTrait[] = [];
  const seen = new Set<string>();
  // Prefer explicit SUBRACE ids when present.
  const sortedIds = [...optionIds].sort((a, b) => {
    const as = a.includes("_SUBRACE_") ? 0 : 1;
    const bs = b.includes("_SUBRACE_") ? 0 : 1;
    if (as !== bs) return as - bs;
    return 0;
  });
  for (const id of sortedIds) {
    const row = resolveTraitId(id, traitsById);
    if (!row) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function appendStandardSubraceOption(
  race: Race,
  options: RacialTrait[],
  traitsById: Map<string, RacialTrait>
): RacialTrait[] {
  const target = `standard ${race.name.trim().toLowerCase()} racial traits`;
  if (!target.trim()) return options;
  const seen = new Set(options.map((o) => o.id));
  for (const t of traitsById.values()) {
    if (t.name.trim().toLowerCase() !== target) continue;
    if (!seen.has(t.id)) options.push(t);
    break;
  }
  return options;
}

function findFallbackSubraceParentTrait(
  race: Race,
  traitsById: Map<string, RacialTrait>
): RacialTrait | undefined {
  const raceName = race.name.trim().toLowerCase();
  if (!raceName) return undefined;
  for (const trait of traitsById.values()) {
    if (!isLikelySubraceParentTrait(trait)) continue;
    const tn = trait.name.trim().toLowerCase();
    // Variant data (e.g. "Dragonborn Subrace") is sometimes not listed on race.specific["Racial Traits"].
    if (tn === `${raceName} subrace` || (tn.includes(raceName) && tn.includes("subrace"))) {
      return trait;
    }
  }
  return undefined;
}

export function getRaceSubraceData(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>
): RaceSubraceData | undefined {
  if (!race) return undefined;
  for (const traitId of parseRacialTraitIdsFromRace(race)) {
    const parent = traitsById.get(traitId);
    if (!parent || !isLikelySubraceParentTrait(parent)) continue;
    const spec = (parent.raw?.specific as Record<string, unknown> | undefined) || {};
    const optionIds = parseIdList(spec["_PARSED_SUB_FEATURES"]);
    if (!hasSubraceSignal(parent, optionIds)) continue;
    const options = appendStandardSubraceOption(
      race,
      resolveSubraceOptionTraits(optionIds, traitsById),
      traitsById
    );
    if (options.length === 0) continue;
    return {
      parentTraitId: parent.id,
      parentTraitName: parent.name,
      options
    };
  }
  const fallbackParent = findFallbackSubraceParentTrait(race, traitsById);
  if (fallbackParent) {
    const spec = (fallbackParent.raw?.specific as Record<string, unknown> | undefined) || {};
    const optionIds = parseIdList(spec["_PARSED_SUB_FEATURES"]);
    const options = appendStandardSubraceOption(
      race,
      resolveSubraceOptionTraits(optionIds, traitsById),
      traitsById
    );
    if (options.length > 0) {
      return {
        parentTraitId: fallbackParent.id,
        parentTraitName: fallbackParent.name,
        options
      };
    }
  }
  return undefined;
}

/** Child traits granted/selected inside a chosen subrace trait. */
export function getChildTraitIdsForSubrace(subraceTrait: RacialTrait | undefined): string[] {
  if (!subraceTrait) return [];
  const spec = (subraceTrait.raw?.specific as Record<string, unknown> | undefined) || {};
  const ids = new Set(parseIdList(spec["_PARSED_CHILD_FEATURES"]));
  // Fallback: derive linked racial trait ids from select categories.
  const rules = (subraceTrait.raw?.rules as Record<string, unknown> | undefined) || {};
  const selects = (rules["select"] as Array<{ attrs?: Record<string, unknown> }> | undefined) || [];
  for (const s of selects) {
    if (String(s.attrs?.["type"]) !== "Racial Trait") continue;
    const category = String(s.attrs?.["Category"] ?? "");
    for (const token of category.split("|")) {
      const id = token.trim();
      if (!id.startsWith("ID_")) continue;
      if (!id.includes("_RACIAL_TRAIT_")) continue;
      if (id === subraceTrait.id) continue;
      ids.add(id);
    }
  }
  return [...ids];
}

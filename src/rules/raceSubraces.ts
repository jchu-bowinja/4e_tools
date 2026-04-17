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
    const options = optionIds.map((id) => traitsById.get(id)).filter((t): t is RacialTrait => !!t);
    if (options.length === 0) continue;
    return {
      parentTraitId: parent.id,
      parentTraitName: parent.name,
      options
    };
  }
  return undefined;
}

/** Child traits granted/selected inside a chosen subrace trait. */
export function getChildTraitIdsForSubrace(subraceTrait: RacialTrait | undefined): string[] {
  if (!subraceTrait) return [];
  const spec = (subraceTrait.raw?.specific as Record<string, unknown> | undefined) || {};
  return parseIdList(spec["_PARSED_CHILD_FEATURES"]);
}

import type { CharacterBuild, Race, RacialTrait } from "./models";
import { parseRacialTraitIdsFromRace } from "./racialTraits";

export interface RaceSubraceData {
  parentTraitId: string;
  parentTraitName: string;
  options: RacialTrait[];
}

/** One "pick one of these racial traits" bundle (subrace, manifestation, racial power, …). */
export interface RaceTraitBundleSlot {
  /** `subrace` for the primary subrace bundle; otherwise `racialTrait:${parentTraitId}`. */
  selectionKey: string;
  parentTraitId: string;
  parentTraitName: string;
  options: RacialTrait[];
}

export function parseIdList(raw: unknown): string[] {
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
    if (/\bpower selection$/i.test(cat)) return true;
    return false;
  });
}

function isRacialTraitBundleParent(trait: RacialTrait, optionIds: string[]): boolean {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }> | undefined) ?? [];
  const hasSelect = selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Racial Trait") return false;
    const n = Number(s.attrs?.["number"]);
    return Number.isFinite(n) && n > 0;
  });
  if (!hasSelect) return false;
  if (optionIds.length > 0) return true;
  return selects.some((s) => {
    const cat = String(s.attrs?.["Category"] ?? s.attrs?.["category"] ?? "").trim();
    return !!cat;
  });
}

function resolveTraitId(id: string, traitsById: Map<string, RacialTrait>): RacialTrait | undefined {
  const direct = traitsById.get(id);
  if (direct) return direct;
  const subraceToTrait = id.replace("_SUBRACE_", "_RACIAL_TRAIT_");
  if (subraceToTrait !== id) {
    return traitsById.get(subraceToTrait);
  }
  return undefined;
}

function resolveSubraceOptionTraits(
  optionIds: string[],
  traitsById: Map<string, RacialTrait>
): RacialTrait[] {
  const out: RacialTrait[] = [];
  const seen = new Set<string>();
  const sortedIds = [...optionIds].sort((a, b) => {
    const as = a.includes("_SUBRACE_") ? 0 : 1;
    const bs = b.includes("_SUBRACE_") ? 0 : 1;
    return as - bs;
  });
  for (const id of sortedIds) {
    const row = resolveTraitId(id, traitsById);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function resolveTraitBundleOptions(
  parent: RacialTrait,
  traitsById: Map<string, RacialTrait>
): RacialTrait[] {
  const spec = (parent.raw?.specific as Record<string, unknown> | undefined) || {};
  const optionIds = parseIdList(spec["_PARSED_SUB_FEATURES"]);
  if (optionIds.length > 0) {
    return resolveSubraceOptionTraits(optionIds, traitsById);
  }

  const fromSupports = [...traitsById.values()].filter((t) => {
    const sid = String((t.raw?.specific as Record<string, unknown> | undefined)?.["_SupportsID"] ?? "");
    return sid === parent.id;
  });
  if (fromSupports.length > 0) {
    return fromSupports.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  const rules = parent.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }> | undefined) ?? [];
  const selectRow = selects.find((s) => String(s.attrs?.["type"]) === "Racial Trait");
  const cat = String(selectRow?.attrs?.["Category"] ?? selectRow?.attrs?.["category"] ?? "").trim();
  const parentLower = parent.name.trim().toLowerCase();
  if (!cat) return [];

  return [...traitsById.values()]
    .filter((t) => {
      if (t.id === parent.id) return false;
      const tn = t.name.trim().toLowerCase();
      if (tn === parentLower) return false;
      if (tn.startsWith(`${parentLower} (`) || tn.startsWith(`${parentLower}(`)) return true;
      if (cat.toLowerCase() === parentLower && tn.startsWith(parentLower) && tn.length > parentLower.length) {
        return true;
      }
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
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
    if (tn === `${raceName} subrace` || (tn.includes(raceName) && tn.includes("subrace"))) {
      return trait;
    }
  }
  return undefined;
}

function bundleSelectionKey(parent: RacialTrait, optionIds: string[], useSubraceKey: boolean): string {
  return useSubraceKey ? "subrace" : `racialTrait:${parent.id}`;
}

export function getRaceTraitBundleSlots(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>
): RaceTraitBundleSlot[] {
  if (!race) return [];
  const slots: RaceTraitBundleSlot[] = [];
  const seenParents = new Set<string>();
  let hasSubraceKey = false;

  const pushBundle = (parent: RacialTrait, optionIds: string[]) => {
    if (seenParents.has(parent.id)) return;
    const isSubrace = hasSubraceSignal(parent, optionIds);
    const useSubraceKey = isSubrace && !hasSubraceKey;
    let options = resolveTraitBundleOptions(parent, traitsById);
    if (isSubrace) {
      options = appendStandardSubraceOption(race, options, traitsById);
    }
    if (options.length === 0) return;
    seenParents.add(parent.id);
    if (useSubraceKey) hasSubraceKey = true;
    slots.push({
      selectionKey: bundleSelectionKey(parent, optionIds, useSubraceKey),
      parentTraitId: parent.id,
      parentTraitName: parent.name,
      options
    });
  };

  for (const traitId of parseRacialTraitIdsFromRace(race)) {
    const parent = traitsById.get(traitId);
    if (!parent) continue;
    const optionIds = parseIdList((parent.raw?.specific as Record<string, unknown> | undefined)?.["_PARSED_SUB_FEATURES"]);
    if (!isRacialTraitBundleParent(parent, optionIds)) continue;
    pushBundle(parent, optionIds);
  }

  if (!hasSubraceKey) {
    const fallback = findFallbackSubraceParentTrait(race, traitsById);
    if (fallback) {
      const optionIds = parseIdList(
        (fallback.raw?.specific as Record<string, unknown> | undefined)?.["_PARSED_SUB_FEATURES"]
      );
      pushBundle(fallback, optionIds);
    }
  }

  return slots;
}

export function getRaceSubraceData(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>
): RaceSubraceData | undefined {
  const slot = getRaceTraitBundleSlots(race, traitsById).find((s) => s.selectionKey === "subrace");
  if (!slot) return undefined;
  return {
    parentTraitId: slot.parentTraitId,
    parentTraitName: slot.parentTraitName,
    options: slot.options
  };
}

/** Past Spirit trait granted after a CountsAsRace pick (Revenant past life). */
export function findPastSpiritTraitForCountsAsRace(
  selectedRaceId: string,
  traitsById: Map<string, RacialTrait>,
  races: Race[]
): RacialTrait | undefined {
  const picked = races.find((r) => r.id === selectedRaceId);
  if (!picked) return undefined;
  const target = `past spirit (${picked.name.trim().toLowerCase()})`;
  for (const t of traitsById.values()) {
    if (t.name.trim().toLowerCase() === target) return t;
  }
  return undefined;
}

function countsAsRaceExtraTraitIds(
  race: Race,
  traitsById: Map<string, RacialTrait>,
  races: Race[],
  raceSelections?: Record<string, string>
): string[] {
  const out: string[] = [];
  for (const traitId of parseRacialTraitIdsFromRace(race)) {
    const key = `countsAsRace:${traitId}`;
    const pickedRaceId = raceSelections?.[key];
    if (!pickedRaceId) continue;
    const pastSpirit = findPastSpiritTraitForCountsAsRace(pickedRaceId, traitsById, races);
    if (pastSpirit) out.push(pastSpirit.id);
  }
  return out;
}

/** Child traits listed in `specific._PARSED_CHILD_FEATURES` (excludes select-category option ids). */
export function getStructuralChildTraitIdsForSubrace(subraceTrait: RacialTrait | undefined): string[] {
  if (!subraceTrait) return [];
  const spec = (subraceTrait.raw?.specific as Record<string, unknown> | undefined) || {};
  return parseIdList(spec["_PARSED_CHILD_FEATURES"]);
}

/** Child traits granted/selected inside a chosen bundle option. */
export function getChildTraitIdsForSubrace(subraceTrait: RacialTrait | undefined): string[] {
  if (!subraceTrait) return [];
  const ids = new Set(getStructuralChildTraitIdsForSubrace(subraceTrait));
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

/** Trait ids from all selected racial trait bundles + past-life past spirit. */
export function getRaceExtraTraitIds(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>,
  races?: Race[]
): string[] {
  if (!race) return [];
  const extraTraitIds: string[] = [];
  for (const slot of getRaceTraitBundleSlots(race, traitsById)) {
    const pick = raceSelections?.[slot.selectionKey];
    const selected = pick ? slot.options.find((o) => o.id === pick) : undefined;
    if (selected) {
      extraTraitIds.push(selected.id);
      extraTraitIds.push(...getChildTraitIdsForSubrace(selected));
    }
  }
  if (races?.length) {
    extraTraitIds.push(...countsAsRaceExtraTraitIds(race, traitsById, races, raceSelections));
  }
  return extraTraitIds;
}

export function getRaceExtraTraitIdsFromBuild(
  index: { races: Race[]; racialTraits?: RacialTrait[] },
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): string[] {
  const race = index.races.find((r) => r.id === build.raceId);
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  return getRaceExtraTraitIds(race, traitsById, build.raceSelections, index.races);
}

/**
 * Racial traits to show on the Race tab: top-level race traits plus chosen bundle options,
 * hiding bundle parents and unselected variants.
 */
export function resolveDisplayedRacialTraitsForRace(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>
): Array<{ id: string; trait?: RacialTrait }> {
  const topIds = parseRacialTraitIdsFromRace(race);
  const bundles = getRaceTraitBundleSlots(race, traitsById);
  const hideIds = new Set<string>();

  for (const slot of bundles) {
    hideIds.add(slot.parentTraitId);
    const pick = raceSelections?.[slot.selectionKey];
    const selected = pick ? slot.options.find((o) => o.id === pick) : undefined;
    for (const opt of slot.options) {
      if (!selected || opt.id !== selected.id) hideIds.add(opt.id);
    }
  }

  const rows: Array<{ id: string; trait?: RacialTrait }> = [];
  const seen = new Set<string>();

  for (const id of topIds) {
    if (hideIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, trait: traitsById.get(id) });
  }

  for (const slot of bundles) {
    const pick = raceSelections?.[slot.selectionKey];
    const selected = pick ? slot.options.find((o) => o.id === pick) : undefined;
    if (!selected) continue;
    if (!seen.has(selected.id)) {
      seen.add(selected.id);
      rows.push({ id: selected.id, trait: selected });
    }
    for (const childId of getChildTraitIdsForSubrace(selected)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      rows.push({ id: childId, trait: traitsById.get(childId) });
    }
  }

  return rows;
}

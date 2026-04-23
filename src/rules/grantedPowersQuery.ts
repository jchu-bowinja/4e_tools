import type { CharacterBuild, Feat, Power, Race, RacialTrait, RulesIndex } from "./models";
import { parseRacialTraitIdsFromRace } from "./racialTraits";
import { getChildTraitIdsForSubrace, getRaceSubraceData } from "./raceSubraces";

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

/**
 * Stable key in `CharacterBuild.raceSelections` for a racial trait `select` whose `type` is Power
 * (e.g. Lolthtouched: pick Cloud of Darkness or Darkfire).
 */
export function racePowerSelectSelectionKey(traitId: string): string {
  return `racialPower:${traitId}`;
}

/** Stored in `CharacterBuild.raceSelections` when the race lists Human Power Selection (`2966`). */
export const HUMAN_POWER_OPTION_RACE_KEY = "humanPowerOption";

export const ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION = "ID_FMP_RACIAL_TRAIT_2966";
export const ID_RACIAL_TRAIT_BONUS_AT_WILL = "ID_FMP_RACIAL_TRAIT_356";
export const ID_RACIAL_TRAIT_HEROIC_EFFORT = "ID_FMP_RACIAL_TRAIT_2965";

/** PHB Bonus At-Will racial trait or any Power select with `$$CLASS,at-will,1` (extra class at-will pick). */
export function racialTraitGrantsBonusClassAtWillSlot(trait: RacialTrait): boolean {
  if (trait.id === ID_RACIAL_TRAIT_BONUS_AT_WILL) return true;
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  return selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Power") return false;
    const cat = String(s.attrs?.["Category"] ?? "").trim().toLowerCase();
    return cat.startsWith("$$class,at-will,1");
  });
}

/**
 * Third class at-will slot when the race grants “bonus at-will” (trait `356`, `$$CLASS,at-will,1`, or Human Power
 * Selection default / explicit Bonus At-Will — but not Heroic Effort).
 */
export function raceGrantsBonusClassAtWillSlot(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  extraTraitIds: string[] = [],
  raceSelections?: Record<string, string>
): boolean {
  if (!race) return false;
  const seen = new Set<string>();
  const topTraitIds = parseRacialTraitIdsFromRace(race);
  const allTraitIds = [...topTraitIds, ...extraTraitIds].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (topTraitIds.includes(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION)) {
    const pick = raceSelections?.[HUMAN_POWER_OPTION_RACE_KEY];
    if (pick === ID_RACIAL_TRAIT_HEROIC_EFFORT) return false;
    return true;
  }

  for (const traitId of allTraitIds) {
    const t = traitsById.get(traitId);
    if (t && racialTraitGrantsBonusClassAtWillSlot(t)) return true;
  }
  return false;
}

export function bonusClassAtWillSlotFromRaceBuild(
  index: RulesIndex,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): boolean {
  const race = index.races.find((r) => r.id === build.raceId);
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const raceSubraceData = getRaceSubraceData(race, traitsById);
  const subPick = build.raceSelections?.["subrace"];
  const selectedSubrace =
    subPick && raceSubraceData ? raceSubraceData.options.find((o) => o.id === subPick) : undefined;
  const extraTraitIds: string[] = [];
  if (selectedSubrace) {
    extraTraitIds.push(selectedSubrace.id);
    extraTraitIds.push(...getChildTraitIdsForSubrace(selectedSubrace));
  }
  return raceGrantsBonusClassAtWillSlot(race, traitsById, extraTraitIds, build.raceSelections);
}

function parseCommaSeparatedIds(raw: unknown): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Power IDs offered by a racial trait that uses a `select` rule for powers (e.g. Lolthtouched, Dragonborn Racial Power). */
export function collectSelectablePowerIdsFromRacialTrait(
  trait: RacialTrait,
  traitsById?: Map<string, RacialTrait>
): string[] {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  const ids = new Set<string>();
  const spec = trait.raw?.specific as Record<string, unknown> | undefined;
  const powersField = String(spec?.["Powers"] ?? "").trim();
  const parsedSubFeatureIds = parseCommaSeparatedIds(spec?.["_PARSED_SUB_FEATURES"]);

  for (const s of selects) {
    const selectType = String(s.attrs?.["type"]);
    if (selectType !== "Power" && selectType !== "Racial Trait") continue;
    const catRaw = String(s.attrs?.["Category"] ?? "").trim();
    let fromCategory = false;
    for (const part of catRaw.split("|")) {
      const id = part.trim();
      if (id.startsWith("ID_") && id.includes("_POWER_")) {
        ids.add(id);
        fromCategory = true;
      }
    }
    if (fromCategory) continue;

    // Dynamic lists (human bonus at-will, dilettante, …) need class context — no static ids here.
    if (catRaw.startsWith("$$")) continue;

    // Compendium often puts the trait's own id in Category and lists options in specific.Powers (e.g. Lolthtouched).
    if (powersField && (catRaw === trait.id || !catRaw)) {
      for (const id of parseCommaSeparatedPowerIds(powersField)) ids.add(id);
    }

    // Dragonborn-style: select Racial Trait, with concrete option traits listed in _PARSED_SUB_FEATURES.
    if (selectType === "Racial Trait" && traitsById && parsedSubFeatureIds.length > 0) {
      for (const tid of parsedSubFeatureIds) {
        const optionTrait = traitsById.get(tid);
        if (!optionTrait) continue;
        for (const pid of collectPowerIdsFromRacialTrait(optionTrait)) ids.add(pid);
      }
    }
  }
  return [...ids];
}

function traitHasPowerSelect(trait: RacialTrait): boolean {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  return selects.some((s) => {
    const t = String(s.attrs?.["type"]);
    return t === "Power" || t === "Racial Trait";
  });
}

/**
 * When a parent trait (e.g. Half-Elf Power Selection) lists several subtraits and one is Dilettante,
 * `collectSelectablePowerIdsFromRacialTrait` only picks up statically granted powers (Knack) and would
 * incorrectly show a single dropdown without Dilettante. Skip the merged list; the player chooses the
 * subtrait first (subrace-style), then the Dilettante trait emits `dilettantePick`.
 */
function shouldSkipParentMergedPowerSelection(trait: RacialTrait, traitsById: Map<string, RacialTrait>): boolean {
  const spec = trait.raw?.specific as Record<string, unknown> | undefined;
  const optionIds = parseCommaSeparatedIds(spec?.["_PARSED_SUB_FEATURES"]);
  if (optionIds.length < 2) return false;
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  const isSiblingTraitBundle = selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Racial Trait") return false;
    const cat = String(s.attrs?.["Category"] ?? "").trim();
    if (/subrace/i.test(cat)) return true;
    if (/\bpower selection$/i.test(cat)) return true;
    return false;
  });
  if (!isSiblingTraitBundle) return false;
  return optionIds.some((id) => {
    const t = traitsById.get(id);
    return !!t && racialTraitHasDilettantePowerSelect(t);
  });
}

function parentBundleHasDilettanteSubtrait(trait: RacialTrait, traitsById: Map<string, RacialTrait>): boolean {
  const spec = trait.raw?.specific as Record<string, unknown> | undefined;
  const optionIds = parseCommaSeparatedIds(spec?.["_PARSED_SUB_FEATURES"]);
  return optionIds.some((id) => {
    const t = traitsById.get(id);
    return !!t && racialTraitHasDilettantePowerSelect(t);
  });
}

/** Half-elf Dilettante-style rule: `Category` like `$$NOT_CLASS,at-will,1` (optional extra segments). */
export function racialTraitHasDilettantePowerSelect(trait: RacialTrait): boolean {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  return selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Power") return false;
    const cat = String(s.attrs?.["Category"] ?? "").trim().toLowerCase();
    return cat.startsWith("$$not_class,at-will,1");
  });
}

export interface RacePowerGroup {
  traitId: string;
  traitName: string;
  /** True when the player must pick exactly one power from `powerIds` (stored under `racePowerSelectSelectionKey(traitId)`). */
  choiceOnly: boolean;
  /**
   * When true with `choiceOnly`, options come from `getDilettanteCandidatePowers` (1st at-will attack from another class);
   * `powerIds` is empty.
   */
  dilettantePick?: boolean;
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
    if (traitHasPowerSelect(trait)) {
      const opts = collectSelectablePowerIdsFromRacialTrait(trait, traitsById);
      const skipParentMerged = shouldSkipParentMergedPowerSelection(trait, traitsById);
      if (opts.length > 0 && !skipParentMerged) {
        out.push({ traitId, traitName, choiceOnly: true, powerIds: opts });
        continue;
      }
      if (skipParentMerged && parentBundleHasDilettanteSubtrait(trait, traitsById)) {
        out.push({ traitId, traitName, choiceOnly: true, dilettantePick: true, powerIds: [] });
        continue;
      }
      if (racialTraitHasDilettantePowerSelect(trait)) {
        out.push({ traitId, traitName, choiceOnly: true, dilettantePick: true, powerIds: [] });
        continue;
      }
    }
    const granted = collectPowerIdsFromRacialTrait(trait);
    if (granted.length > 0) {
      out.push({ traitId, traitName, choiceOnly: false, powerIds: granted });
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

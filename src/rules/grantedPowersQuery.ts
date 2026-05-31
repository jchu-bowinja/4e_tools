import type { CharacterBuild, ClassFeature, Feat, Power, Race, RacialTrait, RulesIndex } from "./models";
import {
  categoryGrantsBonusClassAtWill,
  categoryIsDilettanteAtWill,
  isDynamicPowerSelectCategory
} from "./powerSelectCategory";
import { parseRacialTraitIdsFromRace } from "./racialTraits";
import { getRaceExtraTraitIds, getRaceTraitBundleSlots } from "./raceSubraces";
import {
  featureIsAvailableAtLevel,
  parseTraitIdsFromField,
  specOf
} from "./supportTraits";

function parseCommaSeparatedPowerIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.startsWith("ID_FMP_POWER"));
}

/** Power IDs listed on a class feature (`specific.Powers` and power `grant` rules). */
export function collectPowerIdsFromClassFeature(feature: ClassFeature): string[] {
  const ids = new Set<string>();
  const spec = feature.raw?.specific as Record<string, unknown> | undefined;
  const powersField = String(spec?.["Powers"] ?? "").trim();
  if (powersField) {
    for (const id of parseCommaSeparatedPowerIds(powersField)) {
      ids.add(id);
    }
  }
  const rules = feature.raw?.rules as Record<string, unknown> | undefined;
  const grants = (rules?.["grant"] as Array<{ attrs?: Record<string, unknown> }> | undefined) ?? [];
  for (const g of grants) {
    const a = g.attrs || {};
    if (String(a["type"]) === "Power" && typeof a["name"] === "string" && a["name"].startsWith("ID_FMP_POWER")) {
      ids.add(a["name"]);
    }
  }
  return [...ids];
}

/** Fallback when `rules_index.json` predates ETL export of `paragonPathClassFeaturePowerIds`. */
function computeParagonPathClassFeaturePowerIds(index: RulesIndex): Set<string> {
  const paragonFeatureIds = new Set<string>();
  for (const path of index.paragonPaths ?? []) {
    for (const cfId of parseTraitIdsFromField(specOf(path), "Class Features")) {
      paragonFeatureIds.add(cfId);
    }
  }
  const byId = new Map((index.classFeatures ?? []).map((cf) => [cf.id, cf] as const));
  const powerIds = new Set<string>();
  for (const cfId of paragonFeatureIds) {
    const cf = byId.get(cfId);
    if (!cf) continue;
    for (const pid of collectPowerIdsFromClassFeature(cf)) {
      powerIds.add(pid);
    }
  }
  return powerIds;
}

/**
 * Powers granted by paragon-path class features (e.g. Scourge of Io → Draconic Anathema).
 * These must not appear in level-1 class feature power picks such as Channel Divinity.
 */
export function paragonPathClassFeaturePowerIds(index: RulesIndex): Set<string> {
  const fromIndex = index.paragonPathClassFeaturePowerIds;
  if (fromIndex !== undefined) return new Set(fromIndex);
  return computeParagonPathClassFeaturePowerIds(index);
}

export function collectParagonPathClassFeaturePowerIds(
  index: RulesIndex,
  paragonPathId: string | undefined,
  characterLevel: number
): string[] {
  if (!paragonPathId) return [];
  const path = index.paragonPaths.find((p) => p.id === paragonPathId);
  if (!path) return [];
  const byId = new Map((index.classFeatures ?? []).map((cf) => [cf.id, cf]));
  const ids = new Set<string>();
  for (const cfId of parseTraitIdsFromField(specOf(path), "Class Features")) {
    const cf = byId.get(cfId);
    if (!cf || !featureIsAvailableAtLevel(cf, characterLevel)) continue;
    for (const pid of collectPowerIdsFromClassFeature(cf)) {
      ids.add(pid);
    }
  }
  return [...ids];
}

export function resolveParagonPathClassFeaturePowers(
  index: RulesIndex,
  paragonPathId: string | undefined,
  characterLevel: number
): Power[] {
  const byId = new Map(index.powers.map((p) => [p.id, p]));
  return collectParagonPathClassFeaturePowerIds(index, paragonPathId, characterLevel)
    .map((id) => byId.get(id))
    .filter((p): p is Power => !!p);
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

function humanPowerSelectionParentId(index: RulesIndex | undefined): string {
  const fromIndex = index?.racialTraits?.find((t) => t.grantsBonusClassAtWillByDefault)?.id;
  return fromIndex ?? ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION;
}

function heroicEffortTraitId(index: RulesIndex | undefined, trait: RacialTrait | undefined): string {
  return trait?.heroicEffortTraitId ?? ID_RACIAL_TRAIT_HEROIC_EFFORT;
}

/** Human Power Selection bundle slot, when present (selection key is often `subrace`). */
export function findHumanPowerSelectionBundleSlot(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  index?: RulesIndex
) {
  const parentId = humanPowerSelectionParentId(index);
  return getRaceTraitBundleSlots(race, traitsById).find((s) => s.parentTraitId === parentId);
}

/**
 * Human Power Selection pick from the race bundle or legacy `humanPowerOption`.
 * `undefined` means PHB default (third class at-will, not Heroic Effort).
 */
export function resolveHumanPowerSelectionTraitId(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>,
  index?: RulesIndex
): string | undefined {
  const slot = findHumanPowerSelectionBundleSlot(race, traitsById, index);
  if (slot) {
    const fromBundle = raceSelections?.[slot.selectionKey]?.trim();
    if (fromBundle) return fromBundle;
  }
  const legacy = raceSelections?.[HUMAN_POWER_OPTION_RACE_KEY]?.trim();
  if (legacy) return legacy;
  return undefined;
}

/** Whether Human Power Selection grants the third class at-will slot (default / Bonus At-Will, not Heroic Effort). */
export function humanPowerSelectionGrantsBonusClassAtWill(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections?: Record<string, string>,
  index?: RulesIndex
): boolean {
  const parentId = humanPowerSelectionParentId(index);
  if (!race || !parseRacialTraitIdsFromRace(race).includes(parentId)) {
    return false;
  }
  const pick = resolveHumanPowerSelectionTraitId(race, traitsById, raceSelections, index);
  const heroicId = heroicEffortTraitId(
    index,
    traitsById.get(parentId) ?? index?.racialTraits?.find((t) => t.id === parentId)
  );
  return pick !== heroicId;
}

/** PHB Bonus At-Will racial trait or any Power select with `$$CLASS,at-will,1` (extra class at-will pick). */
export function racialTraitGrantsBonusClassAtWillSlot(trait: RacialTrait): boolean {
  if (trait.grantsBonusClassAtWill) return true;
  if (trait.id === ID_RACIAL_TRAIT_BONUS_AT_WILL) return true;
  const cat = trait.powerSelectCategory?.trim();
  if (cat && categoryGrantsBonusClassAtWill(cat)) return true;
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  return selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Power") return false;
    const rawCat = String(s.attrs?.["Category"] ?? "").trim();
    return categoryGrantsBonusClassAtWill(rawCat);
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
  raceSelections?: Record<string, string>,
  index?: RulesIndex
): boolean {
  if (!race) return false;
  const seen = new Set<string>();
  const topTraitIds = parseRacialTraitIdsFromRace(race);
  const allTraitIds = [...topTraitIds, ...extraTraitIds].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const humanParentId = humanPowerSelectionParentId(index);
  if (topTraitIds.includes(humanParentId)) {
    return humanPowerSelectionGrantsBonusClassAtWill(race, traitsById, raceSelections, index);
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
  const extraTraitIds = getRaceExtraTraitIds(race, traitsById, build.raceSelections, index.races);
  return raceGrantsBonusClassAtWillSlot(race, traitsById, extraTraitIds, build.raceSelections, index);
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
    if (isDynamicPowerSelectCategory(catRaw)) continue;

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
  if (trait.powerBundleMode === "subtraitFirst") return true;
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
  const indexed = trait.powerSelectCategory?.trim();
  if (indexed) return categoryIsDilettanteAtWill(indexed);
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const selects = (rules?.["select"] as Array<{ attrs?: Record<string, unknown> }>) ?? [];
  return selects.some((s) => {
    if (String(s.attrs?.["type"]) !== "Power") return false;
    const cat = String(s.attrs?.["Category"] ?? "").trim();
    return categoryIsDilettanteAtWill(cat);
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
  const bundleParentIds = new Set(getRaceTraitBundleSlots(race, traitsById).map((s) => s.parentTraitId));
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
    if (bundleParentIds.has(traitId)) {
      continue;
    }
    /** Human Power sub-options: at-will pick is on the Powers tab; Heroic Effort is a fixed grant. */
    if (traitId === ID_RACIAL_TRAIT_BONUS_AT_WILL || traitId === ID_RACIAL_TRAIT_HEROIC_EFFORT) {
      const granted = collectPowerIdsFromRacialTrait(trait);
      if (granted.length > 0) {
        out.push({ traitId, traitName, choiceOnly: false, powerIds: granted });
      }
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

/** ETL `grantedPowerIds` only (explicit `rules.grant` type Power). */
export function featGrantedPowerIdsFromEtl(feat: Feat): string[] {
  return feat.grantedPowerIds?.length ? [...feat.grantedPowerIds] : [];
}

function featCountsAsChannelDivinity(feat: Feat): boolean {
  const rules = feat.raw?.rules as { grant?: Array<{ attrs?: Record<string, string> }> } | undefined;
  for (const gr of rules?.grant ?? []) {
    const attrs = gr.attrs ?? {};
    if (String(attrs.type ?? "") !== "CountsAsFeature") continue;
    const name = String(attrs.name ?? "");
    if (name.includes("CHANNEL_DIVINITY")) return true;
  }
  return false;
}

/** Fallback when `rules_index.json` predates ETL export of exclusion list. */
function computeFeatGrantedPowerIdsExcludedFromClassFeaturePicks(index: RulesIndex): Set<string> {
  const out = new Set<string>();
  for (const feat of index.feats ?? []) {
    if (featCountsAsChannelDivinity(feat)) continue;
    for (const pid of featGrantedPowerIdsFromEtl(feat)) {
      out.add(pid);
    }
  }
  return out;
}

/**
 * Powers granted by feats that do not also count as Channel Divinity (e.g. Divine Fate).
 * These must not appear in class Channel Divinity picks; they are obtained via the feat.
 */
export function featGrantedPowerIdsExcludedFromClassFeaturePicks(index: RulesIndex): Set<string> {
  const fromIndex = index.featGrantedPowerIdsExcludedFromClassFeaturePicks;
  if (fromIndex !== undefined) return new Set(fromIndex);
  return computeFeatGrantedPowerIdsExcludedFromClassFeaturePicks(index);
}

/** ETL `modifiedPowerIds` (style / arena fighting augmentations, not grants). */
export function featModifiedPowerIdsFromEtl(feat: Feat): string[] {
  if (feat.modifiedPowerIds?.length) return [...feat.modifiedPowerIds];
  return resolveFeatPowerModifications(feat)
    .map((m) => m.powerId)
    .filter((id): id is string => !!id);
}

/** Structured augmentations from ETL, with fallback to raw.rules.modify type Power. */
export function resolveFeatPowerModifications(feat: Feat): Array<{
  powerName: string;
  powerId?: string | null;
  classFeatureId?: string | null;
  field: string;
  value: string;
}> {
  if (feat.powerModifications?.length) return feat.powerModifications;
  const featName = feat.name;
  const rules = feat.raw?.rules as { modify?: Array<{ attrs?: Record<string, string> }> } | undefined;
  const out: Array<{
    powerName: string;
    powerId?: string | null;
    classFeatureId?: string | null;
    field: string;
    value: string;
  }> = [];
  for (const row of rules?.modify ?? []) {
    const attrs = row.attrs;
    if (!attrs || String(attrs.type ?? "").toLowerCase() !== "power") continue;
    const powerName = String(attrs.name ?? "").trim();
    if (!powerName) continue;
    const field = String(attrs.Field ?? attrs.field ?? featName).trim();
    let value = String(attrs.value ?? "").trim();
    if (!value && field === "Keywords" && attrs["list-addition"]) {
      value = String(attrs["list-addition"]).trim();
    }
    out.push({
      powerName,
      powerId: null,
      classFeatureId: null,
      field,
      value
    });
  }
  return out;
}

/** Powers granted by a feat (`rules.grant` type Power only). */
export function resolveFeatGrantedPowers(index: RulesIndex, feat: Feat): Power[] {
  const etlIds = featGrantedPowerIdsFromEtl(feat);
  if (etlIds.length === 0) return [];
  const byId = new Map(index.powers.map((p) => [p.id, p]));
  return etlIds.map((id) => byId.get(id)).filter((p): p is Power => !!p);
}

/** Powers augmented by a feat (resolved to compendium rows when ETL supplied ids). */
export function resolveFeatModifiedPowers(index: RulesIndex, feat: Feat): Power[] {
  const ids = featModifiedPowerIdsFromEtl(feat);
  if (ids.length > 0) {
    const byId = new Map(index.powers.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Power => !!p);
  }
  return resolvePowersByLooseNames(
    index,
    resolveFeatPowerModifications(feat).map((m) => m.powerName)
  );
}

/** All powers granted by selected feats (deduped, stable order). */
export function collectFeatGrantedPowersForBuild(
  index: RulesIndex,
  build: Pick<CharacterBuild, "featIds">
): Array<{ feat: Feat; powers: Power[] }> {
  const rows: Array<{ feat: Feat; powers: Power[] }> = [];
  const seenPowerIds = new Set<string>();
  for (const fid of build.featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    if (!feat) continue;
    const powers = resolveFeatGrantedPowers(index, feat).filter((p) => {
      if (seenPowerIds.has(p.id)) return false;
      seenPowerIds.add(p.id);
      return true;
    });
    if (powers.length > 0) rows.push({ feat, powers });
  }
  return rows;
}

/**
 * Feat augmentations for powers the character already has (style / arena fighting).
 * Does not add powers to the build — only surfaces existing picks the feat modifies.
 */
export function collectFeatModifiedPowersForBuild(
  index: RulesIndex,
  build: Pick<CharacterBuild, "featIds">,
  characterPowerIds: ReadonlySet<string>
): Array<{ feat: Feat; powers: Power[] }> {
  const rows: Array<{ feat: Feat; powers: Power[] }> = [];
  const seenPowerIds = new Set<string>();
  for (const fid of build.featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    if (!feat) continue;
    const powers = resolveFeatModifiedPowers(index, feat).filter((p) => {
      if (!characterPowerIds.has(p.id)) return false;
      if (seenPowerIds.has(p.id)) return false;
      seenPowerIds.add(p.id);
      return true;
    });
    if (powers.length > 0) rows.push({ feat, powers });
  }
  return rows;
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

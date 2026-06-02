import { attackPowerBucketFromUsage } from "../../rules/classPowerSlots";
import { collectDilettantePowersForBuild } from "../../rules/dilettantePower";
import { resolveBaseAugmentablePowerId } from "../../rules/psionicPowerAugments";
import { getPowersForOwnerId } from "../../rules/classPowersQuery";
import { collectParagonMulticlassPowerIds } from "../../rules/paragonMulticlassing";
import {
  autoGrantedClassPowers,
  collectFeatGrantedPowersForBuild,
  collectParagonPathClassFeaturePowerIds,
  collectPowerIdsFromRacialTrait
} from "../../rules/grantedPowersQuery";
import { collectClassFeaturePowerChoiceIds } from "../../rules/classFeatureChoices";
import { parseRacialTraitIdsFromRace } from "../../rules/racialTraits";
import { computeBuilderLikeDerivedStats } from "../../rules/derivedStatsFromBuild";
import type { AcBreakdown } from "../../rules/defenseCalculator";
import type { StatScoreBreakdown } from "../../rules/statScoreBreakdown";
import { mergeHybridProficiencyLines } from "../../rules/hybridDerivedStats";
import type { PassiveOtherBonuses } from "../../rules/supportStatAdds";
import { normalizeCharacterBuild, normalizeCharacterEquipment } from "../../rules/equipment";
import type {
  Armor,
  CharacterBuild,
  ClassDef,
  HybridClassDef,
  Implement,
  Power,
  Race,
  RacialTrait,
  RulesIndex,
  Weapon
} from "../../rules/models";
import type { CharacterSheetState, EquippedSlotKey, EquipmentSlot, InventoryItem } from "./model";
import { buildLikeStateFromSheet, sheetCharacterEquipment } from "./sheetEquipment";

export interface SheetDerivedData {
  race?: Race;
  cls?: ClassDef;
  armor?: Armor;
  shield?: Armor;
  maxHp: number;
  bloodied: number;
  surgeValue: number;
  healingSurgesPerDay: number;
  speed: number;
  initiative: number;
  defenses: {
    ac: number;
    fortitude: number;
    reflex: number;
    will: number;
  };
  armorCheckPenalty: number;
  abilityMods: Record<"STR" | "CON" | "DEX" | "INT" | "WIS" | "CHA", number>;
  /** Initiative / speed / surge / skill flat bonuses from feat, theme, path, destiny, and racial traits. */
  supportPassiveOther: PassiveOtherBonuses;
  acBreakdown: AcBreakdown;
  speedBreakdown: StatScoreBreakdown;
  initiativeBreakdown: StatScoreBreakdown;
  fortitudeBreakdown: StatScoreBreakdown;
  reflexBreakdown: StatScoreBreakdown;
  willBreakdown: StatScoreBreakdown;
}

export interface GroupedPowerCards {
  atWill: Power[];
  encounter: Power[];
  daily: Power[];
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function findArmorByInventorySlot(
  state: CharacterSheetState,
  index: RulesIndex,
  slot: EquipmentSlot,
  predicate: (armor: Armor) => boolean
): Armor | undefined {
  const itemId = state.equipment[slot];
  if (!itemId) return undefined;
  const item = state.inventory.find((entry) => entry.id === itemId);
  if (!item?.sourceId) return undefined;
  const armor = index.armors.find((a) => a.id === item.sourceId);
  if (!armor) return undefined;
  return predicate(armor) ? armor : undefined;
}

export function canEquipItem(item: InventoryItem, slot: EquippedSlotKey): boolean {
  return item.quantity > 0 && item.slotHints.includes(slot);
}

export function toBuildLikeState(state: CharacterSheetState, index: RulesIndex): CharacterBuild {
  return normalizeCharacterBuild(buildLikeStateFromSheet(state, index), index);
}

export function computeSheetDerivedData(state: CharacterSheetState, index: RulesIndex): SheetDerivedData {
  const race = index.races.find((r) => r.id === state.raceId);
  const cls = index.classes.find((c) => c.id === state.classId);
  const armor = findArmorByInventorySlot(
    state,
    index,
    "armor",
    (item) => !String(item.armorType || "").toLowerCase().includes("shield")
  );
  const shield = findArmorByInventorySlot(
    state,
    index,
    "offHand",
    (item) => String(item.armorType || "").toLowerCase().includes("shield")
  );

  const build = toBuildLikeState(state, index);
  const derived = computeBuilderLikeDerivedStats(index, build, race, armor, shield);
  return {
    race,
    cls,
    armor,
    shield,
    maxHp: derived.maxHp,
    bloodied: Math.max(1, Math.floor(derived.maxHp / 2)),
    surgeValue: derived.surgeValue,
    healingSurgesPerDay: derived.healingSurgesPerDay,
    speed: derived.speed,
    initiative: derived.initiative,
    defenses: derived.defenses,
    armorCheckPenalty: derived.armorCheckPenalty,
    abilityMods: {
      STR: abilityMod(state.abilityScores.STR),
      CON: abilityMod(state.abilityScores.CON),
      DEX: abilityMod(state.abilityScores.DEX),
      INT: abilityMod(state.abilityScores.INT),
      WIS: abilityMod(state.abilityScores.WIS),
      CHA: abilityMod(state.abilityScores.CHA)
    },
    supportPassiveOther: derived.supportPassiveOther,
    acBreakdown: derived.acBreakdown,
    speedBreakdown: derived.speedBreakdown,
    initiativeBreakdown: derived.initiativeBreakdown,
    fortitudeBreakdown: derived.fortitudeBreakdown,
    reflexBreakdown: derived.reflexBreakdown,
    willBreakdown: derived.willBreakdown
  };
}

export function findWeaponEquippedInSlot(
  state: CharacterSheetState,
  index: RulesIndex,
  slot: "mainHand" | "offHand"
): Weapon | undefined {
  const itemId = state.equipment[slot];
  if (!itemId) return undefined;
  const inv = state.inventory.find((e) => e.id === itemId);
  if (!inv || inv.kind !== "weapon" || !inv.sourceId) return undefined;
  return (index.weapons ?? []).find((w) => w.id === inv.sourceId);
}

export function findImplementEquippedFromSheet(state: CharacterSheetState, index: RulesIndex): Implement | undefined {
  const itemId = state.equipment.implement;
  if (!itemId) return undefined;
  const inv = state.inventory.find((e) => e.id === itemId);
  if (!inv || inv.kind !== "implement" || !inv.sourceId) return undefined;
  return (index.implements ?? []).find((imp) => imp.id === inv.sourceId);
}

function sheetProficiencyHybridContext(
  index: RulesIndex,
  state: CharacterSheetState
): { isHybrid: boolean; hybridA?: HybridClassDef; hybridB?: HybridClassDef } {
  const isHybrid = state.characterStyle === "hybrid" && Boolean(state.hybridClassIdA && state.hybridClassIdB);
  const hybridA = isHybrid ? index.hybridClasses?.find((h) => h.id === state.hybridClassIdA) : undefined;
  const hybridB = isHybrid ? index.hybridClasses?.find((h) => h.id === state.hybridClassIdB) : undefined;
  return { isHybrid, hybridA, hybridB };
}

export function sheetWeaponProficiencyText(
  index: RulesIndex,
  state: CharacterSheetState,
  cls: ClassDef | undefined
): string {
  const { isHybrid, hybridA, hybridB } = sheetProficiencyHybridContext(index, state);
  if (isHybrid && hybridA && hybridB) return mergeHybridProficiencyLines(hybridA, hybridB).weaponLine;
  const spec = (cls?.raw?.specific as Record<string, unknown> | undefined) || {};
  return String(spec["Weapon Proficiencies"] || "");
}

export function sheetArmorProficiencyText(
  index: RulesIndex,
  state: CharacterSheetState,
  cls: ClassDef | undefined
): string {
  const { isHybrid, hybridA, hybridB } = sheetProficiencyHybridContext(index, state);
  if (isHybrid && hybridA && hybridB) return mergeHybridProficiencyLines(hybridA, hybridB).armorLine;
  const spec = (cls?.raw?.specific as Record<string, unknown> | undefined) || {};
  return String(spec["Armor Proficiencies"] || "");
}

export function sheetImplementProficiencyText(
  index: RulesIndex,
  state: CharacterSheetState,
  cls: ClassDef | undefined
): string {
  const hybrid = state.characterStyle === "hybrid" && state.hybridClassIdA && state.hybridClassIdB;
  const hA = hybrid ? index.hybridClasses?.find((h) => h.id === state.hybridClassIdA) : undefined;
  const hB = hybrid ? index.hybridClasses?.find((h) => h.id === state.hybridClassIdB) : undefined;
  if (hybrid && hA && hB) return mergeHybridProficiencyLines(hA, hB).implementLine;
  const spec = (cls?.raw?.specific as Record<string, unknown> | undefined) || {};
  return [spec["Implements"], spec["Implement"]].filter((x): x is string => typeof x === "string").join("; ");
}

/** Hybrid implement attack uses first hybrid side’s base class key abilities (matches builder). */
export function sheetClassForImplementAttack(
  index: RulesIndex,
  state: CharacterSheetState,
  cls: ClassDef | undefined
): ClassDef | undefined {
  const hybrid = state.characterStyle === "hybrid" && state.hybridClassIdA && state.hybridClassIdB;
  if (!hybrid) return cls;
  const hA = index.hybridClasses?.find((h) => h.id === state.hybridClassIdA);
  const baseId = hA?.baseClassId;
  return baseId ? index.classes?.find((c) => c.id === baseId) : cls;
}

function sortPowerCards(list: Power[]): Power[] {
  return [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name);
  });
}

export function groupCombatPowers(state: CharacterSheetState, index: RulesIndex): GroupedPowerCards {
  const byId = new Map(index.powers.map((power) => [power.id, power]));
  const selected = state.powers.selectedPowerIds
    .map((id) => {
      const baseId = resolveBaseAugmentablePowerId(index, id);
      return byId.get(baseId) ?? byId.get(id);
    })
    .filter((p): p is Power => Boolean(p));
  const autoClass = autoGrantedClassPowers(index, state.classId);
  const race = index.races.find((entry) => entry.id === state.raceId);
  const traitsById = new Map(index.racialTraits.map((trait) => [trait.id, trait]));
  const raceGranted = parseRacialTraitIdsFromRace(race)
    .map((traitId) => traitsById.get(traitId))
    .filter((trait): trait is RacialTrait => Boolean(trait))
    .flatMap((trait) => collectPowerIdsFromRacialTrait(trait))
    .map((id) => byId.get(id))
    .filter((p): p is Power => Boolean(p));
  const themeGranted = [
    ...getPowersForOwnerId(index, state.themeId, state.level, "attack"),
    ...getPowersForOwnerId(index, state.themeId, state.level, "utility")
  ];
  const paragonGranted = [
    ...getPowersForOwnerId(index, state.paragonPathId, state.level, "attack"),
    ...getPowersForOwnerId(index, state.paragonPathId, state.level, "utility"),
    ...collectParagonPathClassFeaturePowerIds(index, state.paragonPathId, state.level)
      .map((id) => byId.get(id))
      .filter((p): p is Power => Boolean(p))
  ];
  const epicGranted = [
    ...getPowersForOwnerId(index, state.epicDestinyId, state.level, "attack"),
    ...getPowersForOwnerId(index, state.epicDestinyId, state.level, "utility")
  ];
  const classFeatureChoiceGranted = collectClassFeaturePowerChoiceIds(index, {
    classId: state.classId,
    characterStyle: state.characterStyle,
    hybridClassIdA: state.hybridClassIdA,
    hybridClassIdB: state.hybridClassIdB,
    classSelections: state.classSelections
  })
    .map((id) => byId.get(id))
    .filter((p): p is Power => Boolean(p));
  const featGranted = collectFeatGrantedPowersForBuild(index, {
    featIds: state.featIds ?? []
  }).flatMap((row) => row.powers);
  const dilettanteGranted = collectDilettantePowersForBuild(index, {
    raceId: state.raceId,
    raceSelections: state.raceSelections,
    characterStyle: state.characterStyle,
    classId: state.classId,
    hybridClassIdA: state.hybridClassIdA,
    hybridClassIdB: state.hybridClassIdB
  });
  const paragonMcIds = collectParagonMulticlassPowerIds({
    level: state.level,
    paragonMulticlassing: state.paragonMulticlassing,
    paragonMulticlassPowers: state.paragonMulticlassPowers
  });
  const paragonMcGranted = paragonMcIds
    .map((id) => byId.get(id))
    .filter((p): p is Power => Boolean(p));
  const allPowers = [
    ...selected,
    ...autoClass,
    ...classFeatureChoiceGranted,
    ...raceGranted,
    ...dilettanteGranted,
    ...themeGranted,
    ...paragonGranted,
    ...paragonMcGranted,
    ...epicGranted,
    ...featGranted
  ];
  const deduped = allPowers.filter((power, indexPos) => allPowers.findIndex((entry) => entry.id === power.id) === indexPos);

  const grouped: GroupedPowerCards = { atWill: [], encounter: [], daily: [] };
  for (const p of deduped) {
    const usageBucket = attackPowerBucketFromUsage(p.usage);
    if (usageBucket === "atWill") grouped.atWill.push(p);
    else if (usageBucket === "daily") grouped.daily.push(p);
    else grouped.encounter.push(p);
  }
  return {
    atWill: sortPowerCards(grouped.atWill),
    encounter: sortPowerCards(grouped.encounter),
    daily: sortPowerCards(grouped.daily)
  };
}

export function sheetStateFromBuild(build: CharacterBuild, index: RulesIndex): CharacterSheetState {
  const normalized = normalizeCharacterBuild(build, index);
  const characterEquipment = normalizeCharacterEquipment(normalized.equipment);

  const tempSheet: CharacterSheetState = {
    name: normalized.name || "Unnamed Character",
    level: normalized.level,
    raceId: normalized.raceId,
    raceSelections: normalized.raceSelections ? { ...normalized.raceSelections } : undefined,
    racialAbilityChoice: normalized.racialAbilityChoice,
    classId: normalized.classId,
    classSelections: normalized.classSelections ? { ...normalized.classSelections } : undefined,
    characterStyle: normalized.characterStyle,
    hybridClassIdA: normalized.hybridClassIdA,
    hybridClassIdB: normalized.hybridClassIdB,
    hybridTalentClassFeatureIdA: normalized.hybridTalentClassFeatureIdA,
    hybridTalentClassFeatureIdB: normalized.hybridTalentClassFeatureIdB,
    hybridSideASelections: normalized.hybridSideASelections
      ? { ...normalized.hybridSideASelections }
      : undefined,
    hybridSideBSelections: normalized.hybridSideBSelections
      ? { ...normalized.hybridSideBSelections }
      : undefined,
    themeId: normalized.themeId,
    paragonPathId: normalized.paragonPathId,
    paragonMulticlassing: normalized.paragonMulticlassing,
    paragonMulticlassPowers: normalized.paragonMulticlassPowers
      ? { ...normalized.paragonMulticlassPowers }
      : undefined,
    epicDestinyId: normalized.epicDestinyId,
    characterEquipment,
    abilityScores: normalized.abilityScores,
    trainedSkillIds: [...normalized.trainedSkillIds],
    featIds: [...(normalized.featIds ?? [])],
    resources: {
      currentHp: 1,
      tempHp: 0,
      actionPoints: 0,
      surgesRemaining: 1,
      deathSaves: 0,
      conditions: []
    },
    gold: normalized.gold ?? 0,
    inventory: [...(normalized.inventory ?? [])],
    equipment: { ...(normalized.equippedSlots ?? {}) },
    gear: normalized.gear?.length ? normalized.gear.map((e) => ({ ...e })) : undefined,
    rituals: normalized.rituals?.length ? normalized.rituals.map((e) => ({ ...e })) : undefined,
    ritualScrolls: normalized.ritualScrolls?.length ? normalized.ritualScrolls.map((e) => ({ ...e })) : undefined,
    martialPractices: normalized.martialPractices?.length
      ? normalized.martialPractices.map((e) => ({ ...e }))
      : undefined,
    martialPracticeScrolls: normalized.martialPracticeScrolls?.length
      ? normalized.martialPracticeScrolls.map((e) => ({ ...e }))
      : undefined,
    alchemy: normalized.alchemy?.length ? normalized.alchemy.map((e) => ({ ...e })) : undefined,
    powers: {
      selectedPowerIds: [...normalized.powerIds],
      expendedPowerIds: [],
      manualOrderIds: [],
      groupBy: "usage"
    }
  };

  const withEquipment: CharacterSheetState = tempSheet;
  const derived = computeSheetDerivedData(withEquipment, index);
  return {
    ...withEquipment,
    resources: {
      currentHp: derived.maxHp,
      tempHp: 0,
      actionPoints: 0,
      surgesRemaining: derived.healingSurgesPerDay,
      secondWindUsed: false,
      deathSaves: 0,
      conditions: []
    }
  };
}

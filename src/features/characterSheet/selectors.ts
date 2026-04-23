import { attackPowerBucketFromUsage } from "../../rules/classPowerSlots";
import { getPowersForOwnerId } from "../../rules/classPowersQuery";
import { autoGrantedClassPowers, collectPowerIdsFromRacialTrait } from "../../rules/grantedPowersQuery";
import { parseRacialTraitIdsFromRace } from "../../rules/racialTraits";
import { computeDerivedStats } from "../../rules/statCalculator";
import type { Armor, CharacterBuild, ClassDef, Power, Race, RacialTrait, RulesIndex } from "../../rules/models";
import type { CharacterSheetState, EquipmentSlot, InventoryItem } from "./model";

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

export function canEquipItem(item: InventoryItem, slot: EquipmentSlot): boolean {
  return item.quantity > 0 && item.slotHints.includes(slot);
}

export function toBuildLikeState(state: CharacterSheetState): CharacterBuild {
  return {
    name: state.name,
    level: state.level,
    raceId: state.raceId,
    classId: state.classId,
    themeId: state.themeId,
    paragonPathId: state.paragonPathId,
    epicDestinyId: state.epicDestinyId,
    abilityScores: state.abilityScores,
    trainedSkillIds: state.trainedSkillIds,
    featIds: state.featIds ?? [],
    powerIds: state.powers.selectedPowerIds
  };
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
    "shield",
    (item) => String(item.armorType || "").toLowerCase().includes("shield")
  );

  const derived = computeDerivedStats(toBuildLikeState(state), race, cls, armor, shield);
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
    }
  };
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
    .map((id) => byId.get(id))
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
    ...getPowersForOwnerId(index, state.paragonPathId, state.level, "utility")
  ];
  const epicGranted = [
    ...getPowersForOwnerId(index, state.epicDestinyId, state.level, "attack"),
    ...getPowersForOwnerId(index, state.epicDestinyId, state.level, "utility")
  ];
  const allPowers = [...selected, ...autoClass, ...raceGranted, ...themeGranted, ...paragonGranted, ...epicGranted];
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
  const tempSheet: CharacterSheetState = {
    name: build.name || "Unnamed Character",
    level: build.level,
    raceId: build.raceId,
    classId: build.classId,
    themeId: build.themeId,
    paragonPathId: build.paragonPathId,
    epicDestinyId: build.epicDestinyId,
    abilityScores: build.abilityScores,
    trainedSkillIds: [...build.trainedSkillIds],
    featIds: [...(build.featIds ?? [])],
    resources: {
      currentHp: 1,
      tempHp: 0,
      surgesRemaining: 1,
      deathSaves: 0,
      conditions: []
    },
    inventory: [],
    equipment: {},
    powers: {
      selectedPowerIds: [...build.powerIds],
      expendedPowerIds: [],
      manualOrderIds: []
    }
  };

  const inventory: InventoryItem[] = [];
  const equipment: CharacterSheetState["equipment"] = {};
  const pushEquip = (slot: EquipmentSlot, item: InventoryItem): void => {
    inventory.push(item);
    equipment[slot] = item.id;
  };

  if (build.armorId) {
    const armor = index.armors.find((item) => item.id === build.armorId);
    if (armor) {
      pushEquip("armor", {
        id: `eq-armor-${armor.id}`,
        name: armor.name,
        kind: "armor",
        quantity: 1,
        sourceId: armor.id,
        slotHints: ["armor"]
      });
    }
  }
  if (build.shieldId) {
    const shield = index.armors.find((item) => item.id === build.shieldId);
    if (shield) {
      pushEquip("shield", {
        id: `eq-shield-${shield.id}`,
        name: shield.name,
        kind: "armor",
        quantity: 1,
        sourceId: shield.id,
        slotHints: ["shield"]
      });
    }
  }
  if (build.mainWeaponId) {
    const weapon = (index.weapons ?? []).find((item) => item.id === build.mainWeaponId);
    if (weapon) {
      pushEquip("mainHand", {
        id: `eq-main-${weapon.id}`,
        name: weapon.name,
        kind: "weapon",
        quantity: 1,
        sourceId: weapon.id,
        slotHints: ["mainHand", "offHand"]
      });
    }
  }
  if (build.offHandWeaponId) {
    const weapon = (index.weapons ?? []).find((item) => item.id === build.offHandWeaponId);
    if (weapon) {
      pushEquip("offHand", {
        id: `eq-off-${weapon.id}`,
        name: weapon.name,
        kind: "weapon",
        quantity: 1,
        sourceId: weapon.id,
        slotHints: ["mainHand", "offHand"]
      });
    }
  }
  if (build.implementId) {
    const implement = (index.implements ?? []).find((item) => item.id === build.implementId);
    if (implement) {
      pushEquip("implement", {
        id: `eq-implement-${implement.id}`,
        name: implement.name,
        kind: "implement",
        quantity: 1,
        sourceId: implement.id,
        slotHints: ["implement", "mainHand", "offHand"]
      });
    }
  }

  const withEquipment: CharacterSheetState = {
    ...tempSheet,
    inventory,
    equipment
  };
  const derived = computeSheetDerivedData(withEquipment, index);
  return {
    ...withEquipment,
    resources: {
      currentHp: derived.maxHp,
      tempHp: 0,
      surgesRemaining: derived.healingSurgesPerDay,
      deathSaves: 0,
      conditions: []
    }
  };
}

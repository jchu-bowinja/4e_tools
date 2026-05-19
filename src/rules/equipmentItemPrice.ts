import { findMagicItem } from "./magicItemEquipment";
import type {
  CharacterEquipment,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  NeckSlotSelection,
  RulesIndex
} from "./models";
import { armorGold, implementGold, magicItemGold, weaponGold } from "./itemGold";

function standardSlotGold(
  index: RulesIndex,
  selection: EquipmentSlotSelection | undefined,
  baseKind: "armor" | "weapon"
): number | undefined {
  if (!selection?.baseId && !selection?.enchantmentId) return undefined;
  if (selection.enchantmentId) {
    return magicItemGold(findMagicItem(index, selection.enchantmentId));
  }
  return baseKind === "armor" ? armorGold(index, selection.baseId) : weaponGold(index, selection.baseId);
}

function implementSlotGold(index: RulesIndex, selection: ImplementSlotSelection | undefined): number | undefined {
  if (!selection?.superiorImplementId && !selection?.enchantmentId) return undefined;
  if (selection.enchantmentId) {
    return magicItemGold(findMagicItem(index, selection.enchantmentId));
  }
  return implementGold(index, selection.superiorImplementId);
}

function neckSlotGold(index: RulesIndex, selection: NeckSlotSelection | undefined): number | undefined {
  if (!selection?.enchantmentId) return undefined;
  return magicItemGold(findMagicItem(index, selection.enchantmentId));
}

export type EquipmentPriceSlot =
  | "armor"
  | "shield"
  | "mainHand"
  | "offHand"
  | "implement"
  | "neck";

/** Market price in gp for the current slot configuration (magic price overrides mundane base). */
export function equipmentSlotGoldCost(
  index: RulesIndex,
  slot: EquipmentPriceSlot,
  equipment: CharacterEquipment
): number | undefined {
  switch (slot) {
    case "armor":
      return standardSlotGold(index, equipment.armor, "armor");
    case "shield":
      return standardSlotGold(index, equipment.shield, "armor");
    case "mainHand":
      return standardSlotGold(index, equipment.mainHand, "weapon");
    case "offHand":
      return standardSlotGold(index, equipment.offHand, "weapon");
    case "implement":
      return implementSlotGold(index, equipment.implement);
    case "neck":
      return neckSlotGold(index, equipment.neck);
  }
}

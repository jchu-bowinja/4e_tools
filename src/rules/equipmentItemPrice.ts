import { findMagicItem } from "./magicItemEquipment";
import type {
  CharacterEquipment,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  MagicOnlyEquipmentSlotKey,
  MagicOnlySlotSelection,
  RulesIndex
} from "./models";
import { MAGIC_ONLY_EQUIPMENT_SLOT_KEYS } from "./magicItemEquipment";
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

function magicOnlySlotGold(index: RulesIndex, selection: MagicOnlySlotSelection | undefined): number | undefined {
  if (!selection?.enchantmentId) return undefined;
  return magicItemGold(findMagicItem(index, selection.enchantmentId));
}

export type EquipmentPriceSlot =
  | "armor"
  | "shield"
  | "weapon"
  | "mainHand"
  | "offHand"
  | "implement"
  | MagicOnlyEquipmentSlotKey;

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
    case "weapon":
    case "mainHand":
      return standardSlotGold(index, equipment.mainHand, "weapon");
    case "offHand":
      return standardSlotGold(index, equipment.offHand, "weapon");
    case "implement":
      return implementSlotGold(index, equipment.implement);
    default: {
      if ((MAGIC_ONLY_EQUIPMENT_SLOT_KEYS as readonly string[]).includes(slot)) {
        return magicOnlySlotGold(index, equipment[slot as MagicOnlyEquipmentSlotKey]);
      }
      return undefined;
    }
  }
}

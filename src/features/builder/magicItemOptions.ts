import { groupMagicItemsIntoFamilies, type EnchantmentFamily } from "../../rules/enchantmentFamilies";
import {
  armorMatchesMagicItem,
  isArmorMagicItem,
  isImplementMagicItem,
  isMagicItemForSlot,
  isShieldMagicItem,
  isWeaponMagicItem,
  weaponMatchesMagicItem
} from "../../rules/magicItemEquipment";
import type { Armor, MagicItem, MagicOnlyEquipmentSlotKey, RulesIndex, Weapon } from "../../rules/models";

function sortByName(items: MagicItem[]): MagicItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function magicArmorOptions(index: RulesIndex, selectedArmor: Armor | undefined): MagicItem[] {
  return sortByName(
    (index.magicItems ?? [])
      .filter(isArmorMagicItem)
      .filter((item) => !isShieldMagicItem(item))
      .filter((item) => armorMatchesMagicItem(selectedArmor, item))
  );
}

export function magicShieldOptions(index: RulesIndex, selectedShield: Armor | undefined): MagicItem[] {
  return sortByName(
    (index.magicItems ?? [])
      .filter(isShieldMagicItem)
      .filter((item) => armorMatchesMagicItem(selectedShield, item))
  );
}

export function magicOptionsForSlot(index: RulesIndex, slot: MagicOnlyEquipmentSlotKey): MagicItem[] {
  return sortByName((index.magicItems ?? []).filter((item) => isMagicItemForSlot(item, slot)));
}

export function magicNeckOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "neck");
}

export function magicHeadOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "head");
}

export function magicArmsOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "arms");
}

export function magicHandsOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "hands");
}

export function magicFeetOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "feet");
}

export function magicWaistOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "waist");
}

export function magicRingOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "ring1");
}

export function magicCompanionOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "companion");
}

export function magicMountOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "mount");
}

export function magicFamiliarOptions(index: RulesIndex): MagicItem[] {
  return magicOptionsForSlot(index, "familiar");
}

export function magicWeaponOptions(index: RulesIndex, selectedWeapon: Weapon | undefined): MagicItem[] {
  return sortByName(
    (index.magicItems ?? []).filter(isWeaponMagicItem).filter((item) => weaponMatchesMagicItem(selectedWeapon, item))
  );
}

export function magicImplementOptions(index: RulesIndex): MagicItem[] {
  return sortByName((index.magicItems ?? []).filter(isImplementMagicItem));
}

export function magicArmorEnchantmentFamilies(
  index: RulesIndex,
  selectedArmor: Armor | undefined
): EnchantmentFamily[] {
  return groupMagicItemsIntoFamilies(magicArmorOptions(index, selectedArmor));
}

export function magicShieldEnchantmentFamilies(
  index: RulesIndex,
  selectedShield: Armor | undefined
): EnchantmentFamily[] {
  return groupMagicItemsIntoFamilies(magicShieldOptions(index, selectedShield));
}

export function magicEnchantmentFamiliesForSlot(
  index: RulesIndex,
  slot: MagicOnlyEquipmentSlotKey
): EnchantmentFamily[] {
  return groupMagicItemsIntoFamilies(magicOptionsForSlot(index, slot));
}

export function magicNeckEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "neck");
}

export function magicHeadEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "head");
}

export function magicArmsEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "arms");
}

export function magicHandsEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "hands");
}

export function magicFeetEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "feet");
}

export function magicWaistEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "waist");
}

export function magicRingEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "ring1");
}

export function magicCompanionEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "companion");
}

export function magicMountEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "mount");
}

export function magicFamiliarEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return magicEnchantmentFamiliesForSlot(index, "familiar");
}

export function magicWeaponEnchantmentFamilies(
  index: RulesIndex,
  selectedWeapon: Weapon | undefined
): EnchantmentFamily[] {
  return groupMagicItemsIntoFamilies(magicWeaponOptions(index, selectedWeapon));
}

export function magicImplementEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return groupMagicItemsIntoFamilies(magicImplementOptions(index));
}

import { groupMagicItemsIntoFamilies, type EnchantmentFamily } from "../../rules/enchantmentFamilies";
import {
  armorMatchesMagicItem,
  isArmorMagicItem,
  isImplementMagicItem,
  isNeckMagicItem,
  isWeaponMagicItem,
  weaponMatchesMagicItem
} from "../../rules/magicItemEquipment";
import type { Armor, MagicItem, RulesIndex, Weapon } from "../../rules/models";

function sortByName(items: MagicItem[]): MagicItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function magicArmorOptions(index: RulesIndex, selectedArmor: Armor | undefined): MagicItem[] {
  return sortByName(
    (index.magicItems ?? []).filter(isArmorMagicItem).filter((item) => armorMatchesMagicItem(selectedArmor, item))
  );
}

export function magicNeckOptions(index: RulesIndex): MagicItem[] {
  return sortByName((index.magicItems ?? []).filter(isNeckMagicItem));
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

export function magicNeckEnchantmentFamilies(index: RulesIndex): EnchantmentFamily[] {
  return groupMagicItemsIntoFamilies(magicNeckOptions(index));
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

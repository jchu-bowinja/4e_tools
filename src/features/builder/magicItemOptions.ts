import {
  armorMatchesMagicItem,
  isArmorMagicItem,
  isImplementMagicItem,
  isNeckMagicItem,
  isWeaponMagicItem,
  magicItemsAtOrBelowLevel,
  weaponMatchesMagicItem
} from "../../rules/magicItemEquipment";
import type { Armor, MagicItem, RulesIndex, Weapon } from "../../rules/models";

export function magicArmorOptions(
  index: RulesIndex,
  level: number,
  selectedArmor: Armor | undefined
): MagicItem[] {
  return magicItemsAtOrBelowLevel(index.magicItems ?? [], level)
    .filter(isArmorMagicItem)
    .filter((item) => armorMatchesMagicItem(selectedArmor, item))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function magicNeckOptions(index: RulesIndex, level: number): MagicItem[] {
  return magicItemsAtOrBelowLevel(index.magicItems ?? [], level)
    .filter(isNeckMagicItem)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function magicWeaponOptions(
  index: RulesIndex,
  level: number,
  selectedWeapon: Weapon | undefined
): MagicItem[] {
  return magicItemsAtOrBelowLevel(index.magicItems ?? [], level)
    .filter(isWeaponMagicItem)
    .filter((item) => weaponMatchesMagicItem(selectedWeapon, item))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function magicImplementOptions(index: RulesIndex, level: number): MagicItem[] {
  return magicItemsAtOrBelowLevel(index.magicItems ?? [], level)
    .filter(isImplementMagicItem)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

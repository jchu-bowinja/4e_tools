import { findMagicItem, isMagicItemForSlot, MAGIC_ONLY_EQUIPMENT_SLOT_KEYS, MAGIC_ONLY_SLOT_LABELS } from "./magicItemEquipment";
import type {
  Armor,
  EquippedSlotKey,
  EquipmentSlot,
  InventoryItem,
  MagicOnlyEquipmentSlotKey,
  RulesIndex,
  Weapon
} from "./models";

export type WeaponHandSlot = "mainHand" | "offHand";

export interface WeaponWieldProfile {
  handsRequired: "one" | "two";
  hasOffHandProperty: boolean;
  isVersatile: boolean;
  propertyTokens: string[];
}

export interface InventoryEquipOption {
  slot: EquippedSlotKey;
  label: string;
  disabled: boolean;
  hint?: string;
}

export interface InventoryUnequipOption {
  slot: EquippedSlotKey;
  label: string;
}

function norm(s: string | null | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function parsePropertyTokens(properties: string | null | undefined): string[] {
  return String(properties || "")
    .split(/[,;]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function weaponWieldProfile(weapon: Weapon): WeaponWieldProfile {
  const propertyTokens = parsePropertyTokens(weapon.properties);
  const hands = norm(weapon.handsRequired);
  const handsRequired: "one" | "two" = hands.includes("two") ? "two" : "one";
  const hasOffHandProperty = propertyTokens.some((t) => t === "off-hand" || t === "off hand");
  const isVersatile = propertyTokens.some((t) => t === "versatile");
  return { handsRequired, hasOffHandProperty, isVersatile, propertyTokens };
}

export function isShieldArmor(armor: Armor | undefined): boolean {
  if (!armor) return false;
  return norm(armor.armorType).includes("shield");
}

/** Remove an inventory item from every equip slot except `keepSlot`. */
export function clearItemFromOtherEquippedSlots(
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  itemId: string,
  keepSlot?: EquippedSlotKey
): Partial<Record<EquippedSlotKey, string>> {
  const next = normalizeEquippedSlots(equippedSlots);
  for (const slot of Object.keys(next) as EquippedSlotKey[]) {
    if (next[slot] === itemId && slot !== keepSlot) {
      delete next[slot];
    }
  }
  return next;
}

/** Shields and off-hand weapons share one equip slot (`offHand`). */
export function normalizeEquippedSlots(
  equippedSlots: Partial<Record<EquippedSlotKey, string>>
): Partial<Record<EquippedSlotKey, string>> {
  const next = { ...equippedSlots };
  if (next.shield) {
    if (!next.offHand) next.offHand = next.shield;
    delete next.shield;
  }
  return next;
}

export function itemFitsOffHandSlot(item: InventoryItem, index: RulesIndex): boolean {
  if (item.slotHints.includes("offHand")) return true;
  if (item.slotHints.includes("shield")) return true;
  if (item.kind !== "armor") return false;
  const armor = resolveArmorFromInventoryItem(item, index);
  return armor ? isShieldArmor(armor) : false;
}

function shieldEquippedInOffHand(
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  inventory: InventoryItem[],
  index: RulesIndex
): boolean {
  const id = equippedSlots.offHand;
  if (!id) return false;
  const row = inventory.find((i) => i.id === id);
  if (!row) return false;
  const armor = resolveArmorFromInventoryItem(row, index);
  return isShieldArmor(armor);
}

export function resolveWeaponFromInventoryItem(
  item: InventoryItem,
  index: RulesIndex
): Weapon | undefined {
  if (item.kind !== "weapon" || !item.sourceId) return undefined;
  return (index.weapons ?? []).find((w) => w.id === item.sourceId);
}

export function resolveArmorFromInventoryItem(item: InventoryItem, index: RulesIndex): Armor | undefined {
  if (item.kind !== "armor" || !item.sourceId) return undefined;
  return index.armors.find((a) => a.id === item.sourceId);
}

export function isTwoHandedWeapon(weapon: Weapon): boolean {
  return weaponWieldProfile(weapon).handsRequired === "two";
}

export function offHandWeaponAttackPenalty(weapon: Weapon, hand: WeaponHandSlot): number {
  if (hand !== "offHand") return 0;
  const profile = weaponWieldProfile(weapon);
  if (profile.hasOffHandProperty) return 0;
  return -2;
}

/** True when a one-handed versatile weapon is wielded in two hands (off hand unused). */
export function isVersatileWieldedTwoHanded(
  weapon: Weapon,
  hand: WeaponHandSlot,
  equippedSlots: Partial<Record<EquipmentSlot, string>>
): boolean {
  if (hand !== "mainHand") return false;
  const profile = weaponWieldProfile(weapon);
  if (!profile.isVersatile || profile.handsRequired === "two") return false;
  return !equippedSlots.offHand;
}

export function versatileTwoHandedDamageBonus(
  weapon: Weapon,
  hand: WeaponHandSlot,
  equippedSlots: Partial<Record<EquipmentSlot, string>>
): number {
  return isVersatileWieldedTwoHanded(weapon, hand, equippedSlots) ? 1 : 0;
}

export function formatWeaponDamageNotation(baseDamage: string | null | undefined, flatBonus = 0): string {
  const base = String(baseDamage ?? "").trim();
  if (!base || base === "—") return "—";
  if (!flatBonus) return base;
  return `${base} +${flatBonus}`;
}

export function wieldNoteForWeaponInHand(
  weapon: Weapon,
  hand: WeaponHandSlot,
  equippedSlots: Partial<Record<EquipmentSlot, string>> = {}
): string | undefined {
  const profile = weaponWieldProfile(weapon);
  if (profile.handsRequired === "two") {
    return hand === "mainHand" ? "Two-handed; occupies both hands" : "Requires main hand (two-handed)";
  }
  if (profile.isVersatile && hand === "mainHand") {
    if (isVersatileWieldedTwoHanded(weapon, hand, equippedSlots)) {
      return "Wielded two-handed (+1 damage)";
    }
    return "Versatile: two hands for +1 damage";
  }
  if (hand === "offHand" && !profile.hasOffHandProperty) {
    return "Off-hand attack −2";
  }
  if (hand === "offHand" && profile.hasOffHandProperty) {
    return "Off-hand property; no penalty";
  }
  return undefined;
}

function equippedWeaponInHand(
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  inventory: InventoryItem[],
  index: RulesIndex,
  hand: WeaponHandSlot
): Weapon | undefined {
  const id = equippedSlots[hand];
  if (!id) return undefined;
  const row = inventory.find((i) => i.id === id);
  if (!row) return undefined;
  return resolveWeaponFromInventoryItem(row, index);
}

function mainHandHasTwoHandedWeapon(
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  inventory: InventoryItem[],
  index: RulesIndex
): boolean {
  const main = equippedWeaponInHand(equippedSlots, inventory, index, "mainHand");
  return main ? isTwoHandedWeapon(main) : false;
}

/** Apply two-handed ↔ off-hand exclusivity after an equip assignment. */
function applyTwoHandedSlotInteractions(
  next: Partial<Record<EquipmentSlot, string>>,
  slot: EquipmentSlot,
  item: InventoryItem,
  inventory: InventoryItem[],
  index: RulesIndex
): Partial<Record<EquipmentSlot, string>> {
  const weapon = resolveWeaponFromInventoryItem(item, index);

  if (slot === "mainHand" && weapon && isTwoHandedWeapon(weapon)) {
    delete next.offHand;
    return next;
  }

  if (slot === "offHand" && mainHandHasTwoHandedWeapon(next, inventory, index)) {
    delete next.mainHand;
  }

  return next;
}

export function canEquipWeaponToHand(
  weapon: Weapon,
  hand: WeaponHandSlot,
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  inventory: InventoryItem[],
  index: RulesIndex,
  itemId: string
): { allowed: boolean; hint?: string } {
  const profile = weaponWieldProfile(weapon);

  if (profile.handsRequired === "two" && hand === "offHand") {
    return { allowed: false, hint: "Two-handed weapons use the main hand" };
  }

  if (hand === "offHand" && shieldEquippedInOffHand(equippedSlots, inventory, index) && equippedSlots.offHand !== itemId) {
    return { allowed: true, hint: "Replaces shield" };
  }

  if (hand === "offHand" && mainHandHasTwoHandedWeapon(equippedSlots, inventory, index)) {
    return { allowed: true, hint: "Clears two-handed weapon in main hand" };
  }

  if (profile.handsRequired === "two" && hand === "mainHand" && equippedSlots.offHand) {
    return { allowed: true, hint: "Clears off-hand item" };
  }

  const wieldNote = wieldNoteForWeaponInHand(weapon, hand, equippedSlots);
  return { allowed: true, hint: wieldNote };
}

export function canEquipShield(
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  inventory: InventoryItem[],
  index: RulesIndex
): { allowed: boolean; hint?: string } {
  if (mainHandHasTwoHandedWeapon(equippedSlots, inventory, index)) {
    return { allowed: true, hint: "Clears two-handed weapon in main hand" };
  }
  if (equippedSlots.offHand) {
    return { allowed: true, hint: "Replaces off-hand item" };
  }
  return { allowed: true, hint: "Occupies off hand" };
}

export function equipOptionsForInventoryItem(
  item: InventoryItem,
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  index: RulesIndex
): InventoryEquipOption[] {
  const slots = normalizeEquippedSlots(equippedSlots) as Partial<Record<EquipmentSlot, string>>;
  const equipped = new Set(
    (Object.entries(slots) as [EquippedSlotKey, string | undefined][])
      .filter(([, id]) => id === item.id)
      .map(([slot]) => slot)
  );
  const options: InventoryEquipOption[] = [];

  if (item.kind === "armor" && itemFitsOffHandSlot(item, index)) {
    const armor = resolveArmorFromInventoryItem(item, index);
    if (armor && isShieldArmor(armor)) {
      if (!equipped.has("offHand")) {
        const check = canEquipShield(slots, inventory, index);
        options.push({
          slot: "offHand",
          label: "Off hand",
          disabled: !check.allowed,
          hint: check.hint
        });
      }
      return options;
    }
  }

  if (item.kind === "armor" && item.slotHints.includes("armor")) {
    const armor = resolveArmorFromInventoryItem(item, index);
    if (armor && !isShieldArmor(armor) && !equipped.has("armor")) {
      options.push({ slot: "armor", label: "Armor", disabled: false });
    }
  }

  if (item.kind === "gear") {
    for (const slot of MAGIC_ONLY_EQUIPMENT_SLOT_KEYS) {
      if (equipped.has(slot)) continue;
      const fits =
        item.slotHints.includes(slot) ||
        (item.sourceId &&
          (() => {
            const magic = findMagicItem(index, item.sourceId);
            return magic ? isMagicItemForSlot(magic, slot) : false;
          })());
      if (!fits) continue;
      options.push({
        slot,
        label: MAGIC_ONLY_SLOT_LABELS[slot],
        disabled: false
      });
    }
  }

  if (item.slotHints.includes("implement") && !equipped.has("implement")) {
    options.push({ slot: "implement", label: "Implement", disabled: false });
  }

  const weapon = resolveWeaponFromInventoryItem(item, index);
  if (weapon) {
    for (const hand of ["mainHand", "offHand"] as const) {
      if (!item.slotHints.includes(hand) || equipped.has(hand)) continue;
      const check = canEquipWeaponToHand(weapon, hand, slots, inventory, index, item.id);
      options.push({
        slot: hand,
        label: hand === "mainHand" ? "Main hand" : "Off hand",
        disabled: !check.allowed,
        hint: check.hint
      });
    }
  }

  return options;
}

export function unequipOptionsForInventoryItem(
  item: InventoryItem,
  equippedSlots: Partial<Record<EquippedSlotKey, string>>
): InventoryUnequipOption[] {
  const options: InventoryUnequipOption[] = [];
  for (const [slot, id] of Object.entries(normalizeEquippedSlots(equippedSlots)) as [
    EquippedSlotKey,
    string | undefined
  ][]) {
    if (id !== item.id) continue;
    options.push({
      slot,
      label: unequipSlotLabel(slot)
    });
  }
  return options;
}

const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  armor: "Armor",
  shield: "Shield",
  mainHand: "Main hand",
  offHand: "Off hand",
  implement: "Implement"
};

function unequipSlotLabel(slot: EquippedSlotKey): string {
  if (slot in EQUIP_SLOT_LABELS) return EQUIP_SLOT_LABELS[slot as EquipmentSlot];
  if ((MAGIC_ONLY_EQUIPMENT_SLOT_KEYS as readonly string[]).includes(slot)) {
    return MAGIC_ONLY_SLOT_LABELS[slot as MagicOnlyEquipmentSlotKey];
  }
  return slot;
}

export function equippedSlotLabel(
  equippedInSlots: EquipmentSlot[],
  item: InventoryItem,
  inventory: InventoryItem[],
  index: RulesIndex,
  equippedSlots: Partial<Record<EquipmentSlot, string>>
): string | undefined {
  if (equippedInSlots.length === 0) return undefined;
  const labels = equippedInSlots.map((slot) => {
    if (slot === "mainHand" || slot === "offHand") {
      const weapon = resolveWeaponFromInventoryItem(item, index);
      if (weapon) {
        const note = wieldNoteForWeaponInHand(weapon, slot, equippedSlots);
        const base = slot === "mainHand" ? "Main hand" : "Off hand";
        if (isTwoHandedWeapon(weapon) && slot === "mainHand") {
          return "Main hand (two-handed)";
        }
        return note ? `${base} (${note})` : base;
      }
    }
    return EQUIP_SLOT_LABELS[slot] ?? slot;
  });
  return labels.join(", ");
}

/** First open weapon hand allowed by wielding rules (prefers main hand). */
export function firstValidWeaponEquipSlot(
  item: InventoryItem,
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  index: RulesIndex
): WeaponHandSlot | undefined {
  const options = equipOptionsForInventoryItem(item, inventory, equippedSlots, index);
  const main = options.find((o) => o.slot === "mainHand" && !o.disabled);
  if (main) return "mainHand";
  const off = options.find((o) => o.slot === "offHand" && !o.disabled);
  if (off) return "offHand";
  return undefined;
}

export function applyEquipWithHandRules(
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquipmentSlot, string>>,
  itemId: string,
  slot: EquipmentSlot,
  index: RulesIndex
): Partial<Record<EquipmentSlot, string>> | undefined {
  const item = inventory.find((i) => i.id === itemId);
  if (!item || item.quantity <= 0) return undefined;
  const fitsSlot =
    item.slotHints.includes(slot) || (slot === "offHand" && itemFitsOffHandSlot(item, index));
  if (!fitsSlot) return undefined;

  const normalized = normalizeEquippedSlots(equippedSlots) as Partial<Record<EquipmentSlot, string>>;
  const options = equipOptionsForInventoryItem(item, inventory, normalized, index);
  const option = options.find((o) => o.slot === slot);
  if (!option || option.disabled) return undefined;

  const next: Partial<Record<EquipmentSlot, string>> = {
    ...clearItemFromOtherEquippedSlots(normalized, itemId, slot),
    [slot]: itemId
  };

  return applyTwoHandedSlotInteractions(next, slot, item, inventory, index);
}

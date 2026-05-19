import type {
  Armor,
  CharacterBuild,
  MagicItem,
  MagicItemSlotIds,
  MagicOnlyEquipmentSlotKey,
  RulesIndex,
  Weapon
} from "./models";
import { mergePassiveDefenseBonuses, type PassiveDefenseBonuses } from "./supportStatAdds";
import {
  computeEquipmentCombatBonuses,
  enchantmentDefenseBonusesFromItem,
  equipmentDefenseBonusesFromBuild,
  stripLegacyMagicItemBonuses,
  type EquipmentCombatBonuses
} from "./equipment";

export type { MagicItemSlotIds };
export type MagicItemCombatBonuses = EquipmentCombatBonuses;
export { stripLegacyMagicItemBonuses, equipmentDefenseBonusesFromBuild };

const IMPLEMENT_MAGIC_TYPES = new Set([
  "holy symbol",
  "staff",
  "orb",
  "rod",
  "wand",
  "ki focus",
  "totem",
  "superior implement"
]);

export function emptyMagicItemDefenseBonuses(): PassiveDefenseBonuses {
  return { ac: 0, fortitude: 0, reflex: 0, will: 0 };
}

export function normalizeMagicItemSlotIds(raw: unknown): MagicItemSlotIds | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  const out: MagicItemSlotIds = {};
  for (const key of ["armor", "neck", "mainWeapon", "offHandWeapon", "implement"] as const) {
    const id = v[key];
    if (typeof id === "string" && id.trim()) out[key] = id.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function findMagicItem(index: RulesIndex, id: string | undefined): MagicItem | undefined {
  if (!id) return undefined;
  return (index.magicItems ?? []).find((m) => m.id === id);
}

export function equippedMagicItems(index: RulesIndex, slots: MagicItemSlotIds | undefined): MagicItem[] {
  if (!slots) return [];
  const ids = [slots.armor, slots.neck, slots.mainWeapon, slots.offHandWeapon, slots.implement].filter(
    (x): x is string => !!x
  );
  const seen = new Set<string>();
  const out: MagicItem[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const row = findMagicItem(index, id);
    if (row) out.push(row);
  }
  return out;
}

export function magicItemsAtOrBelowLevel(items: MagicItem[], level: number): MagicItem[] {
  return items.filter((m) => {
    const lv = m.level;
    return lv === null || lv === undefined || lv <= level;
  });
}

export function isArmorMagicItem(item: MagicItem): boolean {
  return String(item.magicItemType || "")
    .trim()
    .toLowerCase() === "armor";
}

export function isWeaponMagicItem(item: MagicItem): boolean {
  return String(item.magicItemType || "")
    .trim()
    .toLowerCase() === "weapon";
}

/** Compendium `Magic Item Type` for each magic-only equipment slot. */
export const MAGIC_ITEM_TYPE_BY_SLOT: Record<MagicOnlyEquipmentSlotKey, string> = {
  neck: "neck slot item",
  head: "head slot item",
  arms: "arms slot item",
  hands: "hands slot item",
  feet: "feet slot item",
  waist: "waist slot item",
  ring1: "ring",
  ring2: "ring",
  companion: "companion slot item",
  mount: "mount slot item",
  familiar: "familiar slot item"
};

export const MAGIC_ONLY_EQUIPMENT_SLOT_KEYS: MagicOnlyEquipmentSlotKey[] = [
  "neck",
  "head",
  "arms",
  "hands",
  "waist",
  "feet",
  "ring1",
  "ring2",
  "companion",
  "mount",
  "familiar"
];

export const MAGIC_ONLY_SLOT_LABELS: Record<MagicOnlyEquipmentSlotKey, string> = {
  neck: "Neck",
  head: "Head",
  arms: "Arms",
  hands: "Hands",
  feet: "Feet",
  waist: "Waist",
  ring1: "Ring 1",
  ring2: "Ring 2",
  companion: "Companion",
  mount: "Mount",
  familiar: "Familiar"
};

function magicItemTypes(item: MagicItem): string[] {
  const raw = item.magicItemType;
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  const single = String(raw || "")
    .trim()
    .toLowerCase();
  return single ? [single] : [];
}

export function isMagicItemForSlot(item: MagicItem, slot: MagicOnlyEquipmentSlotKey): boolean {
  const types = magicItemTypes(item);
  const expected = MAGIC_ITEM_TYPE_BY_SLOT[slot];
  if (types.includes(expected)) return true;
  const itemSlot = String(item.itemSlot || "")
    .trim()
    .toLowerCase();
  if (slot === "neck" && itemSlot === "neck") return true;
  if (slot === "head" && itemSlot === "head") return true;
  if (slot === "arms" && itemSlot === "arms") return true;
  if (slot === "hands" && itemSlot === "hands") return true;
  if (slot === "feet" && itemSlot === "feet") return true;
  if (slot === "waist" && itemSlot === "waist") return true;
  if ((slot === "ring1" || slot === "ring2") && itemSlot === "ring") return true;
  if (slot === "companion" && itemSlot === "companion") return true;
  if (slot === "mount" && itemSlot === "mount") return true;
  if (slot === "familiar" && itemSlot === "familiar") return true;
  return false;
}

export function isNeckMagicItem(item: MagicItem): boolean {
  return isMagicItemForSlot(item, "neck");
}

export function isImplementMagicItem(item: MagicItem): boolean {
  const typ = String(item.magicItemType || "")
    .trim()
    .toLowerCase();
  return IMPLEMENT_MAGIC_TYPES.has(typ);
}

export function armorMatchesMagicItem(armor: Armor | undefined, item: MagicItem): boolean {
  if (!armor) return true;
  const types = item.armorTypes;
  if (!types?.length) return true;
  const hay = `${armor.armorCategory || ""} ${armor.name || ""}`.toLowerCase();
  return types.some((t) => hay.includes(t.toLowerCase()));
}

export function weaponMatchesMagicItem(weapon: Weapon | undefined, item: MagicItem): boolean {
  if (!weapon) return true;
  const types = item.weaponTypes;
  if (!types?.length) return true;
  const group = String(weapon.weaponGroup || "").toLowerCase();
  const cat = String(weapon.weaponCategory || "").toLowerCase();
  return types.some((t) => {
    const tl = t.toLowerCase();
    return group.includes(tl) || cat.includes(tl) || tl.includes(group);
  });
}

export function aggregateMagicItemDefenseBonuses(items: MagicItem[], level: number): PassiveDefenseBonuses {
  let merged: PassiveDefenseBonuses = { ac: 0, fortitude: 0, reflex: 0, will: 0 };
  for (const item of items) {
    merged = mergePassiveDefenseBonuses(merged, enchantmentDefenseBonusesFromItem(item, level));
  }
  return merged;
}

/** @deprecated Prefer slot `enhancement` from `build.equipment`; kept for tests. */
export function magicItemAttackBonus(item: MagicItem | undefined): number {
  if (!item) return 0;
  const fromField = item.enhancementBonus;
  if (typeof fromField === "number" && Number.isFinite(fromField)) return fromField;
  const text = String(item.enhancement || "");
  const m = text.match(/\+(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function computeMagicItemCombatBonuses(index: RulesIndex, build: CharacterBuild): MagicItemCombatBonuses {
  return computeEquipmentCombatBonuses(index, build);
}

export function magicItemDefenseBonusesFromBuild(
  index: RulesIndex | undefined,
  build: CharacterBuild
): PassiveDefenseBonuses {
  return equipmentDefenseBonusesFromBuild(index, build);
}

export function formatMagicItemOptionLabel(item: MagicItem): string {
  const lv = item.level != null ? `L${item.level}` : "";
  const enh = item.enhancementBonus != null ? `+${item.enhancementBonus}` : "";
  const bits = [item.name, lv, enh].filter(Boolean);
  return bits.join(" · ");
}

export function pruneMagicItemSlotIds(ids: MagicItemSlotIds | undefined): MagicItemSlotIds | undefined {
  if (!ids) return undefined;
  const out: MagicItemSlotIds = { ...ids };
  for (const key of ["armor", "neck", "mainWeapon", "offHandWeapon", "implement"] as const) {
    if (!out[key]) delete out[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export { normalizeCharacterBuild } from "./equipment";

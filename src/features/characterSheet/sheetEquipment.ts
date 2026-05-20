import { normalizeCharacterBuild, normalizeCharacterEquipment } from "../../rules/equipment";
import { magicItemFamilyDisplayName } from "../../rules/enchantmentFamilies";
import { findMagicItem, isMagicItemForSlot } from "../../rules/magicItemEquipment";
import type { EquipmentPriceSlot } from "../../rules/equipmentItemPrice";
import { MAGIC_ONLY_EQUIPMENT_SLOT_KEYS, MAGIC_ONLY_SLOT_LABELS } from "../../rules/magicItemEquipment";
import type {
  CharacterBuild,
  CharacterEquipment,
  EquippedSlotKey,
  EquipmentSlot,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  InventoryItem,
  InventoryItemKind,
  MagicItem,
  MagicOnlyEquipmentSlotKey,
  MagicOnlySlotSelection,
  RulesIndex
} from "../../rules/models";
import type { CharacterSheetState } from "./model";
import {
  applyEquipWithHandRules,
  canEquipShield,
  canEquipWeaponToHand,
  clearItemFromOtherEquippedSlots,
  equippedSlotLabel,
  equipOptionsForInventoryItem,
  firstValidWeaponEquipSlot,
  isShieldArmor,
  itemFitsOffHandSlot,
  normalizeEquippedSlots,
  resolveArmorFromInventoryItem,
  resolveWeaponFromInventoryItem,
  unequipOptionsForInventoryItem,
  wieldNoteForWeaponInHand,
  type InventoryEquipOption,
  type InventoryUnequipOption,
  type WeaponHandSlot
} from "../../rules/weaponWielding";

function newManualInventoryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `manual-${crypto.randomUUID()}`;
  }
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatSheetItemLabel(
  baseName: string | undefined,
  enchantment: MagicItem | undefined,
  enhancement: number | undefined
): string {
  const parts: string[] = [];
  if (baseName) parts.push(baseName);
  const plus = enhancement ?? 0;
  if (plus > 0) parts.push(`+${plus}`);
  if (enchantment) {
    const enchantLabel = magicItemFamilyDisplayName(enchantment.name);
    parts.push(`(${enchantLabel})`);
  }
  if (parts.length === 0) return "Empty";
  if (baseName && (plus > 0 || enchantment)) {
    return parts.join(" ");
  }
  if (enchantment) return `${enchantLabelWithPlus(enchantment, plus)}`;
  return parts.join(" ");
}

function enchantLabelWithPlus(enchantment: MagicItem, enhancement: number): string {
  const base = magicItemFamilyDisplayName(enchantment.name);
  return enhancement > 0 ? `${base} +${enhancement}` : base;
}

function inventoryIdForSlot(slot: EquipmentSlot, sourceId: string): string {
  return `eq-${slot}-${sourceId}`;
}

function pushStandardSlotInventory(
  inventory: InventoryItem[],
  equipment: Partial<Record<EquipmentSlot, string>>,
  slot: EquipmentSlot,
  selection: EquipmentSlotSelection | undefined,
  index: RulesIndex,
  kind: "armor" | "weapon",
  slotHints: EquipmentSlot[]
): void {
  if (!selection?.baseId && !selection?.enchantmentId) return;
  const baseArmor = kind === "armor" && selection.baseId ? index.armors.find((a) => a.id === selection.baseId) : undefined;
  const baseWeapon =
    kind === "weapon" && selection.baseId ? (index.weapons ?? []).find((w) => w.id === selection.baseId) : undefined;
  const enchantment = selection.enchantmentId ? findMagicItem(index, selection.enchantmentId) : undefined;
  const baseName = baseArmor?.name ?? baseWeapon?.name;
  const sourceId = selection.baseId ?? selection.enchantmentId;
  if (!sourceId) return;
  const item: InventoryItem = {
    id: inventoryIdForSlot(slot, sourceId),
    name: formatSheetItemLabel(baseName, enchantment, selection.enhancement),
    kind,
    quantity: 1,
    sourceId: selection.baseId ?? enchantment?.id,
    slotHints,
    notes: enchantment && selection.baseId ? `Enchantment: ${magicItemFamilyDisplayName(enchantment.name)}` : undefined
  };
  inventory.push(item);
  equipment[slot] = item.id;
}

function pushImplementSlotInventory(
  inventory: InventoryItem[],
  equipment: Partial<Record<EquipmentSlot, string>>,
  selection: ImplementSlotSelection | undefined,
  index: RulesIndex
): void {
  if (!selection?.superiorImplementId && !selection?.enchantmentId) return;
  const base = selection.superiorImplementId
    ? (index.implements ?? []).find((i) => i.id === selection.superiorImplementId)
    : undefined;
  const enchantment = selection.enchantmentId ? findMagicItem(index, selection.enchantmentId) : undefined;
  const sourceId = selection.superiorImplementId ?? selection.enchantmentId;
  if (!sourceId) return;
  const item: InventoryItem = {
    id: inventoryIdForSlot("implement", sourceId),
    name: formatSheetItemLabel(base?.name, enchantment, selection.enhancement),
    kind: "implement",
    quantity: 1,
    sourceId: selection.superiorImplementId ?? enchantment?.id,
    slotHints: ["implement", "mainHand", "offHand"],
    notes: enchantment && base ? `Enchantment: ${magicItemFamilyDisplayName(enchantment.name)}` : undefined
  };
  inventory.push(item);
  equipment.implement = item.id;
}

/** Manual inventory row for the current slot configuration (not auto-equipped). */
export function manualInventoryItemForSlot(
  index: RulesIndex,
  slot: EquipmentPriceSlot,
  equipment: CharacterEquipment
): InventoryItem | undefined {
  if ((MAGIC_ONLY_EQUIPMENT_SLOT_KEYS as readonly string[]).includes(slot)) {
    const selection = equipment[slot as MagicOnlyEquipmentSlotKey];
    if (!selection?.enchantmentId) return undefined;
    const enchantment = findMagicItem(index, selection.enchantmentId);
    if (!enchantment) return undefined;
    return {
      id: newManualInventoryId(),
      name: formatSheetItemLabel(undefined, enchantment, selection.enhancement),
      kind: "gear",
      quantity: 1,
      sourceId: selection.enchantmentId,
      slotHints: [slot as MagicOnlyEquipmentSlotKey],
      notes: `${MAGIC_ONLY_SLOT_LABELS[slot as MagicOnlyEquipmentSlotKey]} slot`
    };
  }

  if (slot === "implement") {
    const selection = equipment.implement;
    if (!selection?.superiorImplementId && !selection?.enchantmentId) return undefined;
    const base = selection.superiorImplementId
      ? (index.implements ?? []).find((i) => i.id === selection.superiorImplementId)
      : undefined;
    const enchantment = selection.enchantmentId ? findMagicItem(index, selection.enchantmentId) : undefined;
    const sourceId = selection.superiorImplementId ?? selection.enchantmentId;
    if (!sourceId) return undefined;
    return {
      id: newManualInventoryId(),
      name: formatSheetItemLabel(base?.name, enchantment, selection.enhancement),
      kind: "implement",
      quantity: 1,
      sourceId: selection.superiorImplementId ?? enchantment?.id,
      slotHints: ["implement", "mainHand", "offHand"],
      notes: enchantment && base ? `Enchantment: ${magicItemFamilyDisplayName(enchantment.name)}` : undefined
    };
  }

  if (slot === "weapon") {
    return manualInventoryItemForSlot(index, "mainHand", equipment);
  }

  const equipmentSlot = slot as EquipmentSlot;
  const selection = equipment[equipmentSlot];
  const kind = equipmentSlot === "mainHand" || equipmentSlot === "offHand" ? "weapon" : "armor";
  if (!selection?.baseId && !selection?.enchantmentId) return undefined;
  const baseArmor = kind === "armor" && selection.baseId ? index.armors.find((a) => a.id === selection.baseId) : undefined;
  const baseWeapon =
    kind === "weapon" && selection.baseId ? (index.weapons ?? []).find((w) => w.id === selection.baseId) : undefined;
  const enchantment = selection.enchantmentId ? findMagicItem(index, selection.enchantmentId) : undefined;
  const baseName = baseArmor?.name ?? baseWeapon?.name;
  const sourceId = selection.baseId ?? selection.enchantmentId;
  if (!sourceId) return undefined;
  const slotHints: EquipmentSlot[] =
    equipmentSlot === "shield"
      ? ["offHand"]
      : equipmentSlot === "mainHand" || equipmentSlot === "offHand"
        ? ["mainHand", "offHand"]
        : [equipmentSlot];
  return {
    id: newManualInventoryId(),
    name: formatSheetItemLabel(baseName, enchantment, selection.enhancement),
    kind,
    quantity: 1,
    sourceId: selection.baseId ?? enchantment?.id,
    slotHints,
    notes: enchantment && selection.baseId ? `Enchantment: ${magicItemFamilyDisplayName(enchantment.name)}` : undefined
  };
}

function pushMagicOnlySlotInventory(
  inventory: InventoryItem[],
  slotKey: MagicOnlyEquipmentSlotKey,
  selection: MagicOnlySlotSelection | undefined,
  index: RulesIndex
): void {
  if (!selection?.enchantmentId) return;
  const enchantment = findMagicItem(index, selection.enchantmentId);
  if (!enchantment) return;
  inventory.push({
    id: `eq-${slotKey}-${selection.enchantmentId}`,
    name: formatSheetItemLabel(undefined, enchantment, selection.enhancement),
    kind: "gear",
    quantity: 1,
    sourceId: selection.enchantmentId,
    slotHints: [slotKey],
    notes: `${MAGIC_ONLY_SLOT_LABELS[slotKey]} slot`
  });
}

function canEquipItemInSlot(item: InventoryItem, slot: EquippedSlotKey, index: RulesIndex): boolean {
  return item.quantity > 0 && itemFitsEquipSlot(item, slot, index);
}

export function isMagicOnlyEquipSlot(slot: EquippedSlotKey): slot is MagicOnlyEquipmentSlotKey {
  return (MAGIC_ONLY_EQUIPMENT_SLOT_KEYS as readonly string[]).includes(slot);
}

const EQUIP_SLOT_BY_PRICE_SLOT: Partial<Record<EquipmentPriceSlot, EquipmentSlot>> = {
  armor: "armor",
  shield: "offHand",
  mainHand: "mainHand",
  offHand: "offHand",
  implement: "implement"
};

function addAcquiredEquipmentToInventory(
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  index: RulesIndex,
  slot: EquipmentPriceSlot,
  characterEquipment: CharacterEquipment
): { inventory: InventoryItem[]; equippedSlots: Partial<Record<EquippedSlotKey, string>> } | undefined {
  const item = manualInventoryItemForSlot(index, slot, characterEquipment);
  if (!item) return undefined;

  const nextInventory = [...inventory, item];
  const nextEquipped: Partial<Record<EquippedSlotKey, string>> = { ...equippedSlots };

  if ((MAGIC_ONLY_EQUIPMENT_SLOT_KEYS as readonly string[]).includes(slot)) {
    const magicSlot = slot as MagicOnlyEquipmentSlotKey;
    if (!nextEquipped[magicSlot]) {
      const cleared = clearItemFromOtherEquippedSlots(nextEquipped, item.id, magicSlot);
      return { inventory: nextInventory, equippedSlots: { ...cleared, [magicSlot]: item.id } };
    }
    return { inventory: nextInventory, equippedSlots: nextEquipped };
  }

  if (slot === "weapon") {
    const hand = firstValidWeaponEquipSlot(item, nextInventory, nextEquipped, index);
    if (hand) {
      const applied = applyEquipWithHandRules(nextInventory, nextEquipped, item.id, hand, index);
      if (applied) return { inventory: nextInventory, equippedSlots: applied };
    }
    return { inventory: nextInventory, equippedSlots: nextEquipped };
  }

  const equipSlot = EQUIP_SLOT_BY_PRICE_SLOT[slot];
  const slotIsEmpty = equipSlot ? !nextEquipped[equipSlot] : false;
  if (equipSlot && slotIsEmpty && canEquipItemInSlot(item, equipSlot, index)) {
    const cleared = clearItemFromOtherEquippedSlots(nextEquipped, item.id, equipSlot);
    return { inventory: nextInventory, equippedSlots: { ...cleared, [equipSlot]: item.id } };
  }

  return { inventory: nextInventory, equippedSlots: nextEquipped };
}

/** Add the current slot configuration to inventory; auto-equip only if the gear slot is empty. */
export function addAcquiredEquipmentToBuild(
  build: CharacterBuild,
  index: RulesIndex,
  slot: EquipmentPriceSlot
): CharacterBuild {
  const characterEquipment = normalizeCharacterEquipment(build.equipment);
  const result = addAcquiredEquipmentToInventory(
    build.inventory ?? [],
    build.equippedSlots ?? {},
    index,
    slot,
    characterEquipment
  );
  if (!result) return build;
  return { ...build, inventory: result.inventory, equippedSlots: result.equippedSlots };
}

export function addAcquiredEquipmentToSheet(
  state: CharacterSheetState,
  index: RulesIndex,
  slot: EquipmentPriceSlot
): CharacterSheetState {
  const characterEquipment = sheetCharacterEquipment(state, index);
  const result = addAcquiredEquipmentToInventory(state.inventory, state.equipment, index, slot, characterEquipment);
  if (!result) return state;
  return { ...state, inventory: result.inventory, equipment: result.equippedSlots };
}

/** Build inventory rows and slot equip ids from normalized `CharacterEquipment`. */
export function inventoryAndSlotsFromCharacterEquipment(
  characterEquipment: CharacterEquipment,
  index: RulesIndex
): { inventory: InventoryItem[]; equipment: Partial<Record<EquipmentSlot, string>> } {
  const inventory: InventoryItem[] = [];
  const equipment: Partial<Record<EquipmentSlot, string>> = {};

  pushStandardSlotInventory(inventory, equipment, "armor", characterEquipment.armor, index, "armor", ["armor"]);
  pushStandardSlotInventory(inventory, equipment, "mainHand", characterEquipment.mainHand, index, "weapon", [
    "mainHand",
    "offHand"
  ]);
  pushStandardSlotInventory(inventory, equipment, "offHand", characterEquipment.offHand, index, "weapon", [
    "mainHand",
    "offHand"
  ]);
  if (!equipment.offHand) {
    pushStandardSlotInventory(inventory, equipment, "offHand", characterEquipment.shield, index, "armor", ["offHand"]);
  }
  pushImplementSlotInventory(inventory, equipment, characterEquipment.implement, index);
  for (const slotKey of MAGIC_ONLY_EQUIPMENT_SLOT_KEYS) {
    pushMagicOnlySlotInventory(inventory, slotKey, characterEquipment[slotKey], index);
  }

  return { inventory, equipment };
}

export function sheetCharacterEquipment(
  state: CharacterSheetState,
  index: RulesIndex
): CharacterEquipment {
  if (state.characterEquipment) {
    return normalizeCharacterEquipment(state.characterEquipment);
  }
  return normalizeCharacterEquipment({ neck: { enhancement: 0 } });
}

export interface SheetEquipmentSummaryRow {
  slotLabel: string;
  detail: string;
}

function rowForStandardSlot(
  slotLabel: string,
  selection: EquipmentSlotSelection | undefined,
  index: RulesIndex,
  kind: "armor" | "weapon"
): SheetEquipmentSummaryRow | undefined {
  if (!selection?.baseId && !selection?.enchantmentId && (selection?.enhancement ?? 0) === 0) {
    return undefined;
  }
  const base =
    kind === "armor" && selection?.baseId
      ? index.armors.find((a) => a.id === selection.baseId)?.name
      : kind === "weapon" && selection?.baseId
        ? (index.weapons ?? []).find((w) => w.id === selection.baseId)?.name
        : undefined;
  const enchantment = selection?.enchantmentId ? findMagicItem(index, selection.enchantmentId) : undefined;
  return {
    slotLabel,
    detail: formatSheetItemLabel(base, enchantment, selection?.enhancement) || "—"
  };
}

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  armor: "Armor",
  shield: "Shield",
  mainHand: "Main hand",
  offHand: "Off hand",
  implement: "Implement"
};

export const EQUIPPED_SLOT_LABELS: Record<EquippedSlotKey, string> = {
  ...EQUIPMENT_SLOT_LABELS,
  ...MAGIC_ONLY_SLOT_LABELS
};

export const EQUIPPED_SLOT_ORDER: EquippedSlotKey[] = [
  "mainHand",
  "offHand",
  "armor",
  "implement",
  ...MAGIC_ONLY_EQUIPMENT_SLOT_KEYS
];

export const CONFIG_EQUIP_SLOT_PREFIX = "config:";

export function isConfigEquipInventoryId(id: string): boolean {
  return id.startsWith(CONFIG_EQUIP_SLOT_PREFIX);
}

export function equipSlotFromConfigInventoryId(id: string): EquippedSlotKey | undefined {
  if (!isConfigEquipInventoryId(id)) return undefined;
  const slot = id.slice(CONFIG_EQUIP_SLOT_PREFIX.length);
  return (EQUIPPED_SLOT_ORDER as string[]).includes(slot) ? (slot as EquippedSlotKey) : undefined;
}

/** Stable inventory row for equipment-tab configuration not yet bought. */
export function configInventoryItemForSlot(
  index: RulesIndex,
  slot: EquippedSlotKey,
  equipment: CharacterEquipment
): InventoryItem | undefined {
  const draft = manualInventoryItemForSlot(index, slot as EquipmentPriceSlot, equipment);
  if (!draft) return undefined;
  return { ...draft, id: `${CONFIG_EQUIP_SLOT_PREFIX}${slot}` };
}

export function inventoryForEquipUi(
  inventory: InventoryItem[],
  characterEquipment: CharacterEquipment | undefined,
  index: RulesIndex
): InventoryItem[] {
  const merged = [...inventory];
  if (!characterEquipment) return merged;
  const normalized = normalizeCharacterEquipment(characterEquipment);
  for (const slot of EQUIPPED_SLOT_ORDER) {
    const configItem = configInventoryItemForSlot(index, slot, normalized);
    if (!configItem) continue;
    const duplicate = merged.some(
      (item) =>
        item.sourceId &&
        configItem.sourceId &&
        item.sourceId === configItem.sourceId &&
        itemFitsEquipSlot(item, slot, index)
    );
    if (!duplicate) merged.push(configItem);
  }
  const shieldConfig = configInventoryItemForSlot(index, "shield", normalized);
  if (shieldConfig && !merged.some((item) => item.id === shieldConfig.id)) {
    const duplicate = merged.some(
      (item) =>
        item.sourceId &&
        shieldConfig.sourceId &&
        item.sourceId === shieldConfig.sourceId &&
        itemFitsEquipSlot(item, "offHand", index)
    );
    if (!duplicate) merged.push({ ...shieldConfig, slotHints: ["offHand"] });
  }
  return merged;
}

/** Inventory item id currently equipped in a slot (empty when the slot is bare). */
export function selectedEquipSlotItemId(
  slot: EquippedSlotKey,
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  _characterEquipment?: CharacterEquipment,
  _index?: RulesIndex
): string {
  return normalizeEquippedSlots(equippedSlots)[slot] ?? "";
}

export interface EquipSlotDropdownChoice {
  itemId: string;
  label: string;
  disabled: boolean;
  hint?: string;
}

function itemFitsEquipSlot(item: InventoryItem, slot: EquippedSlotKey, index: RulesIndex): boolean {
  if (isMagicOnlyEquipSlot(slot)) {
    if (item.slotHints.includes(slot)) return true;
    if (item.kind === "gear" && item.sourceId) {
      const magic = findMagicItem(index, item.sourceId);
      return magic ? isMagicItemForSlot(magic, slot) : false;
    }
    return false;
  }
  if (slot === "offHand") {
    if (itemFitsOffHandSlot(item, index)) {
      if (item.kind !== "armor") return true;
      const armor = resolveArmorFromInventoryItem(item, index);
      return armor ? isShieldArmor(armor) : false;
    }
    return item.slotHints.includes("offHand");
  }
  if (!item.slotHints.includes(slot)) return false;
  if (item.kind !== "armor") return true;
  const armor = resolveArmorFromInventoryItem(item, index);
  if (!armor) return true;
  if (slot === "armor" && isShieldArmor(armor)) return false;
  return true;
}

export function canSelectInventoryItemForEquipSlot(
  item: InventoryItem,
  slot: EquippedSlotKey,
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  index: RulesIndex
): { allowed: boolean; hint?: string } {
  if (item.quantity <= 0 || !itemFitsEquipSlot(item, slot, index)) {
    return { allowed: false };
  }
  if (equippedSlots[slot] === item.id) {
    return { allowed: true };
  }
  if (isMagicOnlyEquipSlot(slot)) {
    return { allowed: true };
  }
  const weapon = resolveWeaponFromInventoryItem(item, index);
  const normalized = normalizeEquippedSlots(equippedSlots) as Partial<Record<EquipmentSlot, string>>;
  if (weapon && (slot === "mainHand" || slot === "offHand")) {
    const check = canEquipWeaponToHand(weapon, slot as WeaponHandSlot, normalized, inventory, index, item.id);
    return { allowed: check.allowed, hint: check.hint };
  }
  if (slot === "offHand" && item.kind === "armor") {
    const check = canEquipShield(normalized, inventory, index);
    return { allowed: check.allowed, hint: check.hint };
  }
  return { allowed: true };
}

/** Inventory rows eligible for a gear-slot dropdown (inventory only; not equipment-tab config). */
export function equipSlotDropdownChoices(
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  slot: EquippedSlotKey,
  index: RulesIndex,
  _characterEquipment?: CharacterEquipment
): EquipSlotDropdownChoice[] {
  const currentId = selectedEquipSlotItemId(slot, inventory, equippedSlots);
  const choices: EquipSlotDropdownChoice[] = [];
  for (const item of inventory) {
    if (!itemFitsEquipSlot(item, slot, index)) continue;
    const check = canSelectInventoryItemForEquipSlot(item, slot, inventory, equippedSlots, index);
    if (!check.allowed && item.id !== currentId) continue;
    choices.push({
      itemId: item.id,
      label: item.name,
      disabled: item.id !== currentId && !check.allowed,
      hint: check.hint
    });
  }
  return choices.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

/** True when the slot is filled or inventory has items that fit it. */
export function equipSlotShouldDisplay(
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  slot: EquippedSlotKey,
  index: RulesIndex,
  _characterEquipment?: CharacterEquipment
): boolean {
  if (selectedEquipSlotItemId(slot, inventory, equippedSlots)) {
    return true;
  }
  return equipSlotDropdownChoices(inventory, equippedSlots, slot, index).length > 0;
}

export function equippedSlotWieldHint(
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  slot: EquippedSlotKey,
  index: RulesIndex,
  characterEquipment?: CharacterEquipment
): string | undefined {
  if (slot !== "mainHand" && slot !== "offHand") return undefined;
  const itemId = selectedEquipSlotItemId(slot, inventory, equippedSlots);
  if (!itemId) return undefined;
  const item = inventory.find((entry) => entry.id === itemId);
  if (!item) return undefined;
  const weapon = resolveWeaponFromInventoryItem(item, index);
  if (!weapon) return undefined;
  return wieldNoteForWeaponInHand(weapon, slot, equippedSlots);
}

export interface CharacterBuildItemRow {
  id: string;
  name: string;
  kind: InventoryItem["kind"];
  quantity: number;
  slotHints: EquippedSlotKey[];
  equippedSlot?: string;
  /** Gear slots this item is currently equipped in. */
  equippedInSlots: EquippedSlotKey[];
  equipOptions: InventoryEquipOption[];
  unequipOptions: InventoryUnequipOption[];
  notes?: string;
}

const INVENTORY_KIND_SORT_ORDER: Record<InventoryItemKind, number> = {
  armor: 0,
  weapon: 1,
  implement: 2,
  gear: 3
};

function compareInventoryItemRows(a: CharacterBuildItemRow, b: CharacterBuildItemRow): number {
  const byKind = INVENTORY_KIND_SORT_ORDER[a.kind] - INVENTORY_KIND_SORT_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function formatEquippedInSlotsLabel(
  equippedInSlots: EquippedSlotKey[],
  item: InventoryItem,
  inventory: InventoryItem[],
  index: RulesIndex,
  equippedBySlot: Partial<Record<EquippedSlotKey, string>>
): string | undefined {
  if (equippedInSlots.length === 0) return undefined;
  const labels = equippedInSlots.map((slot) => {
    if (slot === "mainHand" || slot === "offHand") {
      return equippedSlotLabel([slot], item, inventory, index, equippedBySlot as Partial<Record<EquipmentSlot, string>>);
    }
    return EQUIPPED_SLOT_LABELS[slot];
  });
  return labels.filter(Boolean).join(", ");
}

function inventoryItemRows(
  inventory: InventoryItem[],
  equippedBySlot: Partial<Record<EquippedSlotKey, string>>,
  index: RulesIndex
): CharacterBuildItemRow[] {
  const normalizedEquipped = normalizeEquippedSlots(equippedBySlot);
  const rows = inventory.map((item) => {
    const equippedInSlots = (Object.entries(normalizedEquipped) as [EquippedSlotKey, string | undefined][])
      .filter(([, itemId]) => itemId === item.id)
      .map(([slot]) => slot);
    const equippedSlot = formatEquippedInSlotsLabel(equippedInSlots, item, inventory, index, normalizedEquipped);
    return {
      id: item.id,
      name: item.name,
      kind: item.kind,
      quantity: item.quantity,
      slotHints: item.slotHints,
      equippedSlot,
      equippedInSlots,
      equipOptions: equipOptionsForInventoryItem(item, inventory, normalizedEquipped, index),
      unequipOptions: unequipOptionsForInventoryItem(item, normalizedEquipped),
      notes: item.notes
    };
  });
  return rows.sort(compareInventoryItemRows);
}

/** Equip an inventory row into a gear slot (replaces whatever was equipped there). */
export function equipInventoryItem(
  inventory: InventoryItem[],
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  itemId: string,
  slot: EquippedSlotKey,
  index: RulesIndex
): Partial<Record<EquippedSlotKey, string>> | undefined {
  const item = inventory.find((entry) => entry.id === itemId);
  if (!item || !canEquipItemInSlot(item, slot, index)) return undefined;
  const normalized = normalizeEquippedSlots(equippedSlots);
  if (isMagicOnlyEquipSlot(slot)) {
    const cleared = clearItemFromOtherEquippedSlots(normalized, itemId, slot);
    return { ...cleared, [slot]: itemId };
  }
  const applied = applyEquipWithHandRules(
    inventory,
    normalized as Partial<Record<EquipmentSlot, string>>,
    itemId,
    slot as EquipmentSlot,
    index
  );
  return applied as Partial<Record<EquippedSlotKey, string>> | undefined;
}

export function equipInventoryItemOnBuild(
  build: CharacterBuild,
  itemId: string,
  slot: EquippedSlotKey,
  index: RulesIndex
): CharacterBuild {
  const inventory = build.inventory ?? [];
  const nextEquipped = equipInventoryItem(inventory, build.equippedSlots ?? {}, itemId, slot, index);
  if (!nextEquipped) return build;
  return { ...build, equippedSlots: nextEquipped };
}

export function equipInventoryItemOnSheet(
  state: CharacterSheetState,
  itemId: string,
  slot: EquippedSlotKey,
  index: RulesIndex
): CharacterSheetState {
  const nextEquipped = equipInventoryItem(state.inventory, state.equipment, itemId, slot, index);
  if (!nextEquipped) return state;
  return { ...state, equipment: nextEquipped };
}

/** Remove an inventory item from a gear slot (item stays in inventory). */
export function unequipInventoryItem(
  equippedSlots: Partial<Record<EquippedSlotKey, string>>,
  itemId: string,
  slot: EquippedSlotKey
): Partial<Record<EquippedSlotKey, string>> | undefined {
  const normalized = normalizeEquippedSlots(equippedSlots);
  if (normalized[slot] !== itemId) return undefined;
  const next = { ...normalized };
  delete next[slot];
  return next;
}

export function unequipInventoryItemOnBuild(
  build: CharacterBuild,
  itemId: string,
  slot: EquippedSlotKey
): CharacterBuild {
  const nextEquipped = unequipInventoryItem(build.equippedSlots ?? {}, itemId, slot);
  if (!nextEquipped) return build;
  return { ...build, equippedSlots: nextEquipped };
}

export function unequipInventoryItemOnSheet(
  state: CharacterSheetState,
  itemId: string,
  slot: EquippedSlotKey
): CharacterSheetState {
  const nextEquipped = unequipInventoryItem(state.equipment, itemId, slot);
  if (!nextEquipped) return state;
  return { ...state, equipment: nextEquipped };
}

/** Inventory rows for a builder `CharacterBuild` (acquired via Buy / Add on equipment tab). */
export function characterBuildInventoryItems(build: CharacterBuild, index: RulesIndex): CharacterBuildItemRow[] {
  return inventoryItemRows(build.inventory ?? [], build.equippedSlots ?? {}, index);
}

/** All inventory rows on a character sheet (derived equipment + manual items). */
export function characterSheetInventoryItems(state: CharacterSheetState, index: RulesIndex): CharacterBuildItemRow[] {
  return inventoryItemRows(state.inventory, state.equipment, index);
}

export function characterEquipmentSummaryRows(
  state: CharacterSheetState,
  index: RulesIndex
): SheetEquipmentSummaryRow[] {
  const eq = sheetCharacterEquipment(state, index);
  const rows: SheetEquipmentSummaryRow[] = [];
  const push = (row: SheetEquipmentSummaryRow | undefined): void => {
    if (row) rows.push(row);
  };
  push(rowForStandardSlot("Armor", eq.armor, index, "armor"));
  push(rowForStandardSlot("Shield", eq.shield, index, "armor"));
  push(rowForStandardSlot("Main hand", eq.mainHand, index, "weapon"));
  push(rowForStandardSlot("Off hand", eq.offHand, index, "weapon"));
  if (eq.implement?.superiorImplementId || eq.implement?.enchantmentId || (eq.implement?.enhancement ?? 0) > 0) {
    const base = eq.implement?.superiorImplementId
      ? (index.implements ?? []).find((i) => i.id === eq.implement?.superiorImplementId)?.name
      : undefined;
    const enchantment = eq.implement?.enchantmentId ? findMagicItem(index, eq.implement.enchantmentId) : undefined;
    rows.push({
      slotLabel: "Implement",
      detail: formatSheetItemLabel(base, enchantment, eq.implement?.enhancement)
    });
  }
  for (const slotKey of MAGIC_ONLY_EQUIPMENT_SLOT_KEYS) {
    const selection = eq[slotKey];
    if (!selection?.enchantmentId && (selection?.enhancement ?? 0) === 0) continue;
    const enchantment = selection?.enchantmentId ? findMagicItem(index, selection.enchantmentId) : undefined;
    rows.push({
      slotLabel: MAGIC_ONLY_SLOT_LABELS[slotKey],
      detail: formatSheetItemLabel(undefined, enchantment, selection?.enhancement)
    });
  }
  return rows;
}

/** Inventory rows generated from `characterEquipment` (ids prefixed with `eq-`). */
export function isEquipmentDerivedInventoryItem(item: InventoryItem): boolean {
  return item.id.startsWith("eq-");
}

/** Apply builder equipment updates to sheet state; keeps manually added inventory rows. */
export function updateSheetEquipmentFromBuild(
  state: CharacterSheetState,
  index: RulesIndex,
  updater: (build: CharacterBuild) => CharacterBuild
): CharacterSheetState {
  const build = buildLikeStateFromSheet(state, index);
  const nextBuild = normalizeCharacterBuild(updater(build), index);
  return sheetStateWithCharacterEquipment(state, index, nextBuild.equipment);
}

function stripAutoDerivedInventory(state: CharacterSheetState): {
  inventory: InventoryItem[];
  equipment: Partial<Record<EquippedSlotKey, string>>;
} {
  const inventory = state.inventory.filter((item) => !isEquipmentDerivedInventoryItem(item));
  const equipment: Partial<Record<EquippedSlotKey, string>> = { ...state.equipment };
  for (const slot of Object.keys(equipment) as EquippedSlotKey[]) {
    const itemId = equipment[slot];
    if (itemId && !inventory.some((item) => item.id === itemId)) {
      delete equipment[slot];
    }
  }
  return { inventory, equipment };
}

export function sheetStateWithCharacterEquipment(
  state: CharacterSheetState,
  _index: RulesIndex,
  equipment: CharacterEquipment | undefined
): CharacterSheetState {
  const characterEquipment = normalizeCharacterEquipment(equipment);
  const { inventory, equipment: equipped } = stripAutoDerivedInventory(state);
  return {
    ...state,
    characterEquipment,
    inventory,
    equipment: equipped
  };
}

export function buildLikeStateFromSheet(state: CharacterSheetState, index: RulesIndex): CharacterBuild {
  const characterEquipment = sheetCharacterEquipment(state, index);
  return {
    name: state.name,
    level: state.level,
    raceId: state.raceId,
    raceSelections: state.raceSelections ? { ...state.raceSelections } : undefined,
    racialAbilityChoice: state.racialAbilityChoice,
    classId: state.classId,
    classSelections: state.classSelections ? { ...state.classSelections } : undefined,
    characterStyle: state.characterStyle,
    hybridClassIdA: state.hybridClassIdA,
    hybridClassIdB: state.hybridClassIdB,
    hybridTalentClassFeatureIdA: state.hybridTalentClassFeatureIdA,
    hybridTalentClassFeatureIdB: state.hybridTalentClassFeatureIdB,
    hybridSideASelections: state.hybridSideASelections ? { ...state.hybridSideASelections } : undefined,
    hybridSideBSelections: state.hybridSideBSelections ? { ...state.hybridSideBSelections } : undefined,
    themeId: state.themeId,
    paragonPathId: state.paragonPathId,
    paragonMulticlassing: state.paragonMulticlassing,
    paragonMulticlassPowers: state.paragonMulticlassPowers
      ? { ...state.paragonMulticlassPowers }
      : undefined,
    epicDestinyId: state.epicDestinyId,
    abilityScores: state.abilityScores,
    trainedSkillIds: state.trainedSkillIds,
    featIds: state.featIds ?? [],
    powerIds: state.powers.selectedPowerIds,
    equipment: characterEquipment,
    gold: state.gold,
    inventory: [...state.inventory],
    equippedSlots: normalizeEquippedSlots(state.equipment)
  };
}

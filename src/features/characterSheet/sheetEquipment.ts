import { normalizeCharacterEquipment } from "../../rules/equipment";
import { magicItemFamilyDisplayName } from "../../rules/enchantmentFamilies";
import { findMagicItem } from "../../rules/magicItemEquipment";
import type {
  CharacterBuild,
  CharacterEquipment,
  EquipmentSlotSelection,
  ImplementSlotSelection,
  MagicItem,
  NeckSlotSelection,
  RulesIndex
} from "../../rules/models";
import type { CharacterSheetState, EquipmentSlot, InventoryItem } from "./model";

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

function pushNeckInventory(inventory: InventoryItem[], neck: NeckSlotSelection | undefined, index: RulesIndex): void {
  if (!neck?.enchantmentId) return;
  const enchantment = findMagicItem(index, neck.enchantmentId);
  if (!enchantment) return;
  inventory.push({
    id: `eq-neck-${neck.enchantmentId}`,
    name: formatSheetItemLabel(undefined, enchantment, neck.enhancement),
    kind: "gear",
    quantity: 1,
    sourceId: neck.enchantmentId,
    slotHints: [],
    notes: "Neck slot"
  });
}

/** Build inventory rows and slot equip ids from normalized `CharacterEquipment`. */
export function inventoryAndSlotsFromCharacterEquipment(
  characterEquipment: CharacterEquipment,
  index: RulesIndex
): { inventory: InventoryItem[]; equipment: Partial<Record<EquipmentSlot, string>> } {
  const inventory: InventoryItem[] = [];
  const equipment: Partial<Record<EquipmentSlot, string>> = {};

  pushStandardSlotInventory(inventory, equipment, "armor", characterEquipment.armor, index, "armor", ["armor"]);
  pushStandardSlotInventory(inventory, equipment, "shield", characterEquipment.shield, index, "armor", ["shield"]);
  pushStandardSlotInventory(inventory, equipment, "mainHand", characterEquipment.mainHand, index, "weapon", [
    "mainHand",
    "offHand"
  ]);
  pushStandardSlotInventory(inventory, equipment, "offHand", characterEquipment.offHand, index, "weapon", [
    "mainHand",
    "offHand"
  ]);
  pushImplementSlotInventory(inventory, equipment, characterEquipment.implement, index);
  pushNeckInventory(inventory, characterEquipment.neck, index);

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
  if (eq.neck?.enchantmentId || (eq.neck?.enhancement ?? 0) > 0) {
    const enchantment = eq.neck?.enchantmentId ? findMagicItem(index, eq.neck.enchantmentId) : undefined;
    rows.push({
      slotLabel: "Neck",
      detail: formatSheetItemLabel(undefined, enchantment, eq.neck?.enhancement)
    });
  }
  return rows;
}

export function buildLikeStateFromSheet(state: CharacterSheetState, index: RulesIndex): CharacterBuild {
  const characterEquipment = sheetCharacterEquipment(state, index);
  return {
    name: state.name,
    level: state.level,
    raceId: state.raceId,
    classId: state.classId,
    characterStyle: state.characterStyle,
    hybridClassIdA: state.hybridClassIdA,
    hybridClassIdB: state.hybridClassIdB,
    themeId: state.themeId,
    paragonPathId: state.paragonPathId,
    epicDestinyId: state.epicDestinyId,
    abilityScores: state.abilityScores,
    trainedSkillIds: state.trainedSkillIds,
    featIds: state.featIds ?? [],
    powerIds: state.powers.selectedPowerIds,
    equipment: characterEquipment
  };
}

import type { CharacterBuild, RulesIndex } from "../../rules/models";
import {
  alchemyItemsFromIndex,
  adventuringGearFromIndex,
  martialPracticesFromIndex,
  ritualsFromIndex
} from "../../rules/consumablesCatalog";
import {
  consumableEntries,
  martialPracticeScrollEntries,
  ritualScrollEntries,
  setConsumableEntries,
  setConsumableQuantity,
  setMartialPracticeScrollEntries,
  setRitualScrollEntries,
  type ConsumableListKey
} from "../../rules/consumablesModel";
import { characterBuildInventoryItems, type CharacterBuildItemRow } from "./sheetEquipment";

export type UnifiedInventoryCategory =
  | "equipment"
  | "adventuringGear"
  | "ritual"
  | "ritualScroll"
  | "alchemy"
  | "martialPractice"
  | "martialPracticeScroll";

export type UnifiedInventoryFilter = "all" | UnifiedInventoryCategory;

export const UNIFIED_INVENTORY_CATEGORIES: UnifiedInventoryCategory[] = [
  "equipment",
  "adventuringGear",
  "ritual",
  "ritualScroll",
  "alchemy",
  "martialPractice",
  "martialPracticeScroll"
];

export const UNIFIED_INVENTORY_CATEGORY_LABELS: Record<UnifiedInventoryCategory, string> = {
  equipment: "Equipment",
  adventuringGear: "Adventuring gear",
  ritual: "Rituals (book)",
  ritualScroll: "Ritual scrolls",
  alchemy: "Alchemy",
  martialPractice: "Martial practices",
  martialPracticeScroll: "Practice scrolls"
};

const CATEGORY_SORT: Record<UnifiedInventoryCategory, number> = {
  equipment: 0,
  adventuringGear: 1,
  ritual: 2,
  ritualScroll: 3,
  alchemy: 4,
  martialPractice: 5,
  martialPracticeScroll: 6
};

export interface UnifiedConsumableRow {
  kind: "consumable";
  category: Exclude<UnifiedInventoryCategory, "equipment">;
  consumableKey: ConsumableListKey | "ritualScrolls" | "martialPracticeScrolls";
  sourceId: string;
  name: string;
  quantity: number;
  detail?: string;
}

export interface UnifiedEquipmentRow {
  kind: "equipment";
  category: "equipment";
  equipment: CharacterBuildItemRow;
}

export type UnifiedInventoryRow = UnifiedEquipmentRow | UnifiedConsumableRow;

export function unifiedInventoryRows(build: CharacterBuild, index: RulesIndex): UnifiedInventoryRow[] {
  const rows: UnifiedInventoryRow[] = [];

  for (const equipment of characterBuildInventoryItems(build, index)) {
    rows.push({ kind: "equipment", category: "equipment", equipment });
  }

  const gearById = new Map(adventuringGearFromIndex(index).map((g) => [g.id, g]));
  for (const entry of consumableEntries(build, "gear")) {
    const gear = gearById.get(entry.id);
    rows.push({
      kind: "consumable",
      category: "adventuringGear",
      consumableKey: "gear",
      sourceId: entry.id,
      name: gear?.name ?? entry.id,
      quantity: entry.quantity,
      detail: gear?.category ?? undefined
    });
  }

  const ritualsById = new Map(ritualsFromIndex(index).map((r) => [r.id, r]));
  for (const entry of consumableEntries(build, "rituals")) {
    const ritual = ritualsById.get(entry.id);
    rows.push({
      kind: "consumable",
      category: "ritual",
      consumableKey: "rituals",
      sourceId: entry.id,
      name: ritual?.name ?? entry.id,
      quantity: entry.quantity,
      detail: ritual?.level != null ? `Level ${ritual.level}` : undefined
    });
  }

  for (const entry of ritualScrollEntries(build)) {
    const ritual = ritualsById.get(entry.id);
    rows.push({
      kind: "consumable",
      category: "ritualScroll",
      consumableKey: "ritualScrolls",
      sourceId: entry.id,
      name: ritual?.name ?? entry.id,
      quantity: entry.quantity,
      detail: ritual?.level != null ? `Level ${ritual.level}` : undefined
    });
  }

  const alchemyById = new Map(alchemyItemsFromIndex(index).map((a) => [a.id, a]));
  for (const entry of consumableEntries(build, "alchemy")) {
    const item = alchemyById.get(entry.id);
    rows.push({
      kind: "consumable",
      category: "alchemy",
      consumableKey: "alchemy",
      sourceId: entry.id,
      name: item?.name ?? entry.id,
      quantity: entry.quantity,
      detail: item?.level != null ? `Level ${item.level}` : undefined
    });
  }

  const practicesById = new Map(martialPracticesFromIndex(index).map((p) => [p.id, p]));
  for (const entry of consumableEntries(build, "martialPractices")) {
    const practice = practicesById.get(entry.id);
    const displayName = practice?.name.replace(/\s+Martial Practice$/i, "") ?? entry.id;
    rows.push({
      kind: "consumable",
      category: "martialPractice",
      consumableKey: "martialPractices",
      sourceId: entry.id,
      name: displayName,
      quantity: entry.quantity,
      detail: practice?.level != null ? `Level ${practice.level}` : undefined
    });
  }

  for (const entry of martialPracticeScrollEntries(build)) {
    const practice = practicesById.get(entry.id);
    const displayName = practice?.name.replace(/\s+Martial Practice$/i, "") ?? entry.id;
    rows.push({
      kind: "consumable",
      category: "martialPracticeScroll",
      consumableKey: "martialPracticeScrolls",
      sourceId: entry.id,
      name: displayName,
      quantity: entry.quantity,
      detail: practice?.level != null ? `Level ${practice.level}` : undefined
    });
  }

  return rows.sort(compareUnifiedRows);
}

export function filterUnifiedInventoryRows(
  rows: UnifiedInventoryRow[],
  filter: UnifiedInventoryFilter
): UnifiedInventoryRow[] {
  if (filter === "all") return rows;
  return rows.filter((row) => row.category === filter);
}

export function setUnifiedConsumableQuantity(
  build: CharacterBuild,
  row: UnifiedConsumableRow,
  quantity: number
): CharacterBuild {
  if (row.consumableKey === "ritualScrolls") {
    const entries = setConsumableQuantity(ritualScrollEntries(build), row.sourceId, quantity);
    return setRitualScrollEntries(build, entries);
  }
  if (row.consumableKey === "martialPracticeScrolls") {
    const entries = setConsumableQuantity(martialPracticeScrollEntries(build), row.sourceId, quantity);
    return setMartialPracticeScrollEntries(build, entries);
  }
  const entries = setConsumableQuantity(consumableEntries(build, row.consumableKey), row.sourceId, quantity);
  return setConsumableEntries(build, row.consumableKey, entries);
}

function compareUnifiedRows(a: UnifiedInventoryRow, b: UnifiedInventoryRow): number {
  const byCat = CATEGORY_SORT[a.category] - CATEGORY_SORT[b.category];
  if (byCat !== 0) return byCat;
  const nameA = a.kind === "equipment" ? a.equipment.name : a.name;
  const nameB = b.kind === "equipment" ? b.equipment.name : b.name;
  return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
}

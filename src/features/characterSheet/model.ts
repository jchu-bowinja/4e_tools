import type { Ability } from "../../rules/models";

export type AbilityScores = Record<Ability, number>;

export type EquipmentSlot = "armor" | "shield" | "mainHand" | "offHand" | "implement";
export type InventoryItemKind = "armor" | "weapon" | "implement" | "gear";

export interface InventoryItem {
  id: string;
  name: string;
  kind: InventoryItemKind;
  quantity: number;
  sourceId?: string;
  slotHints: EquipmentSlot[];
  notes?: string;
}

export interface CharacterSheetResources {
  currentHp: number;
  tempHp: number;
  surgesRemaining: number;
  deathSaves: number;
  conditions: string[];
}

export interface CharacterSheetPowerSelection {
  selectedPowerIds: string[];
  expendedPowerIds: string[];
  manualOrderIds: string[];
}

export interface CharacterSheetState {
  name: string;
  level: number;
  raceId?: string;
  classId?: string;
  themeId?: string;
  paragonPathId?: string;
  epicDestinyId?: string;
  abilityScores: AbilityScores;
  trainedSkillIds: string[];
  featIds?: string[];
  resources: CharacterSheetResources;
  inventory: InventoryItem[];
  equipment: Partial<Record<EquipmentSlot, string>>;
  powers: CharacterSheetPowerSelection;
}

import { migrateLegacyEquipment, normalizeCharacterEquipment } from "../../rules/equipment";
import { normalizeMagicItemSlotIds } from "../../rules/magicItemEquipment";
import { normalizeActiveConditions } from "./activeConditions";
import { createDefaultCharacterSheetState } from "./defaultState";
import type { CharacterEquipment } from "../../rules/models";
import type { CharacterSheetState } from "./model";
import { normalizePowerGroupBy } from "./powerDisplay";

const CHARACTER_SHEET_STORAGE_KEY = "dnd4e_character_sheet_v1";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, Number.isNaN(n) ? fallback : n));
}

function characterEquipmentFromStored(v: Record<string, unknown>): CharacterEquipment | undefined {
  if (v.characterEquipment !== undefined && v.characterEquipment !== null) {
    return normalizeCharacterEquipment(v.characterEquipment as CharacterEquipment);
  }
  const magicItemIds = normalizeMagicItemSlotIds(v.magicItemIds);
  if (!magicItemIds) return undefined;
  return migrateLegacyEquipment({
    name: "",
    level: 1,
    abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
    trainedSkillIds: [],
    featIds: [],
    powerIds: [],
    magicItemIds
  });
}

export function normalizeState(input: unknown): CharacterSheetState {
  const fallback = createDefaultCharacterSheetState();
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const v = input as Partial<CharacterSheetState>;
  const next: CharacterSheetState = {
    ...fallback,
    ...v,
    abilityScores: {
      STR: clampInt(v.abilityScores?.STR, 1, 30, fallback.abilityScores.STR),
      CON: clampInt(v.abilityScores?.CON, 1, 30, fallback.abilityScores.CON),
      DEX: clampInt(v.abilityScores?.DEX, 1, 30, fallback.abilityScores.DEX),
      INT: clampInt(v.abilityScores?.INT, 1, 30, fallback.abilityScores.INT),
      WIS: clampInt(v.abilityScores?.WIS, 1, 30, fallback.abilityScores.WIS),
      CHA: clampInt(v.abilityScores?.CHA, 1, 30, fallback.abilityScores.CHA)
    },
    resources: {
      currentHp: clampInt(v.resources?.currentHp, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, fallback.resources.currentHp),
      tempHp: clampInt(v.resources?.tempHp, 0, 999, fallback.resources.tempHp),
      actionPoints: clampInt(v.resources?.actionPoints, 0, 9, fallback.resources.actionPoints),
      surgesRemaining: clampInt(v.resources?.surgesRemaining, 0, 99, fallback.resources.surgesRemaining),
      secondWindUsed:
        typeof v.resources?.secondWindUsed === "boolean"
          ? v.resources.secondWindUsed
          : fallback.resources.secondWindUsed ?? false,
      deathSaves: clampInt(v.resources?.deathSaves, 0, 3, fallback.resources.deathSaves),
      conditions: normalizeActiveConditions(v.resources?.conditions ?? fallback.resources.conditions)
    },
    inventory: Array.isArray(v.inventory) ? v.inventory : [],
    equipment: typeof v.equipment === "object" && v.equipment ? v.equipment : {},
    powers: {
      selectedPowerIds: Array.isArray(v.powers?.selectedPowerIds) ? v.powers.selectedPowerIds : [],
      expendedPowerIds: Array.isArray(v.powers?.expendedPowerIds) ? v.powers.expendedPowerIds : [],
      manualOrderIds: Array.isArray(v.powers?.manualOrderIds) ? v.powers.manualOrderIds : [],
      groupBy: normalizePowerGroupBy(v.powers?.groupBy ?? fallback.powers.groupBy)
    },
    featIds: Array.isArray(v.featIds) ? v.featIds.filter((id): id is string => typeof id === "string") : [],
    trainedSkillIds: Array.isArray(v.trainedSkillIds) ? v.trainedSkillIds.filter((id): id is string => typeof id === "string") : [],
    level: clampInt(v.level, 1, 30, fallback.level),
    gold: clampInt(v.gold, 0, 99_999_999, fallback.gold ?? 0),
    characterEquipment: characterEquipmentFromStored(v as Record<string, unknown>),
    themeId: typeof v.themeId === "string" && v.themeId.trim() ? v.themeId : undefined,
    paragonPathId: typeof v.paragonPathId === "string" && v.paragonPathId.trim() ? v.paragonPathId : undefined,
    epicDestinyId: typeof v.epicDestinyId === "string" && v.epicDestinyId.trim() ? v.epicDestinyId : undefined
  };
  return next;
}

export function loadCharacterSheetState(): CharacterSheetState {
  const raw = localStorage.getItem(CHARACTER_SHEET_STORAGE_KEY);
  if (!raw) {
    return createDefaultCharacterSheetState();
  }
  try {
    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultCharacterSheetState();
  }
}

export function saveCharacterSheetState(state: CharacterSheetState): void {
  localStorage.setItem(CHARACTER_SHEET_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

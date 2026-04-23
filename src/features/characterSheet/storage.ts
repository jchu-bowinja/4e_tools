import { createDefaultCharacterSheetState } from "./defaultState";
import type { CharacterSheetState } from "./model";

const CHARACTER_SHEET_STORAGE_KEY = "dnd4e_character_sheet_v1";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, Number.isNaN(n) ? fallback : n));
}

function normalizeState(input: unknown): CharacterSheetState {
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
      surgesRemaining: clampInt(v.resources?.surgesRemaining, 0, 99, fallback.resources.surgesRemaining),
      deathSaves: clampInt(v.resources?.deathSaves, 0, 3, fallback.resources.deathSaves),
      conditions: Array.isArray(v.resources?.conditions)
        ? v.resources.conditions.filter((name): name is string => typeof name === "string" && name.trim().length > 0).map((name) => name.trim())
        : fallback.resources.conditions
    },
    inventory: Array.isArray(v.inventory) ? v.inventory : [],
    equipment: typeof v.equipment === "object" && v.equipment ? v.equipment : {},
    powers: {
      selectedPowerIds: Array.isArray(v.powers?.selectedPowerIds) ? v.powers.selectedPowerIds : [],
      expendedPowerIds: Array.isArray(v.powers?.expendedPowerIds) ? v.powers.expendedPowerIds : []
    },
    featIds: Array.isArray(v.featIds) ? v.featIds.filter((id): id is string => typeof id === "string") : [],
    trainedSkillIds: Array.isArray(v.trainedSkillIds) ? v.trainedSkillIds.filter((id): id is string => typeof id === "string") : [],
    level: clampInt(v.level, 1, 30, fallback.level)
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

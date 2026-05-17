import { buildDurationFromPreset } from "./conditionDurationPresets";
import { createActiveCondition } from "./activeConditions";
import type { ActiveCondition, CharacterSheetResources } from "./model";

/** Condition label applied when Second Wind is used (+2 to all defenses until start of next turn). */
export const SECOND_WIND_CONDITION = "Second Wind (+2 defenses)";

export const SECOND_WIND_DEFENSE_BONUS = 2;

const SECOND_WIND_DURATION = buildDurationFromPreset("start_your_next");

export function hasSecondWindDefenseBonus(conditions: ActiveCondition[]): boolean {
  return conditions.some((c) => c.name === SECOND_WIND_CONDITION);
}

export function canUseSecondWind(resources: CharacterSheetResources): boolean {
  return !resources.secondWindUsed && resources.surgesRemaining > 0;
}

export function spendHealingSurgeResources(
  resources: CharacterSheetResources,
  params: { perSurge: number; capHp: number; capSurges: number }
): CharacterSheetResources {
  if (resources.surgesRemaining === 0) return resources;
  return {
    ...resources,
    currentHp: Math.min(resources.currentHp + Math.max(0, params.perSurge), params.capHp),
    surgesRemaining: Math.max(0, Math.min(resources.surgesRemaining - 1, params.capSurges))
  };
}

export function useSecondWindResources(
  resources: CharacterSheetResources,
  params: { perSurge: number; capHp: number; capSurges: number }
): CharacterSheetResources {
  if (!canUseSecondWind(resources)) return resources;
  const afterSurge = spendHealingSurgeResources(resources, params);
  const conditions = hasSecondWindDefenseBonus(afterSurge.conditions)
    ? afterSurge.conditions
    : [...afterSurge.conditions, createActiveCondition(SECOND_WIND_CONDITION, SECOND_WIND_DURATION)];
  return {
    ...afterSurge,
    secondWindUsed: true,
    conditions
  };
}

/** Resets once-per-encounter Second Wind after a short or long rest. */
export function refreshSecondWindOnRest(resources: CharacterSheetResources): CharacterSheetResources {
  return {
    ...resources,
    secondWindUsed: false,
    conditions: resources.conditions.filter((c) => c.name !== SECOND_WIND_CONDITION)
  };
}

import type { CharacterSheetResources } from "./model";

export function powerPointsSpent(resources: CharacterSheetResources): number {
  return Math.max(0, Math.trunc(resources.powerPointsSpent ?? 0));
}

export function powerPointsRemaining(poolTotal: number, resources: CharacterSheetResources): number {
  const pool = Math.max(0, Math.trunc(poolTotal));
  return Math.max(0, pool - powerPointsSpent(resources));
}

export function adjustPowerPointsSpent(
  resources: CharacterSheetResources,
  delta: number,
  poolTotal: number
): CharacterSheetResources {
  const pool = Math.max(0, Math.trunc(poolTotal));
  const next = powerPointsSpent(resources) + Math.trunc(delta);
  return {
    ...resources,
    powerPointsSpent: Math.max(0, Math.min(pool, next))
  };
}

export function refreshPowerPointsOnExtendedRest(
  resources: CharacterSheetResources
): CharacterSheetResources {
  return { ...resources, powerPointsSpent: 0 };
}

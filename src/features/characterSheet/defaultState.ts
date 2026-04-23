import type { CharacterSheetState } from "./model";

export function createDefaultCharacterSheetState(): CharacterSheetState {
  return {
    name: "New Character",
    level: 1,
    abilityScores: {
      STR: 10,
      CON: 10,
      DEX: 10,
      INT: 10,
      WIS: 10,
      CHA: 10
    },
    trainedSkillIds: [],
    featIds: [],
    resources: {
      currentHp: 1,
      tempHp: 0,
      surgesRemaining: 1,
      deathSaves: 0,
      conditions: []
    },
    inventory: [],
    equipment: {},
    powers: {
      selectedPowerIds: [],
      expendedPowerIds: []
    }
  };
}

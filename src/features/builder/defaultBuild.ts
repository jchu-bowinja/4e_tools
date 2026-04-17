import { CharacterBuild } from "../../rules/models";

export const defaultBuild: CharacterBuild = {
  name: "New Hero",
  level: 1,
  pointBuyBudget: 22,
  abilityScores: {
    STR: 8,
    CON: 10,
    DEX: 10,
    INT: 10,
    WIS: 10,
    CHA: 10
  },
  racialAbilityChoice: undefined,
  armorId: undefined,
  shieldId: undefined,
  trainedSkillIds: [],
  featIds: [],
  powerIds: []
};


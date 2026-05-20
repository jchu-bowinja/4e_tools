import { describe, expect, it } from "vitest";
import {
  collectActiveRacialTraitIds,
  collectActiveRacialTraitIdsFromBuild
} from "../../src/rules/activeRacialTraits";
import {
  expandRacialTraitIdsWithGrantedChildren,
  grantedRacialTraitIdsFromTrait
} from "../../src/rules/racialTraitGrants";
import { aggregateSupportPassiveOtherBonuses } from "../../src/rules/supportStatAdds";
import type { CharacterBuild, Race, RacialTrait, RulesIndex } from "../../src/rules/models";

const insightBonus: RacialTrait = {
  id: "ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS",
  name: "Insight Bonus",
  slug: "insight-bonus",
  raw: {
    rules: { statadd: [{ attrs: { name: "Insight Misc", value: "+2", type: "Racial" } }] }
  }
};

const streetwiseBonus: RacialTrait = {
  id: "ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS",
  name: "Streetwise Bonus",
  slug: "streetwise-bonus",
  raw: {
    rules: { statadd: [{ attrs: { name: "Streetwise Misc", value: "+2", type: "Racial" } }] }
  }
};

const arcanaBonus: RacialTrait = {
  id: "ID_INTERNAL_RACIAL_TRAIT_ARCANA_BONUS",
  name: "Arcana Bonus",
  slug: "arcana-bonus",
  raw: {
    rules: { statadd: [{ attrs: { name: "Arcana Misc", value: "+2", type: "Racial" } }] }
  }
};

const historyBonus: RacialTrait = {
  id: "ID_INTERNAL_RACIAL_TRAIT_HISTORY_BONUS",
  name: "History Bonus",
  slug: "history-bonus",
  raw: {
    rules: { statadd: [{ attrs: { name: "History Misc", value: "+2", type: "Racial" } }] }
  }
};

const moonElfSkillBonuses: RacialTrait = {
  id: "TR_MOON_SKILL",
  name: "Moon Elf Skill Bonuses",
  slug: "moon-elf-skill-bonuses",
  raw: {
    rules: {
      grant: [
        { attrs: { name: "ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS", type: "Racial Trait" } },
        { attrs: { name: "ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS", type: "Racial Trait" } }
      ]
    }
  }
};

const eladrinSkillBonuses: RacialTrait = {
  id: "TR_ELF_SKILL",
  name: "Eladrin Skill Bonuses",
  slug: "eladrin-skill-bonuses",
  raw: {
    rules: {
      grant: [
        { attrs: { name: "ID_INTERNAL_RACIAL_TRAIT_ARCANA_BONUS", type: "Racial Trait" } },
        { attrs: { name: "ID_INTERNAL_RACIAL_TRAIT_HISTORY_BONUS", type: "Racial Trait" } }
      ]
    }
  }
};

describe("grantedRacialTraitIdsFromTrait", () => {
  it("reads Racial Trait grants from rules.grant", () => {
    expect(grantedRacialTraitIdsFromTrait(moonElfSkillBonuses)).toEqual([
      "ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS",
      "ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS"
    ]);
  });
});

describe("expandRacialTraitIdsWithGrantedChildren", () => {
  it("appends one grant level from seed ids", () => {
    const byId = new Map([
      ["TR_MOON_SKILL", moonElfSkillBonuses],
      ["ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS", insightBonus],
      ["ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS", streetwiseBonus]
    ]);
    expect(expandRacialTraitIdsWithGrantedChildren(["TR_MOON_SKILL"], byId)).toEqual([
      "TR_MOON_SKILL",
      "ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS",
      "ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS"
    ]);
  });
});

describe("Eladrin moon vs standard subrace skill bonuses", () => {
  const skills = [
    { id: "SK_INS", name: "Insight", slug: "insight", keyAbility: "Wisdom", raw: {} },
    { id: "SK_STW", name: "Streetwise", slug: "streetwise", keyAbility: "Charisma", raw: {} },
    { id: "SK_ARC", name: "Arcana", slug: "arcana", keyAbility: "Intelligence", raw: {} },
    { id: "SK_HIST", name: "History", slug: "history", keyAbility: "Intelligence", raw: {} }
  ];

  const subParent: RacialTrait = {
    id: "TR_ELF_SUB",
    name: "Eladrin Subrace",
    slug: "eladrin-subrace",
    raw: { specific: { _PARSED_SUB_FEATURES: "TR_MOON,TR_STD" } }
  };

  const moonElf: RacialTrait = {
    id: "TR_MOON",
    name: "Moon Elf (Eladrin)",
    slug: "moon-elf",
    raw: { specific: { _PARSED_CHILD_FEATURES: "TR_MOON_SKILL" } }
  };

  const standardElf: RacialTrait = {
    id: "TR_STD",
    name: "Standard Eladrin Racial Traits",
    slug: "standard-eladrin",
    raw: { specific: { _PARSED_CHILD_FEATURES: "TR_ELF_SKILL" } }
  };

  const race: Race = {
    id: "R_ELF",
    name: "Eladrin",
    slug: "eladrin",
    raw: { specific: { "Racial Traits": "TR_ELF_SUB" } }
  };

  const byId = new Map([
    ["TR_ELF_SUB", subParent],
    ["TR_MOON", moonElf],
    ["TR_STD", standardElf],
    ["TR_MOON_SKILL", moonElfSkillBonuses],
    ["TR_ELF_SKILL", eladrinSkillBonuses],
    ["ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS", insightBonus],
    ["ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS", streetwiseBonus],
    ["ID_INTERNAL_RACIAL_TRAIT_ARCANA_BONUS", arcanaBonus],
    ["ID_INTERNAL_RACIAL_TRAIT_HISTORY_BONUS", historyBonus]
  ]);

  it("moon elf subrace activates granted insight and streetwise bonuses, not arcana/history", () => {
    const ids = collectActiveRacialTraitIds(race, byId, { subrace: "TR_MOON" });
    expect(ids).toContain("TR_MOON_SKILL");
    expect(ids).toContain("ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS");
    expect(ids).toContain("ID_INTERNAL_RACIAL_TRAIT_STREETWISE_BONUS");
    expect(ids).not.toContain("ID_INTERNAL_RACIAL_TRAIT_ARCANA_BONUS");
    expect(ids).not.toContain("ID_INTERNAL_RACIAL_TRAIT_HISTORY_BONUS");
  });

  it("standard subrace activates arcana and history grant targets", () => {
    const ids = collectActiveRacialTraitIds(race, byId, { subrace: "TR_STD" });
    expect(ids).toContain("TR_ELF_SKILL");
    expect(ids).toContain("ID_INTERNAL_RACIAL_TRAIT_ARCANA_BONUS");
    expect(ids).toContain("ID_INTERNAL_RACIAL_TRAIT_HISTORY_BONUS");
    expect(ids).not.toContain("ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS");
  });

  it("applies +2 skill misc via statadd on granted traits", () => {
    const index: RulesIndex = {
      races: [race],
      racialTraits: [...byId.values()],
      skills,
      feats: [],
      themes: [],
      paragonPaths: [],
      epicDestinies: [],
      classes: []
    };
    const build: CharacterBuild = {
      name: "Moon",
      level: 1,
      raceId: "R_ELF",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: [],
      raceSelections: { subrace: "TR_MOON" }
    };
    const other = aggregateSupportPassiveOtherBonuses(index, build);
    expect(other.skillFlatBySkillId.SK_INS).toBe(2);
    expect(other.skillFlatBySkillId.SK_STW).toBe(2);
    expect(other.skillFlatBySkillId.SK_ARC).toBeUndefined();
    expect(collectActiveRacialTraitIdsFromBuild(index, build)).toContain(
      "ID_INTERNAL_RACIAL_TRAIT_INSIGHT_BONUS"
    );
  });
});

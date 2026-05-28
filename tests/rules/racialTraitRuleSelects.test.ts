import { describe, expect, it } from "vitest";
import type { Race, RacialTrait, RulesIndex } from "../../src/rules/models";
import {
  countsAsRaceOptions,
  getRacialTraitRuleSelectSlots,
  raceTraitSelectRequiresMatches,
  resolveRacialFeatSlotCountForBuild,
  resolveRacialSkillTrainingSlotCountForBuild
} from "../../src/rules/racialTraitRuleSelects";
import { findPastSpiritTraitForCountsAsRace, getRaceExtraTraitIds } from "../../src/rules/raceSubraces";

describe("raceTraitSelectRequiresMatches", () => {
  it("matches positive requires to class name", () => {
    expect(raceTraitSelectRequiresMatches("Binder", "Binder")).toBe(true);
    expect(raceTraitSelectRequiresMatches("Binder", "Fighter")).toBe(false);
  });

  it("matches negated requires list", () => {
    expect(raceTraitSelectRequiresMatches("!Binder|Blackguard", "Fighter")).toBe(true);
    expect(raceTraitSelectRequiresMatches("!Binder|Blackguard", "Binder")).toBe(false);
  });
});

describe("getRacialTraitRuleSelectSlots", () => {
  it("includes skill training on Eladrin Education", () => {
    const race: Race = {
      id: "R_ELF",
      name: "Eladrin",
      slug: "eladrin",
      raw: { specific: { "Racial Traits": "TR_EDU" } }
    };
    const edu: RacialTrait = {
      id: "TR_EDU",
      name: "Eladrin Education",
      slug: "eladrin-education",
      raw: { rules: { select: [{ attrs: { type: "Skill Training", number: "1" } }] } }
    };
    const byId = new Map([["TR_EDU", edu]]);
    const slots = getRacialTraitRuleSelectSlots(race, byId, {}, undefined, []);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.kind).toBe("skillTraining");
    expect(slots[0]?.key).toBe("skillTraining:TR_EDU:0");
  });

  it("hides Bonus Skill until class matches requires", () => {
    const race: Race = {
      id: "R_H",
      name: "Human",
      slug: "human",
      raw: { specific: { "Racial Traits": "TR_SKILL" } }
    };
    const trait: RacialTrait = {
      id: "TR_SKILL",
      name: "Bonus Skill",
      slug: "bonus-skill",
      raw: {
        rules: {
          select: [
            {
              attrs: {
                type: "Skill Training",
                number: "1",
                Category: "$$CLASS",
                requires: "!Binder|Blackguard"
              }
            },
            { attrs: { type: "Skill Training", number: "1", Category: "ID_C", requires: "Binder" } }
          ]
        }
      }
    };
    const byId = new Map([["TR_SKILL", trait]]);
    expect(getRacialTraitRuleSelectSlots(race, byId, {}, undefined, [])).toHaveLength(0);
    const fighter = { id: "ID_F", name: "Fighter", slug: "fighter", raw: {} };
    expect(getRacialTraitRuleSelectSlots(race, byId, {}, fighter, [])).toHaveLength(1);
    const binder = { id: "ID_B", name: "Binder", slug: "binder", raw: {} };
    expect(getRacialTraitRuleSelectSlots(race, byId, {}, binder, [])).toHaveLength(1);
    expect(getRacialTraitRuleSelectSlots(race, byId, {}, binder, [])[0]?.key).toBe(
      "skillTraining:TR_SKILL:0"
    );
  });
});

describe("resolveRacialSlotCountsForBuild", () => {
  it("counts feat and skillTraining slots for Human with Fighter", () => {
    const race: Race = {
      id: "R_H",
      name: "Human",
      slug: "human",
      raw: { specific: { "Racial Traits": "TR_SKILL,TR_FEAT" } }
    };
    const bonusSkill: RacialTrait = {
      id: "TR_SKILL",
      name: "Bonus Skill",
      slug: "bonus-skill",
      raw: {
        rules: {
          select: [
            {
              attrs: {
                type: "Skill Training",
                number: "1",
                Category: "$$CLASS",
                requires: "!Binder|Blackguard"
              }
            }
          ]
        }
      }
    };
    const bonusFeat: RacialTrait = {
      id: "TR_FEAT",
      name: "Bonus Feat",
      slug: "bonus-feat",
      raw: { rules: { select: [{ attrs: { type: "Feat", number: "1" } }] } }
    };
    const byId = new Map([
      ["TR_SKILL", bonusSkill],
      ["TR_FEAT", bonusFeat]
    ]);
    const fighter = { id: "ID_F", name: "Fighter", slug: "fighter", raw: {} };
    const index = { races: [race], classes: [fighter], racialTraits: [bonusSkill, bonusFeat] };
    const build = { raceId: "R_H", classId: "ID_F", trainedSkillIds: [], featIds: [] };
    expect(resolveRacialFeatSlotCountForBuild(index, build)).toBe(1);
    expect(resolveRacialSkillTrainingSlotCountForBuild(index, build)).toBe(1);
  });
});

describe("countsAsRace and past spirit", () => {
  it("adds past spirit trait id after past life pick", () => {
    const races: Race[] = [
      { id: "R_REV", name: "Revenant", slug: "revenant", raw: {} },
      { id: "R_DB", name: "Dragonborn", slug: "dragonborn", raw: {} }
    ];
    const pastLife: RacialTrait = {
      id: "TR_PL",
      name: "Past life",
      slug: "past-life",
      raw: { rules: { select: [{ attrs: { type: "CountsAsRace", number: "1" } }] } }
    };
    const pastSpirit: RacialTrait = {
      id: "TR_PS",
      name: "Past Spirit (Dragonborn)",
      slug: "past-spirit-dragonborn",
      raw: {}
    };
    const race: Race = {
      id: "R_REV",
      name: "Revenant",
      slug: "revenant",
      raw: { specific: { "Racial Traits": "TR_PL" } }
    };
    const byId = new Map([
      ["TR_PL", pastLife],
      ["TR_PS", pastSpirit]
    ]);
    expect(findPastSpiritTraitForCountsAsRace("R_DB", byId, races)?.id).toBe("TR_PS");
    const extra = getRaceExtraTraitIds(race, byId, { "countsAsRace:TR_PL": "R_DB" }, races);
    expect(extra).toContain("TR_PS");
  });

  it("excludes revenant from countsAsRace options", () => {
    const index = {
      races: [
        { id: "R_REV", name: "Revenant", slug: "revenant", raw: {} },
        { id: "R_H", name: "Human", slug: "human", raw: {} }
      ]
    } as RulesIndex;
    const opts = countsAsRaceOptions(index, "R_REV");
    expect(opts.map((r) => r.name)).not.toContain("Revenant");
    expect(opts.map((r) => r.name)).toContain("Human");
  });
});

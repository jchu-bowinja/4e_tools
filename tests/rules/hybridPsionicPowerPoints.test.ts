import { describe, expect, it } from "vitest";
import { isAugmentableAtWillPower } from "../../src/rules/featMulticlassSlotSwap";
import {
  basePsionicPowerPointsForBuild,
  collectHybridAugmentableAtWillPowers,
  hybridHasPsionicComponent,
  hybridPsionicPowerPointsFromAugmentableAtWills,
  summarizePsionicPowerPointAdjustments
} from "../../src/rules/psionicPowerPoints";
import type { CharacterBuild, HybridClassDef, Power, RulesIndex } from "../../src/rules/models";

const augmentableAtWill: Power = {
  id: "aw_psion",
  name: "Mind Thrust",
  slug: "mind-thrust",
  usage: "At-Will",
  level: 1,
  classId: "c_psion",
  raw: { specific: { Keywords: "Augmentable, Psionic", "Power Usage": "At-Will" } }
};

const hybridPsion: HybridClassDef = {
  id: "h_psion",
  name: "Hybrid Psion",
  slug: "hybrid-psion",
  baseClassId: "c_psion",
  powerSource: "Psionic",
  raw: {}
};

const hybridFighter: HybridClassDef = {
  id: "h_fighter",
  name: "Hybrid Fighter",
  slug: "hybrid-fighter",
  baseClassId: "c_fighter",
  powerSource: "Martial",
  raw: {}
};

const index: RulesIndex = {
  classes: [
    { id: "c_psion", name: "Psion", slug: "psion", powerSource: "Psionic", raw: {} },
    { id: "c_fighter", name: "Fighter", slug: "fighter", powerSource: "Martial", raw: {} }
  ],
  hybridClasses: [hybridPsion, hybridFighter],
  feats: [],
  powers: [augmentableAtWill],
  skills: [],
  races: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: [],
  backgrounds: [],
  rituals: [],
  items: []
};

describe("hybridPsionicPowerPoints", () => {
  it("detects psionic hybrid component", () => {
    const build: CharacterBuild = {
      level: 7,
      characterStyle: "hybrid",
      hybridClassIdA: "h_psion",
      hybridClassIdB: "h_fighter",
      featIds: [],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(hybridHasPsionicComponent(index, build)).toBe(true);
    expect(isAugmentableAtWillPower(augmentableAtWill)).toBe(true);
  });

  it("computes pool from augmentable at-wills in hybrid slots", () => {
    const build: CharacterBuild = {
      level: 7,
      characterStyle: "hybrid",
      hybridClassIdA: "h_psion",
      hybridClassIdB: "h_fighter",
      classPowerSlots: { "hybrid:awA:0": "aw_psion", "hybrid:awB:0": "aw_psion" },
      featIds: [],
      powerIds: ["aw_psion"],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(collectHybridAugmentableAtWillPowers(index, build)).toHaveLength(1);
    expect(hybridPsionicPowerPointsFromAugmentableAtWills([augmentableAtWill], 7)).toBe(6);
    expect(basePsionicPowerPointsForBuild(index, build)).toBe(6);
    const summary = summarizePsionicPowerPointAdjustments(index, build);
    expect(summary.baseFromClass).toBe(6);
    expect(summary.poolTotal).toBe(6);
  });

  it("returns 0 when no augmentable at-wills are slotted", () => {
    const build: CharacterBuild = {
      level: 7,
      characterStyle: "hybrid",
      hybridClassIdA: "h_psion",
      hybridClassIdB: "h_fighter",
      featIds: [],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    expect(basePsionicPowerPointsForBuild(index, build)).toBe(0);
  });
});

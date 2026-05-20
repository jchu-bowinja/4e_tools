import { describe, expect, it } from "vitest";
import {
  hybridPsionicAugmentationBreakpointsForLevel,
  hybridPsionicBreakpointPowerPointGain,
  hybridPsionicEncounterAugmentationBreakpoints,
  hybridPsionicPowerPointsFromAugmentableAtWills,
  normalizeHybridPsionicAugmentationChoices,
  pruneHybridPsionicAugmentationChoices
} from "../../src/rules/hybridPsionicAugmentation";
import type { CharacterBuild, Power } from "../../src/rules/models";

const augmentableAtWill: Power = {
  id: "aw",
  name: "Mind Thrust",
  slug: "mind-thrust",
  usage: "At-Will",
  level: 1,
  classId: "c_psion",
  raw: { specific: { Keywords: "Augmentable", "Power Usage": "At-Will" } }
};

describe("hybridPsionicAugmentation", () => {
  it("lists choice breakpoints from level 7", () => {
    expect(hybridPsionicAugmentationBreakpointsForLevel(6)).toEqual([]);
    expect(hybridPsionicAugmentationBreakpointsForLevel(7)).toEqual([7]);
    expect(hybridPsionicAugmentationBreakpointsForLevel(17)).toEqual([7, 13, 17]);
  });

  it("defaults missing choices to power points", () => {
    expect(normalizeHybridPsionicAugmentationChoices(11, undefined)).toEqual({
      7: "powerPoints"
    });
  });

  it("reduces pool when encounter is chosen at 7", () => {
    const allPp = hybridPsionicPowerPointsFromAugmentableAtWills([augmentableAtWill], 7);
    const withEncounter = hybridPsionicPowerPointsFromAugmentableAtWills([augmentableAtWill], 7, {
      7: "encounter"
    });
    expect(allPp).toBe(6);
    expect(withEncounter).toBe(4);
    expect(hybridPsionicBreakpointPowerPointGain(7, 1)).toBe(2);
  });

  it("does not apply a level 21 hybrid bonus", () => {
    const at20 = hybridPsionicPowerPointsFromAugmentableAtWills([augmentableAtWill], 20);
    const at21 = hybridPsionicPowerPointsFromAugmentableAtWills([augmentableAtWill], 21);
    expect(at21).toBe(at20);
  });

  it("prunes choices above character level", () => {
    const build: CharacterBuild = {
      level: 10,
      characterStyle: "hybrid",
      hybridPsionicAugmentationChoices: { 7: "encounter", 13: "powerPoints", 17: "encounter" },
      featIds: [],
      powerIds: [],
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: []
    };
    const pruned = pruneHybridPsionicAugmentationChoices(build);
    expect(pruned.hybridPsionicAugmentationChoices).toEqual({ 7: "encounter" });
    expect(hybridPsionicEncounterAugmentationBreakpoints(10, pruned.hybridPsionicAugmentationChoices)).toEqual([
      7
    ]);
  });
});

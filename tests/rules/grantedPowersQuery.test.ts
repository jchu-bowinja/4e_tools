import { describe, expect, it } from "vitest";
import {
  autoGrantedClassPowers,
  collectPowerIdsFromRacialTrait,
  parseFeatAssociatedPowerNames,
  racePowerGroupsForRace,
  resolvePowersByLooseNames
} from "../../src/rules/grantedPowersQuery";
import type { Feat, Race, RacialTrait, RulesIndex } from "../../src/rules/models";

describe("collectPowerIdsFromRacialTrait", () => {
  it("reads specific.Powers and rules.grant", () => {
    const trait: RacialTrait = {
      id: "T1",
      name: "Dragon Breath",
      slug: "dragon-breath",
      raw: {
        specific: { Powers: "ID_FMP_POWER_A,ID_FMP_POWER_B" },
        rules: { grant: [{ attrs: { name: "ID_FMP_POWER_C", type: "Power" } }] }
      }
    };
    expect(collectPowerIdsFromRacialTrait(trait).sort()).toEqual(
      ["ID_FMP_POWER_A", "ID_FMP_POWER_B", "ID_FMP_POWER_C"].sort()
    );
  });
});

describe("racePowerGroupsForRace", () => {
  it("returns granted powers per trait", () => {
    const race: Race = {
      id: "R1",
      name: "Test",
      slug: "test",
      raw: { specific: { "Racial Traits": "TR_A" } }
    };
    const trait: RacialTrait = {
      id: "TR_A",
      name: "Breath",
      slug: "breath",
      raw: { specific: { Powers: "ID_FMP_POWER_X" }, rules: {} }
    };
    const m = new Map<string, RacialTrait>([["TR_A", trait]]);
    const groups = racePowerGroupsForRace(race, m);
    expect(groups).toEqual([{ traitId: "TR_A", traitName: "Breath", choiceOnly: false, powerIds: ["ID_FMP_POWER_X"] }]);
  });
});

describe("parseFeatAssociatedPowerNames / resolvePowersByLooseNames", () => {
  it("parses names and resolves against index", () => {
    const feat = {
      id: "F1",
      name: "Style",
      slug: "style",
      prereqTokens: [],
      raw: { specific: { "Associated Powers": "Sure Strike, Viper's Strike" } }
    } as Feat;
    expect(parseFeatAssociatedPowerNames(feat)).toEqual(["Sure Strike", "Viper's Strike"]);
    const index = {
      powers: [
        { id: "P1", name: "Sure Strike", slug: "sure-strike", raw: {} },
        { id: "P2", name: "Viper's Strike", slug: "vipers-strike", raw: {} }
      ]
    } as unknown as RulesIndex;
    const resolved = resolvePowersByLooseNames(index, parseFeatAssociatedPowerNames(feat));
    expect(resolved.map((p) => p.id)).toEqual(["P1", "P2"]);
  });
});

describe("autoGrantedClassPowers", () => {
  it("maps ids from index.autoGrantedPowerIdsByClassId", () => {
    const index = {
      powers: [{ id: "HW", name: "Healing Word", slug: "hw", raw: {} }],
      autoGrantedPowerIdsByClassId: { ID_FMP_CLASS_2: ["HW"] }
    } as unknown as RulesIndex;
    expect(autoGrantedClassPowers(index, "ID_FMP_CLASS_2").map((p) => p.name)).toEqual(["Healing Word"]);
    expect(autoGrantedClassPowers(index, undefined)).toEqual([]);
  });
});

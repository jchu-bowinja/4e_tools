import { describe, expect, it } from "vitest";
import {
  autoGrantedClassPowers,
  bonusClassAtWillSlotFromRaceBuild,
  collectPowerIdsFromRacialTrait,
  collectSelectablePowerIdsFromRacialTrait,
  HUMAN_POWER_OPTION_RACE_KEY,
  ID_RACIAL_TRAIT_BONUS_AT_WILL,
  ID_RACIAL_TRAIT_HEROIC_EFFORT,
  ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION,
  parseFeatAssociatedPowerNames,
  raceGrantsBonusClassAtWillSlot,
  racePowerGroupsForRace,
  racialTraitGrantsBonusClassAtWillSlot,
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

  it("prefers Power select over granting every option when both appear (Lolthtouched-style)", () => {
    const traitId = "ID_FMP_RACIAL_TRAIT_565";
    const race: Race = {
      id: "R_DROW",
      name: "Drow",
      slug: "drow",
      raw: { specific: { "Racial Traits": traitId } }
    };
    const trait: RacialTrait = {
      id: traitId,
      name: "Lolthtouched",
      slug: "lolthtouched",
      raw: {
        specific: { Powers: "ID_FMP_POWER_A,ID_FMP_POWER_B" },
        rules: { select: [{ attrs: { type: "Power", number: "1", Category: traitId } }] }
      }
    };
    const m = new Map<string, RacialTrait>([[traitId, trait]]);
    const groups = racePowerGroupsForRace(race, m);
    expect(groups).toEqual([
      {
        traitId,
        traitName: "Lolthtouched",
        choiceOnly: true,
        powerIds: ["ID_FMP_POWER_A", "ID_FMP_POWER_B"]
      }
    ]);
    expect(collectSelectablePowerIdsFromRacialTrait(trait).sort()).toEqual(["ID_FMP_POWER_A", "ID_FMP_POWER_B"]);
  });

  it("supports Racial Trait select lists that point to sub-feature traits (Dragonborn power pick)", () => {
    const traitId = "ID_FMP_RACIAL_TRAIT_3162";
    const race: Race = {
      id: "R_DB",
      name: "Dragonborn",
      slug: "dragonborn",
      raw: { specific: { "Racial Traits": traitId } }
    };
    const powerPickTrait: RacialTrait = {
      id: traitId,
      name: "Dragonborn Racial Power",
      slug: "dragonborn-racial-power",
      raw: {
        specific: { _PARSED_SUB_FEATURES: "ID_FMP_RACIAL_TRAIT_6,ID_FMP_RACIAL_TRAIT_2711" },
        rules: { select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Dragonborn Racial Power" } }] }
      }
    };
    const breathTrait: RacialTrait = {
      id: "ID_FMP_RACIAL_TRAIT_6",
      name: "Dragon Breath",
      slug: "dragon-breath",
      raw: { specific: { Powers: "ID_FMP_POWER_1448" }, rules: { grant: [{ attrs: { name: "ID_FMP_POWER_1448", type: "Power" } }] } }
    };
    const fearTrait: RacialTrait = {
      id: "ID_FMP_RACIAL_TRAIT_2711",
      name: "Dragonfear",
      slug: "dragonfear",
      raw: { specific: { Powers: "ID_FMP_POWER_12577" }, rules: { grant: [{ attrs: { name: "ID_FMP_POWER_12577", type: "Power" } }] } }
    };
    const m = new Map<string, RacialTrait>([
      [traitId, powerPickTrait],
      [breathTrait.id, breathTrait],
      [fearTrait.id, fearTrait]
    ]);
    const groups = racePowerGroupsForRace(race, m);
    expect(groups).toEqual([
      {
        traitId,
        traitName: "Dragonborn Racial Power",
        choiceOnly: true,
        powerIds: ["ID_FMP_POWER_1448", "ID_FMP_POWER_12577"]
      }
    ]);
  });

  it("emits a dilettante pick group when Power select uses $$NOT_CLASS,at-will,1", () => {
    const traitId = "ID_FMP_RACIAL_TRAIT_643";
    const race: Race = {
      id: "R_HE",
      name: "Half-Elf",
      slug: "half-elf",
      raw: { specific: { "Racial Traits": traitId } }
    };
    const trait: RacialTrait = {
      id: traitId,
      name: "Dilettante",
      slug: "dilettante",
      raw: {
        rules: {
          select: [{ attrs: { type: "Power", name: "Dilettante", number: "1", Category: "$$NOT_CLASS,at-will,1" } }],
          modify: [{ attrs: { select: "Dilettante", Field: "Power Usage", value: "Encounter" } }]
        }
      }
    };
    const m = new Map<string, RacialTrait>([[traitId, trait]]);
    expect(racePowerGroupsForRace(race, m)).toEqual([
      { traitId, traitName: "Dilettante", choiceOnly: true, dilettantePick: true, powerIds: [] }
    ]);
  });

  it("maps Half-Elf Power Selection to a Dilettante power pick", () => {
    const parentId = "ID_FMP_RACIAL_TRAIT_3482";
    const dilettanteId = "ID_FMP_RACIAL_TRAIT_643";
    const knackId = "ID_FMP_RACIAL_TRAIT_3437";
    const race: Race = {
      id: "R_HE",
      name: "Half-Elf",
      slug: "half-elf",
      raw: { specific: { "Racial Traits": `${parentId},TR_OTHER` } }
    };
    const parent: RacialTrait = {
      id: parentId,
      name: "Half-Elf Power Selection",
      slug: "half-elf-power-selection",
      raw: {
        specific: { _PARSED_SUB_FEATURES: `${dilettanteId}, ${knackId}` },
        rules: { select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Half-Elf Power Selection" } }] }
      }
    };
    const dilettante: RacialTrait = {
      id: dilettanteId,
      name: "Dilettante",
      slug: "dilettante",
      raw: {
        rules: {
          select: [{ attrs: { type: "Power", name: "Dilettante", number: "1", Category: "$$NOT_CLASS,at-will,1" } }]
        }
      }
    };
    const knack: RacialTrait = {
      id: knackId,
      name: "Knack for Success",
      slug: "knack",
      raw: { specific: { Powers: "ID_FMP_POWER_KNACK" }, rules: {} }
    };
    const m = new Map<string, RacialTrait>([
      [parentId, parent],
      [dilettanteId, dilettante],
      [knackId, knack],
      ["TR_OTHER", { id: "TR_OTHER", name: "Group Diplomacy", slug: "gd", raw: {} }]
    ]);
    const groups = racePowerGroupsForRace(race, m);
    expect(groups).toContainEqual({
      traitId: parentId,
      traitName: "Half-Elf Power Selection",
      choiceOnly: true,
      dilettantePick: true,
      powerIds: []
    });
  });
});

describe("bonus class at-will from racial traits", () => {
  const traitBonus = {
    id: ID_RACIAL_TRAIT_BONUS_AT_WILL,
    name: "Bonus At-Will",
    slug: "bonus",
    raw: {
      rules: {
        select: [{ attrs: { type: "Power", name: "Human Bonus At-Will", number: "1", Category: "$$CLASS,at-will,1" } }]
      }
    }
  };

  it("detects Bonus At-Will trait id or $$CLASS,at-will,1", () => {
    expect(racialTraitGrantsBonusClassAtWillSlot(traitBonus as Parameters<typeof racialTraitGrantsBonusClassAtWillSlot>[0])).toBe(
      true
    );
    expect(
      racialTraitGrantsBonusClassAtWillSlot({
        id: "x",
        name: "Other",
        slug: "x",
        raw: {}
      } as Parameters<typeof racialTraitGrantsBonusClassAtWillSlot>[0])
    ).toBe(false);
  });

  it("Human Power Selection defaults to third at-will unless Heroic Effort is picked", () => {
    const race = {
      id: "hum",
      name: "Human",
      slug: "human",
      raw: { specific: { "Racial Traits": ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION } }
    };
    const parentTrait = {
      id: ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION,
      name: "Human Power Selection",
      slug: "hps",
      raw: {}
    };
    const map = new Map([[parentTrait.id, parentTrait]]);
    expect(raceGrantsBonusClassAtWillSlot(race as Parameters<typeof raceGrantsBonusClassAtWillSlot>[0], map, [], {})).toBe(true);
    expect(
      raceGrantsBonusClassAtWillSlot(race as Parameters<typeof raceGrantsBonusClassAtWillSlot>[0], map, [], {
        [HUMAN_POWER_OPTION_RACE_KEY]: ID_RACIAL_TRAIT_HEROIC_EFFORT
      })
    ).toBe(false);
  });

  it("bonusClassAtWillSlotFromRaceBuild reads race + selections", () => {
    const index = {
      meta: { version: 1, counts: {} },
      races: [
        {
          id: "rh",
          name: "Human",
          slug: "human",
          raw: { specific: { "Racial Traits": `${ID_RACIAL_TRAIT_BONUS_AT_WILL}` } }
        }
      ],
      racialTraits: [traitBonus],
      classes: [],
      feats: [],
      powers: [],
      skills: [],
      armors: [],
      themes: [],
      languages: [],
      paragonPaths: [],
      epicDestinies: [],
      abilityScores: []
    } as unknown as RulesIndex;
    expect(bonusClassAtWillSlotFromRaceBuild(index, { raceId: "rh", raceSelections: undefined })).toBe(true);
    expect(bonusClassAtWillSlotFromRaceBuild(index, { raceId: "rh", raceSelections: {} })).toBe(true);
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

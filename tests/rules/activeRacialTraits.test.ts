import { describe, expect, it } from "vitest";
import {
  collectActiveRacialTraitIds,
  collectActiveRacialTraitIdsFromBuild,
  collectActiveRacialTraits
} from "../../src/rules/activeRacialTraits";
import type { CharacterBuild, Race, RacialTrait, RulesIndex } from "../../src/rules/models";

// Fixture ids only; the runtime identifies these traits by ETL flags, not ids.
const ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION = "ID_FMP_RACIAL_TRAIT_2966";
const ID_RACIAL_TRAIT_BONUS_AT_WILL = "ID_FMP_RACIAL_TRAIT_356";
const ID_RACIAL_TRAIT_HEROIC_EFFORT = "ID_FMP_RACIAL_TRAIT_2965";

describe("collectActiveRacialTraitIds", () => {
  it("returns empty when race is undefined", () => {
    expect(collectActiveRacialTraitIds(undefined, new Map())).toEqual([]);
  });

  it("includes top-level traits and hides unselected subrace options", () => {
    const race: Race = {
      id: "R_ELF",
      name: "Elf",
      slug: "elf",
      raw: { specific: { "Racial Traits": "TR_BASE,TR_SUB" } }
    };
    const base: RacialTrait = { id: "TR_BASE", name: "Fey Origin", slug: "fey", raw: {} };
    const parent: RacialTrait = {
      id: "TR_SUB",
      name: "Elf Subrace",
      slug: "elf-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_A,TR_B" } }
    };
    const sun: RacialTrait = { id: "TR_A", name: "Sun Elf", slug: "sun", raw: {} };
    const wood: RacialTrait = {
      id: "TR_B",
      name: "Wood Elf",
      slug: "wood",
      raw: { specific: { _PARSED_CHILD_FEATURES: "TR_CHILD" } }
    };
    const child: RacialTrait = { id: "TR_CHILD", name: "Group Awareness", slug: "ga", raw: {} };
    const byId = new Map([
      ["TR_BASE", base],
      ["TR_SUB", parent],
      ["TR_A", sun],
      ["TR_B", wood],
      ["TR_CHILD", child]
    ]);

    const ids = collectActiveRacialTraitIds(race, byId, { subrace: "TR_B" });
    expect(ids).toContain("TR_BASE");
    expect(ids).toContain("TR_B");
    expect(ids).toContain("TR_CHILD");
    expect(ids).not.toContain("TR_SUB");
    expect(ids).not.toContain("TR_A");
  });

  it("includes past spirit after revenant past life pick", () => {
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

    const ids = collectActiveRacialTraitIds(race, byId, { "countsAsRace:TR_PL": "R_DB" }, races);
    expect(ids).toContain("TR_PL");
    expect(ids).toContain("TR_PS");
  });

  it("includes Heroic Effort when human power option selects it", () => {
    const race: Race = {
      id: "R_HUMAN",
      name: "Human",
      slug: "human",
      raw: { specific: { "Racial Traits": ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION } }
    };
    const powerPick: RacialTrait = {
      id: ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION,
      name: "Human Power Selection",
      slug: "human-power",
      raw: {
        specific: {
          _PARSED_SUB_FEATURES: `${ID_RACIAL_TRAIT_HEROIC_EFFORT},${ID_RACIAL_TRAIT_BONUS_AT_WILL}`
        },
        rules: {
          select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Human Power Selection" } }]
        }
      }
    };
    const heroic: RacialTrait = {
      id: ID_RACIAL_TRAIT_HEROIC_EFFORT,
      name: "Heroic Effort",
      slug: "heroic-effort",
      raw: {}
    };
    const bonusAtWill: RacialTrait = {
      id: ID_RACIAL_TRAIT_BONUS_AT_WILL,
      name: "Bonus At-Will Power",
      slug: "bonus-at-will",
      raw: {}
    };
    const byId = new Map([
      [ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION, powerPick],
      [ID_RACIAL_TRAIT_HEROIC_EFFORT, heroic],
      [ID_RACIAL_TRAIT_BONUS_AT_WILL, bonusAtWill]
    ]);

    const ids = collectActiveRacialTraitIds(race, byId, {
      subrace: ID_RACIAL_TRAIT_HEROIC_EFFORT
    });
    expect(ids).toContain(ID_RACIAL_TRAIT_HEROIC_EFFORT);
  });

  it("deduplicates ids from display and extra-trait sources", () => {
    const race: Race = {
      id: "R_ELF",
      name: "Elf",
      slug: "elf",
      raw: { specific: { "Racial Traits": "TR_SUB" } }
    };
    const parent: RacialTrait = {
      id: "TR_SUB",
      name: "Elf Subrace",
      slug: "elf-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_A" } }
    };
    const wood: RacialTrait = { id: "TR_A", name: "Wood Elf", slug: "wood", raw: {} };
    const byId = new Map([
      ["TR_SUB", parent],
      ["TR_A", wood]
    ]);

    const ids = collectActiveRacialTraitIds(race, byId, { subrace: "TR_A" });
    expect(ids.filter((id) => id === "TR_A")).toHaveLength(1);
  });
});

describe("collectActiveRacialTraitsFromBuild", () => {
  it("resolves traits from index and build", () => {
    const index: RulesIndex = {
      races: [
        {
          id: "R_ELF",
          name: "Elf",
          slug: "elf",
          raw: { specific: { "Racial Traits": "TR_BASE" } }
        }
      ],
      racialTraits: [{ id: "TR_BASE", name: "Fey Origin", slug: "fey", raw: {} }]
    };
    const build: CharacterBuild = {
      name: "Test",
      level: 1,
      raceId: "R_ELF",
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 10 },
      trainedSkillIds: [],
      featIds: [],
      powerIds: []
    };

    expect(collectActiveRacialTraitIdsFromBuild(index, build)).toEqual(["TR_BASE"]);
    expect(collectActiveRacialTraits(index.races[0], new Map(index.racialTraits!.map((t) => [t.id, t]))).map(
      (t) => t.name
    )).toEqual(["Fey Origin"]);
  });
});

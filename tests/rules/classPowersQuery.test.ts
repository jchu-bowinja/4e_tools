import { describe, expect, it } from "vitest";
import { getClassPowersForLevelRange, getDilettanteCandidatePowers, getPowersForOwnerId } from "../../src/rules/classPowersQuery";
import type { Power, RulesIndex } from "../../src/rules/models";

function power(id: string, owner: string, lv: number, powerType: string, usage: string): Power {
  return {
    id,
    name: id,
    slug: id,
    level: lv,
    classId: owner,
    usage,
    raw: { specific: { "Power Type": powerType, "Power Usage": usage } }
  };
}

const miniIndex: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [],
  classes: [{ id: "ID_FMP_CLASS_1", name: "Fighter", slug: "fighter", raw: {} }],
  paragonPaths: [],
  epicDestinies: [],
  powers: [
    power("p1", "ID_FMP_CLASS_1", 1, "Attack", "At-Will"),
    power("p2", "ID_FMP_CLASS_1", 5, "Attack", "Encounter"),
    power("p3", "ID_FMP_PARAGON_PATH_99", 11, "Attack", "Encounter"),
    power("p4", "ID_FMP_PARAGON_PATH_99", 30, "Utility", "Daily"),
    power("p5", "ID_FMP_EPIC_DESTINY_1", 26, "Utility", "Daily")
  ],
  feats: [],
  skills: [],
  armors: [],
  themes: [],
  languages: [],
  racialTraits: [],
  abilityScores: []
};

describe("getClassPowersForLevelRange", () => {
  it("excludes powers above maxLevel", () => {
    const atk = getClassPowersForLevelRange(miniIndex, "ID_FMP_CLASS_1", 3, "attack");
    expect(atk.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("getDilettanteCandidatePowers", () => {
  it("lists level-1 at-will attacks from other class-like owners only", () => {
    const index: RulesIndex = {
      ...miniIndex,
      classes: [
        { id: "ID_FMP_CLASS_A", name: "Fighter", slug: "fighter", raw: {} },
        { id: "ID_FMP_CLASS_B", name: "Wizard", slug: "wizard", raw: {} }
      ],
      powers: [
        {
          id: "aw_f",
          name: "Sure Strike",
          slug: "sure",
          classId: "ID_FMP_CLASS_A",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        },
        {
          id: "aw_w",
          name: "Magic Missile",
          slug: "mm",
          classId: "ID_FMP_CLASS_B",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        },
        {
          id: "enc_w",
          name: "Burning Hands",
          slug: "bh",
          classId: "ID_FMP_CLASS_B",
          level: 1,
          usage: "Encounter",
          raw: { specific: { "Power Type": "Attack" } }
        },
        {
          id: "path_x",
          name: "Path Zap",
          slug: "pz",
          classId: "ID_FMP_PARAGON_PATH_1",
          level: 1,
          usage: "At-Will",
          raw: { specific: { "Power Type": "Attack" } }
        }
      ]
    };
    const asWizard = getDilettanteCandidatePowers(index, "ID_FMP_CLASS_B");
    expect(asWizard.map((p) => p.id)).toEqual(["aw_f"]);
    expect(getDilettanteCandidatePowers(index, undefined)).toEqual([]);
  });
});

describe("getPowersForOwnerId", () => {
  it("returns paragon or epic powers for owner id and level cap", () => {
    const atk = getPowersForOwnerId(miniIndex, "ID_FMP_PARAGON_PATH_99", 15, "attack");
    expect(atk.map((p) => p.id)).toEqual(["p3"]);
    const allParagon = getPowersForOwnerId(miniIndex, "ID_FMP_PARAGON_PATH_99", 30, "utility");
    expect(allParagon.map((p) => p.id)).toEqual(["p4"]);
    const epic = getPowersForOwnerId(miniIndex, "ID_FMP_EPIC_DESTINY_1", 26, "utility");
    expect(epic.map((p) => p.id)).toEqual(["p5"]);
  });

  it("returns empty without owner or below level 1", () => {
    expect(getPowersForOwnerId(miniIndex, undefined, 20, "attack")).toEqual([]);
    expect(getPowersForOwnerId(miniIndex, "ID_FMP_PARAGON_PATH_99", 0, "attack")).toEqual([]);
  });
});

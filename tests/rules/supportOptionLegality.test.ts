import { describe, expect, it } from "vitest";
import { defaultBuild } from "../../src/features/builder/defaultBuild";
import { buildPrereqCharacterContext } from "../../src/rules/prereqContext";
import { evaluateSupportOptionLegality } from "../../src/rules/supportOptionLegality";
import type { RulesIndex } from "../../src/rules/models";

const index: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [{ id: "race_human", name: "Human", slug: "human", raw: {} }],
  classes: [{ id: "class_fighter", name: "Fighter", slug: "fighter", raw: {} }],
  feats: [],
  powers: [],
  skills: [{ id: "skill_athletics", name: "Athletics", slug: "athletics", raw: {} }],
  languages: [],
  armors: [],
  weapons: [],
  implements: [],
  abilityScores: [],
  racialTraits: [],
  themes: [
    {
      id: "theme_a",
      name: "Theme A",
      slug: "theme-a",
      prereqTokens: [{ kind: "class", value: "Fighter" }],
      raw: {}
    }
  ],
  paragonPaths: [],
  epicDestinies: []
};

describe("evaluateSupportOptionLegality", () => {
  it("reports level requirement before prereq tokens", () => {
    const build = { ...defaultBuild, level: 10, classId: "class_fighter" };
    const raceNames = new Map(index.races.map((r) => [r.id, r.name]));
    const classNames = new Map(index.classes.map((c) => [c.id, c.name]));
    const skillNames = new Map(index.skills.map((s) => [s.id, s.name]));
    const options = { index, context: buildPrereqCharacterContext(index, build) };

    const result = evaluateSupportOptionLegality(
      [{ kind: "class", value: "Fighter" }],
      11,
      build,
      raceNames,
      classNames,
      skillNames,
      options
    );

    expect(result.legal).toBe(false);
    expect(result.reasons).toContain("Requires level 11+");
  });
});

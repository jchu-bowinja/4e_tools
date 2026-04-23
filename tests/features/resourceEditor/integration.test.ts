import { describe, expect, it } from "vitest";
import { mergeRulesOverlay } from "../../../src/features/resourceEditor/overlay";
import { getClassPowersForLevelRange } from "../../../src/rules/classPowersQuery";
import type { RulesIndex } from "../../../src/rules/models";

const baseIndex: RulesIndex = {
  meta: { version: 1, counts: {} },
  races: [],
  classes: [{ id: "class_fighter", name: "Fighter", slug: "fighter", raw: {} }],
  feats: [],
  powers: [{ id: "power_cleave", name: "Cleave", slug: "cleave", classId: "class_fighter", level: 1, raw: {} }],
  skills: [],
  languages: [],
  armors: [],
  weapons: [],
  implements: [],
  abilityScores: [],
  racialTraits: [],
  themes: [],
  paragonPaths: [],
  epicDestinies: []
};

describe("resource editor integration", () => {
  it("makes overlay-added powers available to builder rules queries", () => {
    const merged = mergeRulesOverlay(baseIndex, {
      version: 1,
      collections: {
        powers: {
          upserts: {
            power_reaping: {
              id: "power_reaping",
              name: "Reaping Strike",
              slug: "reaping-strike",
              classId: "class_fighter",
              level: 1,
              usage: "At-Will",
              raw: { specific: { "Power Type": "Attack" } }
            }
          },
          deletes: []
        }
      }
    });
    const attacks = getClassPowersForLevelRange(merged, "class_fighter", 1, "attack");
    expect(attacks.map((power) => power.id)).toContain("power_reaping");
  });
});

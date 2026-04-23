import { describe, expect, it } from "vitest";
import { emptyResourceEditorOverlay, mergeRulesOverlay, normalizeResourceEditorOverlay } from "../../../src/features/resourceEditor/overlay";
import type { RulesIndex } from "../../../src/rules/models";

function makeIndex(): RulesIndex {
  return {
    meta: { version: 1, counts: {} },
    races: [{ id: "race_human", name: "Human", slug: "human", raw: {} }],
    classes: [{ id: "class_fighter", name: "Fighter", slug: "fighter", raw: {} }],
    feats: [{ id: "feat_toughness", name: "Toughness", slug: "toughness", prereqTokens: [], raw: {} }],
    powers: [{ id: "power_cleave", name: "Cleave", slug: "cleave", classId: "class_fighter", raw: {} }],
    skills: [],
    languages: [],
    armors: [{ id: "armor_hide", name: "Hide Armor", slug: "hide", raw: {} }],
    weapons: [{ id: "weapon_club", name: "Club", slug: "club", raw: {} }],
    implements: [{ id: "impl_orb", name: "Orb", slug: "orb", raw: {} }],
    abilityScores: [],
    racialTraits: [{ id: "trait_speed", name: "Quick Step", slug: "quick-step", raw: {} }],
    themes: [{ id: "theme_guardian", name: "Guardian", slug: "guardian", prereqTokens: [], raw: {} }],
    paragonPaths: [{ id: "path_ironvanguard", name: "Iron Vanguard", slug: "iron-vanguard", prereqTokens: [], raw: {} }],
    epicDestinies: [{ id: "destiny_demigod", name: "Demigod", slug: "demigod", prereqTokens: [], raw: {} }],
    hybridClasses: [{ id: "hybrid_fighter", name: "Hybrid Fighter", slug: "hybrid-fighter", raw: {} }]
  };
}

describe("resource editor overlay merge", () => {
  it("adds and updates resources via upserts", () => {
    const base = makeIndex();
    const merged = mergeRulesOverlay(base, {
      version: 1,
      collections: {
        races: {
          upserts: {
            race_human: { id: "race_human", name: "Human Prime", slug: "human-prime", raw: {} },
            race_shardmind: { id: "race_shardmind", name: "Shardmind", slug: "shardmind", raw: {} }
          },
          deletes: []
        }
      }
    });
    expect(merged.races.map((entry) => entry.id)).toEqual(["race_human", "race_shardmind"]);
    expect(merged.races[0].name).toBe("Human Prime");
  });

  it("deletes resources and keeps base untouched", () => {
    const base = makeIndex();
    const merged = mergeRulesOverlay(base, {
      version: 1,
      collections: {
        weapons: {
          upserts: {},
          deletes: ["weapon_club"]
        }
      }
    });
    expect(merged.weapons?.map((entry) => entry.id)).toEqual([]);
    expect(base.weapons?.map((entry) => entry.id)).toEqual(["weapon_club"]);
  });

  it("ignores malformed overlay entries", () => {
    const base = makeIndex();
    const malformed = normalizeResourceEditorOverlay({
      collections: {
        classes: {
          upserts: {
            bad_row: { name: "No Id" },
            class_fighter: { id: "class_fighter", name: "Fighter+", slug: "fighter", raw: {} }
          },
          deletes: [42, "class_missing"]
        }
      }
    });
    const merged = mergeRulesOverlay(base, malformed);
    expect(merged.classes.map((entry) => entry.name)).toEqual(["Fighter+"]);
  });

  it("returns empty overlay for invalid payloads", () => {
    expect(normalizeResourceEditorOverlay(null)).toEqual(emptyResourceEditorOverlay());
    expect(normalizeResourceEditorOverlay("x")).toEqual(emptyResourceEditorOverlay());
  });

  it("supports epic destiny overlay edits", () => {
    const base = makeIndex();
    const merged = mergeRulesOverlay(base, {
      version: 1,
      collections: {
        epicDestinies: {
          upserts: {
            destiny_demigod: { id: "destiny_demigod", name: "New Demigod", slug: "demigod", prereqTokens: [], raw: {} },
            destiny_reborn: { id: "destiny_reborn", name: "Reborn Champion", slug: "reborn-champion", prereqTokens: [], raw: {} }
          },
          deletes: []
        }
      }
    });
    expect(merged.epicDestinies.map((entry) => entry.id)).toEqual(["destiny_demigod", "destiny_reborn"]);
    expect(merged.epicDestinies[0].name).toBe("New Demigod");
  });

  it("supports feat, paragon path, racial trait, and hybrid class overlay edits", () => {
    const base = makeIndex();
    const merged = mergeRulesOverlay(base, {
      version: 1,
      collections: {
        feats: {
          upserts: {
            feat_toughness: { id: "feat_toughness", name: "Toughness+", slug: "toughness", prereqTokens: [], raw: {} }
          },
          deletes: []
        },
        paragonPaths: {
          upserts: {
            path_ironvanguard: {
              id: "path_ironvanguard",
              name: "Iron Vanguard+",
              slug: "iron-vanguard",
              prereqTokens: [],
              raw: {}
            }
          },
          deletes: []
        },
        racialTraits: {
          upserts: {
            trait_speed: { id: "trait_speed", name: "Quick Step+", slug: "quick-step", raw: {} }
          },
          deletes: []
        },
        hybridClasses: {
          upserts: {
            hybrid_fighter: { id: "hybrid_fighter", name: "Hybrid Fighter+", slug: "hybrid-fighter", raw: {} }
          },
          deletes: []
        }
      }
    });
    expect(merged.feats[0].name).toBe("Toughness+");
    expect(merged.paragonPaths[0].name).toBe("Iron Vanguard+");
    expect(merged.racialTraits[0].name).toBe("Quick Step+");
    expect(merged.hybridClasses?.[0].name).toBe("Hybrid Fighter+");
  });
});

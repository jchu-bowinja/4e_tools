import { describe, expect, it } from "vitest";
import type { Race, RacialTrait } from "../../src/rules/models";
import {
  getChildTraitIdsForSubrace,
  getRaceExtraTraitIds,
  getRaceSubraceData,
  getRaceTraitBundleSlots,
  resolveDisplayedRacialTraitsForRace
} from "../../src/rules/raceSubraces";

describe("getRaceSubraceData", () => {
  it("extracts options from a race subrace parent trait", () => {
    const race: Race = {
      id: "R1",
      name: "Elf",
      slug: "elf",
      raw: { specific: { "Racial Traits": "TR_SUB" } }
    };
    const parent: RacialTrait = {
      id: "TR_SUB",
      name: "Elf Subrace",
      slug: "elf-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_A,TR_B" } }
    };
    const a: RacialTrait = { id: "TR_A", name: "Sun Elf", slug: "sun-elf", raw: {} };
    const b: RacialTrait = { id: "TR_B", name: "Wood Elf", slug: "wood-elf", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_SUB", parent],
      ["TR_A", a],
      ["TR_B", b]
    ]);
    const sub = getRaceSubraceData(race, byId);
    expect(sub?.parentTraitName).toBe("Elf Subrace");
    expect(sub?.options.map((o) => o.name)).toEqual(["Sun Elf", "Wood Elf"]);
  });

  it("finds subrace parent trait by race-name fallback when not listed on race trait ids", () => {
    const race: Race = {
      id: "R_DB",
      name: "Dragonborn",
      slug: "dragonborn",
      raw: { specific: { "Racial Traits": "TR_A,TR_B" } }
    };
    const parent: RacialTrait = {
      id: "TR_DRAGON_SUB",
      name: "Dragonborn Subrace",
      slug: "dragonborn-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_STD,TR_SUBRACE_BOZAK,TR_SUBRACE_KAPAK" } }
    };
    const std: RacialTrait = { id: "TR_STD", name: "Standard Dragonborn", slug: "std", raw: {} };
    const bozak: RacialTrait = { id: "TR_RACIAL_TRAIT_BOZAK", name: "Bozak Draconian", slug: "bozak", raw: {} };
    const kapak: RacialTrait = { id: "TR_RACIAL_TRAIT_KAPAK", name: "Kapak Draconian", slug: "kapak", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_A", { id: "TR_A", name: "Dragonborn Fury", slug: "fury", raw: {} }],
      ["TR_B", { id: "TR_B", name: "Draconic Heritage", slug: "heritage", raw: {} }],
      ["TR_DRAGON_SUB", parent],
      ["TR_STD", std],
      ["TR_RACIAL_TRAIT_BOZAK", bozak],
      ["TR_RACIAL_TRAIT_KAPAK", kapak]
    ]);
    const sub = getRaceSubraceData(race, byId);
    expect(sub?.parentTraitName).toBe("Dragonborn Subrace");
    expect(sub?.options.map((o) => o.name)).toEqual([
      "Bozak Draconian",
      "Kapak Draconian",
      "Standard Dragonborn"
    ]);
  });

  it("ignores non-subrace parsed options on race traits and uses subrace parent fallback", () => {
    const race: Race = {
      id: "R_DB",
      name: "Dragonborn",
      slug: "dragonborn",
      raw: { specific: { "Racial Traits": "TR_POWER_PICK" } }
    };
    const powerPick: RacialTrait = {
      id: "TR_POWER_PICK",
      name: "Dragonborn Racial Power",
      slug: "dragonborn-racial-power",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_POWER_A,TR_POWER_B" } }
    };
    const parent: RacialTrait = {
      id: "TR_DRAGON_SUB",
      name: "Dragonborn Subrace",
      slug: "dragonborn-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_SUBRACE_BOZAK,TR_SUBRACE_KAPAK,TR_STD" } }
    };
    const std: RacialTrait = { id: "TR_STD", name: "Standard Dragonborn Racial Traits", slug: "std", raw: {} };
    const bozak: RacialTrait = { id: "TR_RACIAL_TRAIT_BOZAK", name: "Bozak Draconian", slug: "bozak", raw: {} };
    const kapak: RacialTrait = { id: "TR_RACIAL_TRAIT_KAPAK", name: "Kapak Draconian", slug: "kapak", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_POWER_PICK", powerPick],
      ["TR_DRAGON_SUB", parent],
      ["TR_STD", std],
      ["TR_RACIAL_TRAIT_BOZAK", bozak],
      ["TR_RACIAL_TRAIT_KAPAK", kapak]
    ]);
    const sub = getRaceSubraceData(race, byId);
    expect(sub?.parentTraitName).toBe("Dragonborn Subrace");
    expect(sub?.options.map((o) => o.name)).toEqual([
      "Bozak Draconian",
      "Kapak Draconian",
      "Standard Dragonborn Racial Traits"
    ]);
  });

  it("treats Half-Elf Power Selection as a sibling-trait bundle (Dilettante vs Knack)", () => {
    const race: Race = {
      id: "R_HE",
      name: "Half-Elf",
      slug: "half-elf",
      raw: { specific: { "Racial Traits": "TR_HPS" } }
    };
    const parent: RacialTrait = {
      id: "TR_HPS",
      name: "Half-Elf Power Selection",
      slug: "half-elf-power-selection",
      raw: {
        specific: { _PARSED_SUB_FEATURES: "TR_DIL,TR_KNACK" },
        rules: { select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Half-Elf Power Selection" } }] }
      }
    };
    const dilettante: RacialTrait = { id: "TR_DIL", name: "Dilettante", slug: "dilettante", raw: {} };
    const knack: RacialTrait = { id: "TR_KNACK", name: "Knack for Success", slug: "knack", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_HPS", parent],
      ["TR_DIL", dilettante],
      ["TR_KNACK", knack]
    ]);
    const sub = getRaceSubraceData(race, byId);
    expect(sub?.parentTraitName).toBe("Half-Elf Power Selection");
    expect(sub?.options.map((o) => o.name).sort()).toEqual(["Dilettante", "Knack for Success"].sort());
  });

  it("adds standard race traits option when subrace list omits it (dwarf-style data)", () => {
    const race: Race = {
      id: "R_DW",
      name: "Dwarf",
      slug: "dwarf",
      raw: { specific: { "Racial Traits": "TR_DWARF_SUB" } }
    };
    const parent: RacialTrait = {
      id: "TR_DWARF_SUB",
      name: "Dwarf Subrace",
      slug: "dwarf-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_GOLD,TR_SHIELD" } }
    };
    const std: RacialTrait = {
      id: "TR_STD_DWARF",
      name: "Standard Dwarf Racial Traits",
      slug: "standard-dwarf-racial-traits",
      raw: {}
    };
    const gold: RacialTrait = { id: "TR_GOLD", name: "Gold Dwarf", slug: "gold-dwarf", raw: {} };
    const shield: RacialTrait = { id: "TR_SHIELD", name: "Shield Dwarf", slug: "shield-dwarf", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_DWARF_SUB", parent],
      ["TR_GOLD", gold],
      ["TR_SHIELD", shield],
      ["TR_STD_DWARF", std]
    ]);
    const sub = getRaceSubraceData(race, byId);
    expect(sub?.options.map((o) => o.name)).toEqual([
      "Gold Dwarf",
      "Shield Dwarf",
      "Standard Dwarf Racial Traits"
    ]);
  });
});

describe("getRaceExtraTraitIds", () => {
  it("returns child traits for the selected subrace", () => {
    const race: Race = {
      id: "R1",
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
    const a: RacialTrait = {
      id: "TR_A",
      name: "Sun Elf",
      slug: "sun-elf",
      raw: { specific: { _PARSED_CHILD_FEATURES: "TR_C" } }
    };
    const c: RacialTrait = { id: "TR_C", name: "Sun Elf Grace", slug: "grace", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_SUB", parent],
      ["TR_A", a],
      ["TR_C", c]
    ]);
    expect(getRaceExtraTraitIds(race, byId, { subrace: "TR_A" })).toEqual(["TR_A", "TR_C"]);
    expect(getRaceExtraTraitIds(race, byId, {})).toEqual([]);
  });
});

describe("resolveDisplayedRacialTraitsForRace", () => {
  it("hides subrace parent and unselected options until a variant is picked", () => {
    const race: Race = {
      id: "R1",
      name: "Elf",
      slug: "elf",
      raw: { specific: { "Racial Traits": "TR_BASE,TR_SUB" } }
    };
    const base: RacialTrait = { id: "TR_BASE", name: "Group Awareness", slug: "ga", raw: {} };
    const parent: RacialTrait = {
      id: "TR_SUB",
      name: "Elf Subrace",
      slug: "elf-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_A,TR_B" } }
    };
    const a: RacialTrait = { id: "TR_A", name: "Sun Elf", slug: "sun-elf", raw: {} };
    const b: RacialTrait = { id: "TR_B", name: "Wood Elf", slug: "wood-elf", raw: {} };
    const byId = new Map<string, RacialTrait>([
      ["TR_BASE", base],
      ["TR_SUB", parent],
      ["TR_A", a],
      ["TR_B", b]
    ]);
    expect(resolveDisplayedRacialTraitsForRace(race, byId, {}).map((r) => r.id)).toEqual(["TR_BASE"]);
    expect(resolveDisplayedRacialTraitsForRace(race, byId, { subrace: "TR_A" }).map((r) => r.id)).toEqual([
      "TR_BASE",
      "TR_A"
    ]);
  });
});

describe("getRaceTraitBundleSlots", () => {
  it("includes Elemental Manifestation on Genasi", () => {
    const race: Race = {
      id: "R_GEN",
      name: "Genasi",
      slug: "genasi",
      raw: { specific: { "Racial Traits": "TR_MAN" } }
    };
    const parent: RacialTrait = {
      id: "TR_MAN",
      name: "Elemental Manifestation",
      slug: "elemental-manifestation",
      raw: {
        specific: { _PARSED_SUB_FEATURES: "TR_FIRE,TR_EARTH" },
        rules: { select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Elemental Manifestation" } }] }
      }
    };
    const fire: RacialTrait = { id: "TR_FIRE", name: "Firesoul", slug: "firesoul", raw: {} };
    const earth: RacialTrait = { id: "TR_EARTH", name: "Earthsoul", slug: "earthsoul", raw: {} };
    const byId = new Map([
      ["TR_MAN", parent],
      ["TR_FIRE", fire],
      ["TR_EARTH", earth]
    ]);
    const slots = getRaceTraitBundleSlots(race, byId);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.parentTraitName).toBe("Elemental Manifestation");
    expect(slots[0]?.selectionKey).toBe("racialTrait:TR_MAN");
    expect(slots[0]?.options.map((o) => o.name).sort()).toEqual(["Earthsoul", "Firesoul"]);
  });

  it("includes Dragonborn Racial Power alongside subrace fallback", () => {
    const race: Race = {
      id: "R_DB",
      name: "Dragonborn",
      slug: "dragonborn",
      raw: { specific: { "Racial Traits": "TR_PWR" } }
    };
    const powerPick: RacialTrait = {
      id: "TR_PWR",
      name: "Dragonborn Racial Power",
      slug: "dragonborn-racial-power",
      raw: {
        specific: { _PARSED_SUB_FEATURES: "TR_A,TR_B" },
        rules: { select: [{ attrs: { type: "Racial Trait", number: "1", Category: "Dragonborn Racial Power" } }] }
      }
    };
    const a: RacialTrait = { id: "TR_A", name: "Dragon Breath", slug: "breath", raw: {} };
    const b: RacialTrait = { id: "TR_B", name: "Dragonborn Fury", slug: "fury", raw: {} };
    const subParent: RacialTrait = {
      id: "TR_SUB",
      name: "Dragonborn Subrace",
      slug: "dragonborn-subrace",
      raw: { specific: { _PARSED_SUB_FEATURES: "TR_STD" } }
    };
    const std: RacialTrait = { id: "TR_STD", name: "Standard Dragonborn Racial Traits", slug: "std", raw: {} };
    const byId = new Map([
      ["TR_PWR", powerPick],
      ["TR_A", a],
      ["TR_B", b],
      ["TR_SUB", subParent],
      ["TR_STD", std]
    ]);
    const slots = getRaceTraitBundleSlots(race, byId);
    expect(slots.map((s) => s.parentTraitName).sort()).toEqual(
      ["Dragonborn Racial Power", "Dragonborn Subrace"].sort()
    );
    expect(slots.find((s) => s.selectionKey === "subrace")?.options.map((o) => o.name)).toEqual([
      "Standard Dragonborn Racial Traits"
    ]);
  });
});

describe("getChildTraitIdsForSubrace", () => {
  it("parses child trait ids from selected subrace", () => {
    const subrace: RacialTrait = {
      id: "TR_A",
      name: "Sun Elf",
      slug: "sun-elf",
      raw: { specific: { _PARSED_CHILD_FEATURES: "TR_C,TR_D" } }
    };
    expect(getChildTraitIdsForSubrace(subrace)).toEqual(["TR_C", "TR_D"]);
  });

  it("derives child trait ids from subrace select categories when parsed child ids are absent", () => {
    const subrace: RacialTrait = {
      id: "TR_BOZAK",
      name: "Bozak Draconian",
      slug: "bozak-draconian",
      raw: {
        rules: {
          select: [
            { attrs: { type: "Racial Trait", Category: "ID_FMP_RACIAL_TRAIT_379|ID_TIV_RACIAL_TRAIT_BOZAK-1" } },
            { attrs: { type: "Racial Trait", Category: "ID_FMP_RACIAL_TRAIT_631|ID_TIV_RACIAL_TRAIT_BOZAK-2" } }
          ]
        }
      }
    };
    expect(getChildTraitIdsForSubrace(subrace)).toEqual([
      "ID_FMP_RACIAL_TRAIT_379",
      "ID_TIV_RACIAL_TRAIT_BOZAK-1",
      "ID_FMP_RACIAL_TRAIT_631",
      "ID_TIV_RACIAL_TRAIT_BOZAK-2"
    ]);
  });
});

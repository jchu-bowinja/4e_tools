import { describe, expect, it } from "vitest";
import {
  monsterMatchesPrerequisite,
  monsterMatchesTemplateRecord,
  parseMonsterTemplatePrerequisite,
  parseTypePhraseToTags,
  splitTypeAlternatives
} from "./templatePrerequisiteCriteria";
import type { MonsterEntryFile, MonsterTemplatePrerequisite } from "./storage";

/**
 * Book-style lines → flat `prerequisiteExpr` (`typeOr` / `typeAnd` are string[]; shared living lifted to `living`).
 */
const PREREQUISITE_EXAMPLES: Array<{ line: string; json: MonsterTemplatePrerequisite }> = [
  {
    line: "Prerequisite: Level 11, Intelligence 13",
    json: { minLevel: 11, abilities: { int: 13 } }
  },
  {
    line: "Prerequisite: Beast or humanoid",
    json: { typeOr: ["beast", "humanoid"] }
  },
  {
    line: "Prerequisites: Humanoid, level 11",
    json: { minLevel: 11, typeAnd: ["humanoid"] }
  },
  {
    line: "Prerequisite: Humanoid or magical beast",
    json: { typeOr: ["humanoid", "magical beast"] }
  },
  {
    line: "Prerequisites: Living beast, living humanoid, or living magical beast",
    json: {
      living: true,
      typeOr: ["beast", "humanoid", "magical beast"]
    }
  },
  {
    line: "Prerequisites: Living creature, level 11, Charisma 13",
    json: { living: true, minLevel: 11, abilities: { cha: 13 } }
  },
  {
    line: "Prerequisites: Level 11, and beast, humanoid, or magical beast.",
    json: { minLevel: 11, typeOr: ["beast", "humanoid", "magical beast"] }
  },
  {
    line: "Prerequisites: None",
    json: {}
  },
  {
    line: "Prerequisite: Beast (reptile), humanoid, or magical beast",
    json: { typeOr: ["reptile", "humanoid", "magical beast"] }
  },
  {
    line: "Prerequisites: Living humanoid",
    json: { living: true, typeAnd: ["humanoid"] }
  },
  {
    line: "Prerequisites: Living creature",
    json: { living: true }
  },
  {
    line: "Prerequisites: Undead",
    json: { undead: true }
  },
  {
    line: "Prerequisites: Humanoid or magical beast, Intelligence 12.",
    json: { typeOr: ["humanoid", "magical beast"], abilities: { int: 12 } }
  },
  {
    line: "Prerequisites: Humanoid or magical beast, level 11",
    json: { typeOr: ["humanoid", "magical beast"], minLevel: 11 }
  }
];

describe("parseMonsterTemplatePrerequisite (flat prerequisiteExpr)", () => {
  it("matches all documented book examples", () => {
    for (const { line, json } of PREREQUISITE_EXAMPLES) {
      const { data, parseOk } = parseMonsterTemplatePrerequisite(line);
      expect(parseOk, line).toBe(true);
      expect(data, line).toEqual(json);
    }
  });

  it("normalizes wrapped OR line (multiline book wrap)", () => {
    const wrapped =
      "Prerequisites: Living beast, living humanoid, or\nliving magical beast";
    const { data, parseOk } = parseMonsterTemplatePrerequisite(wrapped);
    expect(parseOk).toBe(true);
    expect(data).toEqual(PREREQUISITE_EXAMPLES[4].json);
  });

  it("normalizes Level 11 / magical beast. wrapped sentence", () => {
    const wrapped = "Prerequisites: Level 11, and beast, humanoid, or\nmagical beast.";
    const { data, parseOk } = parseMonsterTemplatePrerequisite(wrapped);
    expect(parseOk).toBe(true);
    expect(data).toEqual(PREREQUISITE_EXAMPLES[6].json);
  });
});

describe("splitTypeAlternatives", () => {
  it("splits Oxford list", () => {
    expect(splitTypeAlternatives("beast, humanoid, or magical beast")).toEqual(["beast", "humanoid", "magical beast"]);
  });
});

describe("parseTypePhraseToTags", () => {
  it("reads parenthetical subtype", () => {
    expect(parseTypePhraseToTags("Beast (reptile)")).toEqual(["beast", "reptile"]);
  });
});

function sampleMonster(partial: Partial<MonsterEntryFile>): MonsterEntryFile {
  return {
    id: "x",
    fileName: "x",
    relativePath: "x",
    sourceRoot: "",
    parseError: "",
    name: "Test",
    level: "11",
    role: "Brute",
    size: "Medium",
    origin: "Natural",
    type: "Humanoid",
    xp: 0,
    stats: {
      abilityScores: { intelligence: 14, charisma: 15 },
      defenses: {},
      attackBonuses: {},
      skills: {},
      otherNumbers: {}
    },
    powers: [],
    traits: [],
    auras: [],
    keywords: [],
    ...partial
  } as MonsterEntryFile;
}

/**
 * Run matcher against each book-line sample: parsed prerequisite must accept `pass` and reject `fail`.
 */
describe("PREREQUISITE_EXAMPLES → monsterMatchesPrerequisite", () => {
  const rows: Array<{
    label: string;
    line: string;
    pass: Partial<MonsterEntryFile>;
    fail: Partial<MonsterEntryFile>;
  }> = [
    {
      label: "Level 11, Intelligence 13",
      line: PREREQUISITE_EXAMPLES[0].line,
      pass: { level: "12", stats: { abilityScores: { intelligence: 14 }, defenses: {}, attackBonuses: {}, skills: {}, otherNumbers: {} } },
      fail: { level: "12", stats: { abilityScores: { intelligence: 10 }, defenses: {}, attackBonuses: {}, skills: {}, otherNumbers: {} } }
    },
    {
      label: "Beast or humanoid",
      line: PREREQUISITE_EXAMPLES[1].line,
      pass: { type: "Large Natural Beast" },
      fail: { type: "Medium Elemental", keywords: ["air"] }
    },
    {
      label: "Humanoid, level 11",
      line: PREREQUISITE_EXAMPLES[2].line,
      pass: { level: "12", type: "Humanoid" },
      fail: { level: "9", type: "Humanoid" }
    },
    {
      label: "Humanoid or magical beast",
      line: PREREQUISITE_EXAMPLES[3].line,
      pass: { type: "Magical Beast" },
      fail: { type: "Elemental" }
    },
    {
      label: "Living beast / living humanoid / living magical beast",
      line: PREREQUISITE_EXAMPLES[4].line,
      pass: { type: "Natural Beast", traits: [] },
      fail: { type: "Natural Beast", traits: [{ name: "Undead", details: "", range: 0, type: "Trait" }] }
    },
    {
      label: "Living creature, level 11, Charisma 13",
      line: PREREQUISITE_EXAMPLES[5].line,
      pass: {
        level: "12",
        stats: {
          abilityScores: { charisma: 14 },
          defenses: {},
          attackBonuses: {},
          skills: {},
          otherNumbers: {}
        }
      },
      fail: {
        level: "12",
        stats: {
          abilityScores: { charisma: 10 },
          defenses: {},
          attackBonuses: {},
          skills: {},
          otherNumbers: {}
        }
      }
    },
    {
      label: "Level 11 and beast, humanoid, or magical beast",
      line: PREREQUISITE_EXAMPLES[6].line,
      pass: { level: "12", type: "Humanoid" },
      fail: { level: "12", type: "Elemental" }
    },
    {
      label: "None",
      line: PREREQUISITE_EXAMPLES[7].line,
      pass: { level: "1", type: "Ooze" },
      fail: { level: "1", type: "Ooze" }
    },
    {
      label: "Beast (reptile) / humanoid / magical beast",
      line: PREREQUISITE_EXAMPLES[8].line,
      pass: { type: "Natural Beast", keywords: ["reptile"] },
      fail: { type: "Elemental" }
    },
    {
      label: "Living humanoid",
      line: PREREQUISITE_EXAMPLES[9].line,
      pass: { type: "Humanoid", traits: [] },
      fail: { type: "Humanoid", traits: [{ name: "Undead", details: "", range: 0, type: "Trait" }] }
    },
    {
      label: "Living creature",
      line: PREREQUISITE_EXAMPLES[10].line,
      pass: { traits: [] },
      fail: { traits: [{ name: "Undead", details: "", range: 0, type: "Trait" }] }
    },
    {
      label: "Undead",
      line: PREREQUISITE_EXAMPLES[11].line,
      pass: { type: "Humanoid", traits: [{ name: "Undead", details: "", range: 0, type: "Trait" }] },
      fail: { type: "Humanoid", traits: [] }
    },
    {
      label: "Humanoid or magical beast, Intelligence 12",
      line: PREREQUISITE_EXAMPLES[12].line,
      pass: {
        type: "Humanoid",
        stats: {
          abilityScores: { intelligence: 14 },
          defenses: {},
          attackBonuses: {},
          skills: {},
          otherNumbers: {}
        }
      },
      fail: {
        type: "Humanoid",
        stats: {
          abilityScores: { intelligence: 10 },
          defenses: {},
          attackBonuses: {},
          skills: {},
          otherNumbers: {}
        }
      }
    },
    {
      label: "Humanoid or magical beast, level 11",
      line: PREREQUISITE_EXAMPLES[13].line,
      pass: { level: "12", type: "Humanoid" },
      fail: { level: "8", type: "Humanoid" }
    }
  ];

  for (const { label, line, pass, fail } of rows) {
    it(`accepts a matching monster: ${label}`, () => {
      const { data } = parseMonsterTemplatePrerequisite(line);
      expect(monsterMatchesPrerequisite(sampleMonster(pass), data)).toBe(true);
    });
    it(`rejects a non-matching monster: ${label}`, () => {
      const { data } = parseMonsterTemplatePrerequisite(line);
      const expectFail = label !== "None";
      expect(monsterMatchesPrerequisite(sampleMonster(fail), data)).toBe(!expectFail);
    });
  }
});

describe("monsterMatchesPrerequisite", () => {
  it("matches empty prerequisite (no constraints) always", () => {
    const p: MonsterTemplatePrerequisite = {};
    expect(monsterMatchesPrerequisite(sampleMonster({ level: "1" }), p)).toBe(true);
  });

  it("matches legacy { none: true } always", () => {
    const p: MonsterTemplatePrerequisite = { none: true };
    expect(monsterMatchesPrerequisite(sampleMonster({ level: "1" }), p)).toBe(true);
  });

  it("checks level and humanoid (typeAnd)", () => {
    const p: MonsterTemplatePrerequisite = { minLevel: 11, typeAnd: ["humanoid"] };
    expect(monsterMatchesPrerequisite(sampleMonster({ level: "12", type: "Humanoid" }), p)).toBe(true);
    expect(monsterMatchesPrerequisite(sampleMonster({ level: "10", type: "Humanoid" }), p)).toBe(false);
    expect(monsterMatchesPrerequisite(sampleMonster({ level: "12", type: "Beast" }), p)).toBe(false);
  });

  it("matches humanoid OR magical beast", () => {
    const p: MonsterTemplatePrerequisite = {
      typeOr: ["humanoid", "magical beast"]
    };
    expect(monsterMatchesPrerequisite(sampleMonster({ type: "Magical Beast" }), p)).toBe(true);
    expect(monsterMatchesPrerequisite(sampleMonster({ type: "Humanoid" }), p)).toBe(true);
    expect(monsterMatchesPrerequisite(sampleMonster({ type: "Elemental" }), p)).toBe(false);
  });

  it("rejects undead for living + level", () => {
    const p: MonsterTemplatePrerequisite = { living: true, minLevel: 11 };
    expect(
      monsterMatchesPrerequisite(sampleMonster({ level: "11", traits: [{ name: "Undead", details: "" }] }), p)
    ).toBe(false);
  });
});

describe("monsterMatchesTemplateRecord", () => {
  it("uses prerequisiteExpr when present", () => {
    const entry = sampleMonster({ level: "5", type: "Humanoid" });
    const ok = monsterMatchesTemplateRecord(entry, {
      prerequisite: "ignored when expr set",
      prerequisiteExpr: { minLevel: 11, typeAnd: ["humanoid"] }
    });
    expect(ok).toBe(false);
  });

  it("parses prerequisite prose when expr is absent", () => {
    const entry = sampleMonster({ level: "12", type: "Humanoid" });
    const ok = monsterMatchesTemplateRecord(entry, {
      prerequisite: "Prerequisites: Humanoid, level 11"
    });
    expect(ok).toBe(true);
  });
});

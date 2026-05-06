import { describe, expect, it } from "vitest";
import { applyMonsterTemplateToEntry, computeTemplateApplicationDelta } from "./applyMonsterTemplate";
import { parsePastedMonsterTemplateTextLocal, validateMonsterTemplateImport } from "./pasteMonsterTemplateEtl";
import type { MonsterEntryFile, MonsterTemplateRecord } from "./storage";

/** Same fixture shape as applyMonsterTemplate.test.ts — minimal base creature. */
function baseMonster(): MonsterEntryFile {
  return {
    id: "m1",
    fileName: "x.monster",
    relativePath: "x.monster",
    sourceRoot: "MonsterFiles",
    parseError: "",
    name: "Goblin",
    level: "8",
    role: "Skirmisher",
    size: "Small",
    origin: "Natural",
    type: "Humanoid",
    xp: "350",
    stats: {
      abilityScores: {},
      defenses: {},
      attackBonuses: {},
      skills: {},
      otherNumbers: {}
    },
    powers: [{ name: "Short Sword", usage: "At-Will", action: "Standard", keywords: "", description: "" }],
    traits: [{ name: "Cowardly", details: "Shifts when bloodied", range: 0, type: "Trait" }],
    auras: []
  } as MonsterEntryFile;
}

const D6 = "\u2685";

/** Full book-style block (matches pasteMonsterTemplateEtl.recharge.test.ts) so the POWERS section parses reliably. */
const DEVASTATOR_PASTE = `Devastator
The devastator is an expert at battle magic. It excels at
laying down a continuous fire of destructive spells to
blast enemies from the field.
 "Devastator" is a template you can apply to any
humanoid creature to represent a spellcaster trained
for war. If you are modifying a nonplayer character,
this template works best with the cleric, warlock, and
wizard classes.
Prerequisite: Humanoid
Devastator Elite Artillery
Humanoid XP Elite
Defenses +2 AC; +2 Reflex
Saving Throws +2
Action Point 1
Hit Points +6 per level + Constitution score
POWERS
Spell Shaper
 Whenever the devastator uses a close burst or an area
attack power, it can choose up to two allies in the power's
area of effect. Those allies are not targeted by the power.
Endless Power (minor; recharge ${D6})
 The devastator regains the use of an expended encounter
power.
`;

describe("paste → validate → apply template round-trip", () => {
  it("parses Devastator paste, validates, and merges onto a base monster with expected delta", () => {
    const parsed = parsePastedMonsterTemplateTextLocal(DEVASTATOR_PASTE, "Devastator");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.template.keywords).toEqual(["Humanoid"]);
    expect(parsed.template.powers.some((p) => p.name === "Endless Power")).toBe(true);
    expect(parsed.validation.errors).toEqual([]);
    expect(parsed.validation.warnings.length).toBeGreaterThanOrEqual(0);

    const base = baseMonster();
    const delta = computeTemplateApplicationDelta(base, parsed.template);
    expect(delta.addedPowerNames).toContain("Endless Power");

    const merged = applyMonsterTemplateToEntry(base, parsed.template);
    expect(merged.powers?.map((p) => p.name)).toContain("Endless Power");
    expect(merged.keywords?.map((k) => k.toLowerCase())).toContain("humanoid");
  });

  it("surfaces validation warnings for uncategorized ability stubs", () => {
    const stub: MonsterTemplateRecord = {
      templateName: "Test Stub",
      sourceBook: "test",
      roleLine: "Elite Soldier",
      traits: [],
      auras: [],
      powers: [{ name: "Real Power", usage: "At-Will", action: "Standard", keywords: "", description: "x" }],
      uncategorizedAbilities: [
        { name: "orphaned fragment text", usage: "At-Will", action: "Standard", keywords: "", description: "" }
      ]
    };
    const v = validateMonsterTemplateImport(stub);
    expect(v.errors).toEqual([]);
    expect(v.warnings.some((w) => w.includes("partially categorized"))).toBe(true);
  });
});

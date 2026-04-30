import { describe, expect, it } from "vitest";
import { parsePastedMonsterTemplateTextLocal } from "./pasteMonsterTemplateEtl";

/** Unicode dice U+2684 / U+2685 — embed literally so tests match book text. */
const D5 = "\u2684";
const D6 = "\u2685";

const DEVASTATOR_BLOCK = `Devastator
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

const DEMAGOGUE_BLOCK = `Demagogue
This template portrays a villain with overwhelming
force of personality who desires to manipulate and use
others. Its followers are utter fanatics dedicated to the
cause, no matter the price—even death or worse.
 "Demagogue" is a template you can apply to any
humanoid or magical beast to represent the leader of
an evil organization or group. Any NPC or monster
that leads and uses others is a good fit for this template.
Prerequisite: Humanoid or magical beast
Demagogue Elite Controller (Leader)
Humanoid or magical beast XP Elite
Defenses +2 Fortitude; +4 Will; +4 to all defenses against
charm and fear effects
Saving Throws +2
Action Point 1
Hit Points +8 per level + Constitution score
POWERS
Deathless Fanaticism aura 5
Lower-level allies (other than minions) in the aura remain alive when reduced to 0 hit points. An affected
creature dies at the end of its next turn if it is still at 0 hit
points or below.
Mob Defense
 The demagogue gains a +1 bonus to all defenses for each
ally adjacent to it.
Clever Escape (move; recharge ${D5} ${D6})
 The demagogue moves up to twice its speed. It can move
only into squares that take it farther away from its enemies.
This movement does not provoke opportunity attacks.
`;

describe("parsePastedMonsterTemplateTextLocal recharge usageDetails from Unicode dice", () => {
  it("Endless Power: single ⚅ → usageDetails 6 (recharge on 6)", () => {
    const r = parsePastedMonsterTemplateTextLocal(DEVASTATOR_BLOCK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const endless = r.template.powers.find((p) => p.name === "Endless Power");
    expect(endless).toBeDefined();
    expect(endless!.usage).toBe("Recharge");
    expect(endless!.usageDetails).toBe("6");
    expect(endless!.action.toLowerCase()).toBe("minor");
  });

  it("Clever Escape: ⚄ ⚅ → usageDetails 5 (lowest face = recharge threshold)", () => {
    const r = parsePastedMonsterTemplateTextLocal(DEMAGOGUE_BLOCK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const clever = r.template.powers.find((p) => p.name === "Clever Escape");
    expect(clever).toBeDefined();
    expect(clever!.usage).toBe("Recharge");
    expect(clever!.usageDetails).toBe("5");
    expect(clever!.action.toLowerCase()).toBe("move");
  });

  it("parses conditional saving throw bonuses into structured stats", () => {
    const block = `Fear Knight
Prerequisite: Humanoid
Fear Knight Elite Soldier
Humanoid XP Elite
Saving Throws +2; +4 against fear and charm effects
Hit Points +8 per level + Constitution score
POWERS
M Strike (standard; at-will)
Melee 1; +3 vs AC; 1d8 damage.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Fear Knight");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const st = (r.template.stats as {
      savingThrows?: { value?: number; conditionalBonuses?: Array<{ value: number; when: string; sourceLine?: string }> };
    })?.savingThrows;
    expect(st?.value).toBe(2);
    expect(st?.conditionalBonuses).toEqual([
      {
        value: 4,
        when: "fear and charm effects",
        conditions: ["fear", "charm effects"],
        sourceLine: "Saving Throws +2; +4 against fear and charm effects"
      }
    ]);
  });

  it("handles diverse saving throw special-case formats", () => {
    const cases: Array<{
      line: string;
      expected: Record<string, unknown>;
    }> = [
      {
        line: "Saving Throws +2 against immobilized, restrained, and slowed",
        expected: {
          conditionalBonuses: [
            {
              value: 2,
              when: "immobilized, restrained, and slowed",
              conditions: ["immobilized", "restrained", "slowed"]
            }
          ]
        }
      },
      { line: "Saving Throws see twist free", expected: { references: ["twist free"] } },
      { line: "Saving Throws +2; see also twist free", expected: { value: 2, references: ["twist free"] } },
      {
        line: "Saving Throws +5 against charm eff ects",
        expected: {
          conditionalBonuses: [{ value: 5, when: "charm effects", conditions: ["charm effects"] }]
        }
      },
      {
        line: "Saving Throws +2 (+5 against charm effects)",
        expected: {
          value: 2,
          conditionalBonuses: [{ value: 5, when: "charm effects", conditions: ["charm effects"] }]
        }
      },
      {
        line: "Saving Throws +2 against charm effects, immobilized, restrained, and slowed",
        expected: {
          conditionalBonuses: [
            {
              value: 2,
              when: "charm effects, immobilized, restrained, and slowed",
              conditions: ["charm effects", "immobilized", "restrained", "slowed"]
            }
          ]
        }
      },
      {
        line: "Saving Throws +2 (+4 against charm eff ects, immobilized, restrained, and slowed)",
        expected: {
          value: 2,
          conditionalBonuses: [
            {
              value: 4,
              when: "charm effects, immobilized, restrained, and slowed",
              conditions: ["charm effects", "immobilized", "restrained", "slowed"]
            }
          ]
        }
      },
      {
        line: "Saving Throws +2 against ongoing damage",
        expected: {
          conditionalBonuses: [{ value: 2, when: "ongoing damage", conditions: ["ongoing damage"] }]
        }
      },
      {
        line: "Saving Throws +2 (+4 against ongoing damage)",
        expected: {
          value: 2,
          conditionalBonuses: [{ value: 4, when: "ongoing damage", conditions: ["ongoing damage"] }]
        }
      }
    ];

    for (const row of cases) {
      const block = `Fear Knight
Prerequisite: Humanoid
Fear Knight Elite Soldier
Humanoid XP Elite
${row.line}
Hit Points +8 per level + Constitution score
POWERS
M Strike (standard; at-will)
Melee 1; +3 vs AC; 1d8 damage.`;
      const r = parsePastedMonsterTemplateTextLocal(block, "Fear Knight");
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const st = (r.template.stats as { savingThrows?: Record<string, unknown> })?.savingThrows;
      expect(st).toBeDefined();
      const normalized = {
        ...(typeof st?.value === "number" ? { value: st.value } : {}),
        ...(Array.isArray(st?.conditionalBonuses)
          ? {
              conditionalBonuses: st.conditionalBonuses.map((x) => ({
                value: (x as { value: number }).value,
                when: (x as { when: string }).when,
                ...(Array.isArray((x as { conditions?: string[] }).conditions)
                  ? { conditions: (x as { conditions: string[] }).conditions }
                  : {})
              }))
            }
          : {}),
        ...(Array.isArray(st?.references) ? { references: st.references } : {})
      };
      expect(normalized).toEqual(row.expected);
    }
  });

});

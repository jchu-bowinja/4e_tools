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
});

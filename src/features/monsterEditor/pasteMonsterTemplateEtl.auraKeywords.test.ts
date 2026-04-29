import { describe, expect, it } from "vitest";
import { parsePastedMonsterTemplateTextLocal } from "./pasteMonsterTemplateEtl";

/** Fear aura block (unicode Fear + dice faces optional in book — keywords only here). */
const FEAR_OF_WORMS_BLOCK = `Worm Knight Elite Soldier
Humanoid XP Elite
Defenses +1 AC
Saving Throws +2
Hit Points +8 per level + Constitution score
POWERS
Keyword fear
Fear of Worms (Fear) aura 3; any living creature that
starts its turn within the aura takes a –2 penalty to attack
rolls against nonworm creatures.
`;

const NECROTIC_TRAIT_BLOCK = `Relentless Killer Elite Brute
Humanoid XP Elite
Defenses +2 AC
Hit Points +10 per level + Constitution score
POWERS
Death's Release (when the relentless killer is reduced to 0 hit points or fewer) \u2726 Necrotic
The killer explodes in a burst of shadow.
`;

describe("template aura/trait keywords", () => {
  it("captures ✦ keyword on traits (e.g. Necrotic)", () => {
    const r = parsePastedMonsterTemplateTextLocal(NECROTIC_TRAIT_BLOCK, "Relentless Killer");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const trait = r.template.traits?.find((t) => String(t.name).includes("Death"));
    expect(trait).toBeDefined();
    expect(trait!.keywords?.map((k) => k.toLowerCase())).toContain("necrotic");
  });

  it("captures Keyword line + parenthetical keyword on aura", () => {
    const r = parsePastedMonsterTemplateTextLocal(FEAR_OF_WORMS_BLOCK, "Worm Knight");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const aura = r.template.auras?.find((a) => String(a.name).includes("Fear of Worms"));
    expect(aura).toBeDefined();
    expect(aura!.keywords?.sort()).toEqual(["Fear"]);
  });
});

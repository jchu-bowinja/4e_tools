import { describe, expect, it } from "vitest";
import type { MonsterTemplatePasteHitPointsOptionB } from "./storage";
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

  it("parses numbered section-style template blocks", () => {
    const block = `Spawn of Kyuss
A spawn of Kyuss is created when an infection from a
particular species of necrotic burrowing worms kills
its host and transforms the creature into an undead
monstrosity.
Prerequisites: Level 11, and beast, humanoid, or magical beast.

Statblock with roleline and statLines
Spawn of Kyuss Elite Soldier
(undead) XP Elite
Defenses +2 AC; +2 Fortitude, +2 Will
Saving Throws +2
Action Points 1
Hit Points +8 per level + Constitution score

And multiple powers, traits, aura parser blocks that start with 1 but have a control to add more
[ABILITY]
Fear of Worms (Fear) aura 3; any living creature that starts its turn within the aura.
[ABILITY]
M Touch of Kyuss (standard; recharge ⚄ ⚅) ✦ Disease, Necrotic
Spawn of Kyuss's level + 3 vs. Fortitude; 2d6 + Constitution modifier damage.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Spawn of Kyuss");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.template.templateName).toBe("Spawn Of Kyuss");
    expect(r.template.prerequisite).toContain("Level 11");
    expect(r.template.roleLine).toContain("Elite Soldier");
    expect(r.template.statLines?.some((line) => line.includes("[ABILITY]"))).toBe(false);
    expect(r.template.auras?.some((a) => a.name.includes("Fear of Worms"))).toBe(true);
    expect(r.template.powers?.some((p) => p.name.includes("Touch of Kyuss"))).toBe(true);
  });

  it("captures wrapped prerequisite up to role line and keeps Regeneration as stat line", () => {
    const block = `Spawn of Kyuss
A spawn of Kyuss is created when an infection from a
particular species of necrotic burrowing worms kills
its host and transforms the creature into an undead
monstrosity.
Prerequisites: Level 11, and beast, humanoid, or
magical beast.
Spawn of Kyuss Elite Soldier
(undead) XP Elite
Defenses +2 AC; +2 Fortitude, +2 Will
Immune disease, poison
Saving Throws +2
Action Points 1
Hit Points +8 per level + Constitution score
Regeneration 10 (if a spawn of Kyuss takes radiant damage, regeneration doesn’t function until the end of its next turn)
Fear of Worms (Fear) aura 3; any living creature that starts its turn within the aura.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Spawn of Kyuss");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.template.prerequisite).toBe("Level 11, and beast, humanoid, or magical beast.");
    expect(r.template.description).not.toContain("magical beast.");
    const regenLine = r.template.statLines?.find((line) => /^Regeneration\b/i.test(line));
    expect(regenLine).toBeUndefined();
    const regenTrait = r.template.traits?.find((t) => /^Regeneration\b/i.test(t.name));
    expect(regenTrait).toBeDefined();
    expect((r.template.stats as { immunities?: string[] } | undefined)?.immunities).toEqual(["disease", "poison"]);
  });

  it("captures stat lines with Defenses variants and HP alias", () => {
    const block = `Spirit Possessed
Some spirits can inhabit and control living creatures.
Prerequisites: Living creature, level 11, Charisma 13
Spirit Possessed Elite Controller
(undead) XP Elite
Defenses Will +4
Initiative +8
Speed 6
Skills Arcana +10, Insight +9
Resist 10 necrotic at 11th level, 15 necrotic at 21st level
Vulnerable 10 radiant at 11th level, 15 radiant at 21st level
Saving Throws +2
Action Points 1
HP +8 per level + Constitution score
C Psychic Assault (minor 1/round; at-will) ✦ Psychic
Close burst 10; targets one creature; spirit possessed's level + 2 vs. Will; 1d6 + Charisma modifier psychic damage.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Spirit Possessed");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const statLines = r.template.statLines ?? [];
    expect(statLines).toContain("Defenses Will +4");
    expect(statLines).toContain("Initiative +8");
    expect(statLines).toContain("Speed 6");
    expect(statLines).toContain("Skills Arcana +10, Insight +9");
    expect(statLines).toContain("Resist 10 necrotic at 11th level, 15 necrotic at 21st level");
    expect(statLines).toContain("Vulnerable 10 radiant at 11th level, 15 radiant at 21st level");
    expect(statLines).toContain("Saving Throws +2");
    expect(statLines).toContain("Action Points 1");
    expect(statLines).toContain("HP +8 per level + Constitution score");
    const stats = r.template.stats as
      | {
          hitPoints?: { default?: { perLevel?: number } };
          initiative?: { value: number };
          speed?: { raw: string };
        }
      | undefined;
    expect(stats?.initiative?.value).toBe(8);
    expect(stats?.speed?.raw).toBe("6");
    expect(stats?.hitPoints?.default?.perLevel).toBe(8);
  });

  it("keeps regeneration parenthetical and aura semicolon lead text in details", () => {
    const block = `Spawn of Kyuss Elite Soldier
Humanoid XP Elite
Hit Points +8 per level + Constitution score
[ABILITY]
Regeneration 10: (if a spawn of Kyuss takes radiant damage,
regeneration doesn't function until the end of its next turn)
[ABILITY]
Fear of Worms (Fear) aura 3; any living creature that
starts its turn within the aura takes a –2 penalty to attack
rolls against spawn of Kyuss, larva undead, wormspawn
praetorians, and Kyuss.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Spawn of Kyuss");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const regen = r.template.traits?.find((t) => /^Regeneration\b/i.test(t.name));
    expect(regen).toBeDefined();
    expect(regen!.name).toBe("Regeneration 10");
    expect(regen!.details).toContain("if a spawn of Kyuss takes radiant damage, regeneration doesn't function until the end of its next turn");
    expect(regen!.details.startsWith("(")).toBe(false);
    const stats = r.template.stats as { regeneration?: number } | undefined;
    expect(stats?.regeneration).toBe(10);
    const aura = r.template.auras?.find((a) => a.name.includes("Fear of Worms"));
    expect(aura).toBeDefined();
    expect(aura!.details).toContain("any living creature that starts its turn within the aura");
  });

  it("captures next-line keyword after trailing ✦ and keeps full description", () => {
    const block = `Shadow Spirit Elite Lurker
Humanoid XP Elite
Hit Points +6 per level + Constitution score
[ABILITY]
Step Through the Shadows (move; recharge ⚄ ⚅) ✦
Teleportation
The shadow spirit teleports up to 3 squares. The origin and
destination space must be in dim light or darkness.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Shadow Spirit");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.template.powers.find((x) => x.name === "Step Through the Shadows");
    expect(p).toBeDefined();
    expect(p!.keywordTokens).toEqual(["Teleportation"]);
    expect(p!.description).toContain("The shadow spirit teleports up to 3 squares.");
    expect(p!.description).toContain("destination space must be in dim light or darkness.");
  });

  it("captures trailing Skills line into statLines even after abilities", () => {
    const block = `Shadow Spirit Elite Lurker
Humanoid XP Elite
Initiative +2
Hit Points +6 per level + Constitution score
[ABILITY]
Step Through the Shadows (move; recharge ⚄ ⚅) ✦
Teleportation
The shadow spirit teleports up to 3 squares.
Skills +4 Stealth`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Shadow Spirit");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.template.statLines).toContain("Skills +4 Stealth");
  });

  it("splits with [ABILITYEND] closing one block before the next [ABILITY]", () => {
    const block = `Scaffold Split Elite Soldier
Humanoid XP Elite
Hit Points +8 per level + Constitution score
[ABILITY]
Warding Aura (Radiant) aura 5; allies gain +1 to saves.
[ABILITYEND]
[ABILITY]
M Bash (standard; at-will)
Melee 1; +5 vs AC; 1d6 damage.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Scaffold Split");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.template.auras?.some((a) => String(a.name).includes("Warding Aura"))).toBe(true);
    expect(r.template.powers?.some((p) => String(p.name).includes("Bash"))).toBe(true);
  });

  it("parses Skills numeric and training formats into stats.skills", () => {
    const plusAfter = parsePastedMonsterTemplateTextLocal(
      `Shadow Spirit Elite Lurker
Humanoid XP Elite
Hit Points +6 per level + Constitution score
Skills Stealth +4`,
      "Shadow Spirit"
    );
    expect(plusAfter.ok).toBe(true);
    if (!plusAfter.ok) return;
    const statsA = plusAfter.template.stats as
      | { skills?: { entries: Array<{ skill: string; value: number; trained: boolean }> } }
      | undefined;
    expect(statsA?.skills?.entries).toEqual([{ skill: "stealth", value: 4, trained: false, sourceLine: "Skills Stealth +4" }]);

    const plusBefore = parsePastedMonsterTemplateTextLocal(
      `Shadow Spirit Elite Lurker
Humanoid XP Elite
Hit Points +6 per level + Constitution score
Skills +4 Stealth`,
      "Shadow Spirit"
    );
    expect(plusBefore.ok).toBe(true);
    if (!plusBefore.ok) return;
    const statsB = plusBefore.template.stats as
      | { skills?: { entries: Array<{ skill: string; value: number; trained: boolean }> } }
      | undefined;
    expect(statsB?.skills?.entries).toEqual([{ skill: "stealth", value: 4, trained: false, sourceLine: "Skills +4 Stealth" }]);

    const trained = parsePastedMonsterTemplateTextLocal(
      `Gruuled Veteran Elite Soldier
Humanoid XP Elite
Hit Points +8 per level + Constitution score
Skills The gruuled veteran gains training in Bluff`,
      "Gruuled Veteran"
    );
    expect(trained.ok).toBe(true);
    if (!trained.ok) return;
    const statsC = trained.template.stats as
      | { skills?: { entries: Array<{ skill: string; value: number; trained: boolean }> } }
      | undefined;
    expect(statsC?.skills?.entries).toEqual([
      { skill: "bluff", value: 0, trained: true, sourceLine: "Skills The gruuled veteran gains training in Bluff" }
    ]);
  });

  it("parses typed speed values (e.g. fly with hover) into stats.speed", () => {
    const r = parsePastedMonsterTemplateTextLocal(
      `Shadow Spirit Elite Lurker
Humanoid XP Elite
Hit Points +6 per level + Constitution score
Speed fly 8 (hover)`,
      "Shadow Spirit"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stats = r.template.stats as { speed?: { raw: string } } | undefined;
    expect(stats?.speed?.raw).toBe("fly 8 (hover)");
  });

  it("parses Senses stat lines", () => {
    const r = parsePastedMonsterTemplateTextLocal(
      `Test Elite Soldier
Humanoid XP Elite
Senses Darkvision
Hit Points +8 per level + Constitution score`,
      "Test"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stats = r.template.stats as { senses?: { raw: string }; unparsedStatLines?: string[] } | undefined;
    expect(stats?.senses?.raw).toBe("Darkvision");
    expect(stats?.unparsedStatLines).toBeUndefined();
  });

  it("parses resist and vulnerable lines into tier arrays", () => {
    const r = parsePastedMonsterTemplateTextLocal(
      `Shadow Spirit Elite Lurker
Humanoid XP Elite
Hit Points +6 per level + Constitution score
Resist 5 necrotic at 1st level, 10 necrotic at 11th level, 15 necrotic at 21st level, insubstantial
Vulnerable 5 radiant at 1st level, 10 radiant at 11th level, 15 radiant at 21st level`,
      "Shadow Spirit"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stats = r.template.stats as
      | {
          resistances?: { entries: Array<{ kind: string; type?: string; tiers?: Record<string, number> }> };
          vulnerabilities?: { entries: Array<{ kind: string; type?: string; tiers?: Record<string, number> }> };
        }
      | undefined;
    expect(stats?.resistances?.entries).toEqual([
      { kind: "typed", type: "necrotic", tiers: { "1": 5, "11": 10, "21": 15 }, sourceLine: expect.any(String) },
      { kind: "keyword", type: "insubstantial", sourceLine: expect.any(String) }
    ]);
    expect(stats?.vulnerabilities?.entries).toEqual([
      { kind: "typed", type: "radiant", tiers: { "1": 5, "11": 10, "21": 15 }, sourceLine: expect.any(String) }
    ]);
  });

  it("merges wrapped resist continuation with capital At into one stat line (full variable resist)", () => {
    const block = `Demonic Acolyte
Prerequisite: Humanoid or magical beast
Demonic Acolyte Elite Controller (Leader)
Humanoid or magical beast (demon) XP Elite
Defenses +1 AC; +2 Fortitude; +2 Will
Resist 5 (choose one type) at 1st level, 10 (choose two types)
At 11th level, 15 (choose three types) at 21st level
Saving Throws +2
Action Point 1
Hit Points +8 per level + Constitution score
POWERS
Shield of Abyssal Majesty aura 5`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Demonic Acolyte");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const resistLine = r.template.statLines?.find((l) => /^Resist\b/i.test(l));
    expect(resistLine).toBeDefined();
    expect(resistLine).toContain("15 (choose three types)");
    const entries =
      (r.template.stats as { resistances?: { entries: unknown[] } } | undefined)?.resistances?.entries ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "variable",
      tiers: { "1": 5, "11": 10, "21": 15 }
    });
  });

  it("parses variable choose-type resistance (Demonic Acolyte), including wrapped lines", () => {
    const oneLine = parsePastedMonsterTemplateTextLocal(
      `Test Elite Soldier
Humanoid XP Elite
Resist 5 (choose one type) at 1st level, 10 (choose two types) at 11th level, 15 (choose three types) at 21st level
Hit Points +8 per level + Constitution score`,
      "Test"
    );
    expect(oneLine.ok).toBe(true);
    if (!oneLine.ok) return;
    const entries =
      (oneLine.template.stats as { resistances?: { entries: unknown[] } } | undefined)?.resistances?.entries ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "variable",
      tiers: { "1": 5, "11": 10, "21": 15 },
      tierRiders: {
        "1": "choose one type",
        "11": "choose two types",
        "21": "choose three types"
      }
    });

    const wrapped = parsePastedMonsterTemplateTextLocal(
      `Test Elite Soldier
Humanoid XP Elite
Resist 5 (choose one type) at 1st level, 10 (choose two types)
at 11th level, 15 (choose three types) at 21st level
Hit Points +8 per level + Constitution score`,
      "Test"
    );
    expect(wrapped.ok).toBe(true);
    if (!wrapped.ok) return;
    const wEntries =
      (wrapped.template.stats as { resistances?: { entries: unknown[] } } | undefined)?.resistances?.entries ?? [];
    expect(wEntries).toHaveLength(1);
    expect(wEntries[0]).toMatchObject({
      kind: "variable",
      tiers: { "1": 5, "11": 10, "21": 15 }
    });
  });

  it("parses mixed fixed and tiered resistances", () => {
    const r = parsePastedMonsterTemplateTextLocal(
      `Shadow Spirit Elite Lurker
Humanoid XP Elite
Hit Points +6 per level + Constitution score
Resist 5 radiant, 5 necrotic at 1st level, 10 necrotic at 11th level`,
      "Shadow Spirit"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stats = r.template.stats as {
      resistances?: { entries: Array<{ kind: string; type?: string; tiers?: Record<string, number> }> };
    } | undefined;
    expect(stats?.resistances?.entries).toEqual([
      { kind: "typed", type: "radiant", tiers: { "1": 5, "11": 5, "21": 5 }, sourceLine: expect.any(String) },
      { kind: "typed", type: "necrotic", tiers: { "1": 5, "11": 10, "21": 10 }, sourceLine: expect.any(String) }
    ]);
  });

  it("parses Hit Points with role-specific formulas into default + variants", () => {
    const r = parsePastedMonsterTemplateTextLocal(
      `Dual Role Elite Controller
Humanoid XP Elite
Hit Points +8 per level + Constitution score (controller) or +6 per level + Constitution score (artillery)`,
      "Dual Role"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hp = (r.template.stats as { hitPoints?: MonsterTemplatePasteHitPointsOptionB } | undefined)?.hitPoints;
    expect(hp?.variants?.length).toBe(2);
    expect(hp?.variants?.[0]?.when?.role).toBe("controller");
    expect(hp?.variants?.[0]?.perLevel).toBe(8);
    expect(hp?.variants?.[1]?.when?.role).toBe("artillery");
    expect(hp?.variants?.[1]?.perLevel).toBe(6);
    expect(hp?.default).toBeUndefined();
  });

  it("merges name + following Aura N line into one aura (Death Knight Marshal Undead layout)", () => {
    const block = `Death Knight Elite Soldier (Leader)
(undead) XP Elite
Senses Darkvision
Defenses +2 AC; +4 Fortitude; +2 Will
Immune disease, poison
Resist 10 necrotic at 11th level, 15 necrotic at 21st level
Vulnerable 10 radiant
Saving Throws +2
Action Point 1
Hit Points +8 per level + Constitution score
POWERS
Marshal Undead
 Aura 10; lower-level undead allies in the aura gain a +2
bonus to their attack rolls.
Soul Weapon ✦ Necrotic, Weapon
 When attacking with its melee weapon, the death knight
deals an additional 5 necrotic damage to its target.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Death Knight");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const marshal = r.template.auras?.find((a) => a.name.toLowerCase().includes("marshal"));
    expect(marshal).toBeDefined();
    expect(r.template.traits?.some((t) => t.name.toLowerCase().includes("marshal"))).toBe(false);
    expect(String(marshal?.details ?? "")).toMatch(/lower-level undead|\+2/);
  });

  it("keeps one aura when effect text says 'in the aura' on the next line (Demonic Acolyte layout)", () => {
    const block = `Demonic Acolyte Elite Controller (Leader)
Humanoid or magical beast (demon) XP Elite
Defenses +1 AC
Hit Points +8 per level + Constitution score
POWERS
Shield of Abyssal Majesty aura 5
Allies in the aura gain the demonic acolyte's
resistance(s).
Abyssal Might
 The demonic acolyte gains a +2 power bonus to damage rolls.`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Demonic Acolyte");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.template.auras?.length).toBe(1);
    expect(r.template.auras?.[0]?.name).toContain("Shield of Abyssal Majesty");
    expect(String(r.template.auras?.[0]?.details ?? "")).toContain("Allies in the aura");
    const abyssal =
      r.template.powers.find((p) => String(p.name).includes("Abyssal Might")) ??
      r.template.traits?.find((tr) => String(tr.name).includes("Abyssal Might"));
    expect(abyssal).toBeDefined();
  });

  it("merges Hit Points broken after `or` across lines (Lich-style layout)", () => {
    const block = `Lich Elite Controller or Artillery
(undead) XP Elite
Hit Points +8 per level + Constitution score (controller) or
+6 per level + Constitution score (artillery)
Saving Throws +2`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Lich");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.template.statLines?.some((l) => l.includes("Hit Points") && l.includes("+6 per level"))).toBe(true);
    const hp = (r.template.stats as { hitPoints?: MonsterTemplatePasteHitPointsOptionB } | undefined)?.hitPoints;
    expect(hp?.variants?.length).toBe(2);
    expect(hp?.variants?.[0]?.when?.role).toBe("controller");
    expect(hp?.variants?.[1]?.when?.role).toBe("artillery");
  });

  it("classifies Bodyguard Indomitable Presence as a trait (no header usage/action; ‘whenever’ in prose)", () => {
    const block = `Bodyguard Elite Soldier
Humanoid XP Elite
Defenses +2 AC; +2 Fortitude, +1 Reflex, +1 Will
Saving Throws +2
Action Point 1
Hit Points +8 per level + Constitution score
POWERS
[ABILITY]
Indomitable Presence
 Every time a bodyguard attacks an enemy, whether the
attack hits or misses, it marks that target. The mark lasts
until the end of the bodyguard's next turn. When a target
is marked, it takes a –2 penalty to attack rolls if the attack
doesn't include the bodyguard as a target. A creature
can be subject to only one mark at a time. A new mark
supersedes a mark that was already in place.
 In addition, whenever a marked enemy that is
adjacent to the bodyguard shifts or makes an attack that
does not include the bodyguard, the bodyguard can make
a basic melee attack against that enemy as an immediate
interrupt.
[ABILITY]
Shieldbearer
 Allies adjacent to the bodyguard gain a +2 power bonus to
AC.
[ABILITYEND]`;
    const r = parsePastedMonsterTemplateTextLocal(block, "Bodyguard");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const indom = r.template.traits?.find((t) => t.name.includes("Indomitable"));
    expect(indom).toBeDefined();
    expect(r.template.powers?.some((p) => p.name.includes("Indomitable"))).toBe(false);
    expect(r.template.uncategorizedAbilities?.some((p) => p.name.includes("Indomitable"))).toBeFalsy();
    const shield = r.template.traits?.find((t) => t.name.includes("Shieldbearer"));
    expect(shield).toBeDefined();
    expect(r.validation.errors).toEqual([]);
  });
});


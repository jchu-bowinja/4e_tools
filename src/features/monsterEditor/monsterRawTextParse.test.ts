import { describe, expect, it } from "vitest";
import { parseMonsterStatBlockText } from "./monsterRawTextParse";

const FELDRAKE = `Leaping Felldrake Level 1 Lurker
Small natural beast (reptile) XP 100
HP 26; Bloodied 13 Initiative +7
AC 15, Fortitude 12, Reflex 15, Will 13 Perception +7
Speed 6, climb 6
STANDARD ACTIONS
5 Bite ✦ At-Will
Attack: Melee 1 (one creature); +6 vs. AC
Hit: 1d4 + 4 damage.
Str 10 (+0) Dex 17 (+3) Wis 15 (+2)
Con 14 (+2) Int 3 (–4) Cha 11 (+0)
Alignment unaligned Languages —
`;

describe("parseMonsterStatBlockText", () => {
  it("applies optional monster name hint (overrides title and import id)", () => {
    const r = parseMonsterStatBlockText(FELDRAKE, "Renamed Felldrake");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.name).toBe("Renamed Felldrake");
    expect(r.entry.id.startsWith("import-renamed-felldrake-")).toBe(true);
  });

  it("parses a compact lurker stat block", () => {
    const r = parseMonsterStatBlockText(FELDRAKE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.name).toBe("Leaping Felldrake");
    expect(r.entry.level).toBe(1);
    expect(r.entry.role).toBe("Lurker");
    expect(r.entry.stats.defenses.AC).toBe(15);
    expect(r.entry.stats.otherNumbers.HP).toBe(26);
    expect(r.entry.powers.length).toBeGreaterThan(0);
    expect(r.entry.powers[0].name).toMatch(/Bite/i);
  });

  it("parses solo brute header and resist line", () => {
    const text = `Bitterstrike Level 10 Solo Brute
Large natural magical beast (dragon) XP 2,500
HP 520; Bloodied 260 Initiative +6
AC 22, Fortitude 23, Reflex 20, Will 21 Perception +12
Speed 6 (ice walk), fly 6 Darkvision
Resist 10 cold
Saving Throws +5; Action Points 2
TRAITS
Action Recovery
Whenever Bitterstrike ends her turn, any dazing effect on her ends.

STANDARD ACTIONS
5 Bite (cold) ✦ At-Will
Attack: Melee 2 (one creature); +15 vs. AC
Hit: 3d10 + 6 cold damage.
`;
    const r = parseMonsterStatBlockText(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.groupRole).toBe("Solo");
    expect(r.entry.resistances?.[0]?.amount).toBe(10);
    expect(r.entry.traits?.some((t) => /Action Recovery/i.test(String(t.name)))).toBe(true);
  });

  it("parses MM3-style blocks (initiative/senses, m-powers, AC; defenses)", () => {
    const text = `Azer Warrior Level 17 Minion
Medium elemental humanoid (fire) XP 400
Initiative +11 Senses Perception +12
Warding Flame (Fire) Any enemy adjacent to two or more azers at the start of its turn takes 5 fire damage.
HP 1; a missed attack never damages a minion.
AC 31; Fortitude 30, Reflex 26, Will 27
Resist 20 fire
Speed 5
m Warhammer (standard; at-will) ✦ Fire, Weapon
+20 vs. AC; 7 fire damage, and ongoing 3 fire damage (save ends).
Alignment Unaligned Languages Giant
Str 21 (+13) Dex 17 (+11) Wis 18 (+12)
Con 23 (+14) Int 11 (+8) Cha 16 (+11)
Equipment chainmail, light shield, warhammer
`;
    const r = parseMonsterStatBlockText(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.role).toMatch(/Minion/i);
    expect(r.entry.stats.otherNumbers.HP).toBe(1);
    expect(r.entry.stats.defenses.AC).toBe(31);
    expect(r.entry.traits?.some((t) => /Warding Flame/i.test(String(t.name)))).toBe(true);
    expect(r.entry.powers.some((p) => /Warhammer/i.test(p.name))).toBe(true);
    expect(r.entry.sections && "layout" in r.entry.sections && r.entry.sections.layout).toBe("mm3");
  });

  it("parses combined resist and vulnerable on one line", () => {
    const text = `X Level 18 Elite Controller
Medium natural humanoid XP 100
HP 100; Bloodied 50 Initiative +0
AC 20, Fortitude 20, Reflex 20, Will 20 Perception +0
Speed 6
Resist 10 cold; Vulnerable 5 fire
STANDARD ACTIONS
5 Slam ✦ At-Will
Hit: 1 damage.
Str 10 (+0) Dex 10 (+0) Wis 10 (+0)
Con 10 (+0) Int 10 (+0) Cha 10 (+0)
Alignment evil Languages Common
`;
    const r = parseMonsterStatBlockText(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.weaknesses?.[0]?.name).toMatch(/fire/i);
  });
});

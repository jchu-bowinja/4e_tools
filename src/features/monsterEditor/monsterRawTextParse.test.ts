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

  it("parses MM3 senses: Perception strip; truesight range; low-light vision range 0", () => {
    const cyclops = `Cyclops Guard Level 14 Minion
Large fey humanoid XP 250
Initiative +8 Senses Perception +13; truesight 6
HP 1; a missed attack never damages a minion.
AC 27; Fortitude 26, Refl ex 23, Will 23
Speed 6
m Battleaxe (standard; at-will) ✦ Weapon
 Reach 2; +17 vs. AC; 7 damage.
Alignment Unaligned Languages Elven
Str 22 (+11) Dex 16 (+8) Wis 17 (+8)
Con 20 (+10) Int 11 (+5) Cha 11 (+5)
`;
    const r1 = parseMonsterStatBlockText(cyclops);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.entry.senses).toEqual([{ name: "truesight", range: 6 }]);
    expect(String(r1.entry.stats.otherNumbers.perception)).toMatch(/^\+?13$/);

    const choker = `Feygrove Choker Level 12 Lurker
Medium fey humanoid XP 700
Initiative +14 Senses Perception +7; low-light vision
HP 91; Bloodied 45
AC 24; Fortitude 22, Refl ex 22, Will 19
Speed 8 (forest walk), climb 8 (spider climb)
m Tentacle Claw (standard; at-will)
 Reach 3; +17 vs. AC; 2d6 + 4 damage.
Alignment Unaligned Languages Elven
Str 19 (+10) Dex 18 (+10) Wis 13 (+7)
Con 13 (+7) Int 6 (+4) Cha 6 (+4)
`;
    const r2 = parseMonsterStatBlockText(choker);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.entry.senses).toEqual([{ name: "low-light vision", range: 0 }]);
  });

  it("parses Low-light vision on the Speed line (MM layout with sections)", () => {
    const treant = `Treant Vassal Level 8 Elite Soldier
Large fey magical beast (plant) XP 700
HP 182; Bloodied 91 Initiative +7
AC 24, Fortitude 21, Reflex 18, Will 22 Perception +9
Speed 8 (forest walk, ice walk) Low-light vision
Resist 5 cold
Saving Throws +2; Action Points 1
TRAITS
Threatening Reach
The treant can make opportunity attacks within 2 squares of it.
STANDARD ACTIONS
5 Slam ✦ At-Will
Attack: Melee 2 (one creature); +13 vs. AC
Hit: 1d12 + 10 damage.
Str 20 (+9) Dex 13 (+5) Wis 21 (+9)
Con 19 (+8) Int 13 (+5) Cha 11 (+4)
Alignment unaligned Languages Common
`;
    const r = parseMonsterStatBlockText(treant);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.senses).toEqual([{ name: "Low-light vision", range: 0 }]);
    expect((r.entry.sections as { layout?: string } | undefined)?.layout).not.toBe("mm3");
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

  it("parses structured saving throw conditionals in standard layout", () => {
    const text = `Warden Shade Level 12 Elite Soldier
Medium shadow humanoid XP 1400
HP 120; Bloodied 60 Initiative +10
AC 28, Fortitude 25, Reflex 24, Will 26 Perception +11
Speed 6
Saving Throws +2 (+4 against ongoing damage); Action Points 1
STANDARD ACTIONS
5 Shade Blade ✦ At-Will
Attack: Melee 1 (one creature); +17 vs. AC
Hit: 1d8 + 7 necrotic damage.
Str 18 (+10) Dex 16 (+9) Wis 17 (+9)
Con 18 (+10) Int 13 (+7) Cha 15 (+8)
Alignment evil Languages Common
`;
    const r = parseMonsterStatBlockText(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const detail = (r.entry.stats.otherNumbers as { savingThrowsDetail?: Record<string, unknown> }).savingThrowsDetail;
    expect(detail).toBeDefined();
    expect(detail?.value).toBe(2);
    expect(detail?.conditionalBonuses).toEqual([
      {
        value: 4,
        when: "ongoing damage",
        conditions: ["ongoing damage"],
        sourceLine: "Saving Throws +2 (+4 against ongoing damage)"
      }
    ]);
    expect((r.entry.stats.otherNumbers as { actionPoints?: number }).actionPoints).toBe(1);
  });

  it("parses structured saving throw references in MM3 layout", () => {
    const text = `Azer Marshal Level 17 Minion
Medium elemental humanoid (fire) XP 400
Initiative +11 Senses Perception +12
HP 1; a missed attack never damages a minion.
AC 31; Fortitude 30, Reflex 26, Will 27
Saving Throws +2; see also twist free
Speed 5
m Warhammer (standard; at-will) ✦ Fire, Weapon
+20 vs. AC; 7 fire damage.
Alignment Unaligned Languages Giant
Str 21 (+13) Dex 17 (+11) Wis 18 (+12)
Con 23 (+14) Int 11 (+8) Cha 16 (+11)
`;
    const r = parseMonsterStatBlockText(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const detail = (r.entry.stats.otherNumbers as { savingThrowsDetail?: Record<string, unknown> }).savingThrowsDetail;
    expect(detail).toBeDefined();
    expect(detail?.value).toBe(2);
    expect(detail?.references).toEqual(["twist free"]);
    expect((r.entry.sections as { layout?: string } | undefined)?.layout).toBe("mm3");
  });
});

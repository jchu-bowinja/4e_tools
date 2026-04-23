import type { CharacterBuild, HybridClassDef, Race } from "./models";
import type { DerivedStats } from "./statCalculator";
import type { Armor } from "./models";
import { computeAcBreakdown, bodyArmorSpeedPenalty, totalArmorCheckPenalty } from "./defenseCalculator";

/** Parse "+1 Will" style lines into defense bonuses (same as standard class validator). */
export function parseHybridDefenseBonuses(
  hA: HybridClassDef | undefined,
  hB: HybridClassDef | undefined
): Partial<Record<"Fortitude" | "Reflex" | "Will", number>> | undefined {
  let combined: Partial<Record<"Fortitude" | "Reflex" | "Will", number>> | undefined;
  for (const h of [hA, hB]) {
    const txt = String(h?.bonusToDefense || "").trim();
    if (!txt) continue;
    if (!combined) combined = {};
    const defenseMatches = txt.matchAll(/([+-]\d+)\s*(Fortitude|Reflex|Will)/gi);
    for (const match of defenseMatches) {
      const value = Number(match[1]);
      const key = match[2] as "Fortitude" | "Reflex" | "Will";
      combined[key] = (combined[key] || 0) + value;
    }
  }
  return combined;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Hybrid HP per PHB3-style averaging of two hybrid components (static components averaged, matching existing app use of raw Con in HP at 1).
 */
export function hybridHpAtFirstLevel(hA: HybridClassDef | undefined, hB: HybridClassDef | undefined, conScore: number): number {
  const a = hA?.hitPointsAt1 ?? 10;
  const b = hB?.hitPointsAt1 ?? 10;
  const base = Math.floor((a + b) / 2);
  return base + conScore;
}

export function hybridHpPerLevelGain(hA: HybridClassDef | undefined, hB: HybridClassDef | undefined): number {
  const a = hA?.hitPointsPerLevel ?? 5;
  const b = hB?.hitPointsPerLevel ?? 5;
  return (a + b) / 2;
}

export function hybridHealingSurgesPerDay(hA: HybridClassDef | undefined, hB: HybridClassDef | undefined, conScore: number): number {
  const a = hA?.healingSurgesBase ?? 6;
  const b = hB?.healingSurgesBase ?? 6;
  const base = (a + b) / 2 + abilityMod(conScore);
  return Math.max(0, Math.floor(base));
}

/** Full derived stats for hybrid using averaged HP/surge and merged defense bonuses. */
export function computeHybridDerivedStats(
  build: CharacterBuild,
  race: Race | undefined,
  hA: HybridClassDef | undefined,
  hB: HybridClassDef | undefined,
  armor: Armor | undefined,
  shield: Armor | undefined,
  hybridDefenseBonuses?: Partial<Record<"Fortitude" | "Reflex" | "Will", number>>
): DerivedStats {
  const con = build.abilityScores.CON || 10;
  const dex = build.abilityScores.DEX || 10;
  const int = build.abilityScores.INT || 10;
  const str = build.abilityScores.STR || 10;
  const wis = build.abilityScores.WIS || 10;
  const cha = build.abilityScores.CHA || 10;

  const maxHp = hybridHpAtFirstLevel(hA, hB, con) + (build.level - 1) * hybridHpPerLevelGain(hA, hB);
  const healingSurgesPerDay = hybridHealingSurgesPerDay(hA, hB, con);
  const surgeValue = Math.max(1, Math.floor(maxHp / 4));

  const dexMod = abilityMod(dex);
  const intMod = abilityMod(int);
  const raceSpeed = race?.speed ?? 6;
  const spdPen = bodyArmorSpeedPenalty(armor);
  const speed = Math.max(0, raceSpeed - spdPen);

  const baseFort = 10;
  const baseRef = 10;
  const baseWill = 10;

  const mergeDef = { ...hybridDefenseBonuses };
  const acBreakdown = computeAcBreakdown(dexMod, intMod, armor, shield);
  const armorCheckPenalty = totalArmorCheckPenalty(armor, shield);

  const defenses = {
    ac: acBreakdown.total,
    fortitude:
      baseFort +
      Math.max(abilityMod(str), abilityMod(con)) +
      (mergeDef.Fortitude || 0),
    reflex:
      baseRef +
      Math.max(dexMod, intMod) +
      (mergeDef.Reflex || 0),
    will: baseWill + Math.max(abilityMod(wis), abilityMod(cha)) + (mergeDef.Will || 0)
  };

  return {
    maxHp,
    healingSurgesPerDay,
    surgeValue,
    speed,
    armorCheckPenalty,
    defenses,
    acBreakdown
  };
}

/** Merge hybrid armor/weapon/implement proficiency text for equipment validation. */
export function mergeHybridProficiencyLines(
  hA: HybridClassDef | undefined,
  hB: HybridClassDef | undefined
): { armorLine: string; weaponLine: string; implementLine: string } {
  const armor = [hA?.armorProficiencies, hB?.armorProficiencies].filter(Boolean).join(", ");
  const weapon = [hA?.weaponProficiencies, hB?.weaponProficiencies].filter(Boolean).join(", ");
  const impl = [hA?.implementText, hB?.implementText].filter(Boolean).join("; ");
  return { armorLine: armor, weaponLine: weapon, implementLine: impl };
}

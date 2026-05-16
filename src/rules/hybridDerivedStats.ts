import type { CharacterBuild, HybridClassDef, Race } from "./models";
import type { DerivedStats } from "./statCalculator";
import type { Armor } from "./models";
import { computeAcBreakdown, bodyArmorSpeedPenalty, totalArmorCheckPenalty } from "./defenseCalculator";
import type { PassiveDefenseBonuses, PassiveOtherBonuses } from "./supportStatAdds";
import { emptyPassiveOther } from "./supportStatAdds";
import { buildInitiativeBreakdown, buildNadBreakdown, buildSpeedBreakdown } from "./statScoreBreakdown";

function finiteBonus(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

const emptySupportDefense: PassiveDefenseBonuses = { ac: 0, fortitude: 0, reflex: 0, will: 0 };

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
  hybridDefenseBonuses?: Partial<Record<"Fortitude" | "Reflex" | "Will", number>>,
  supportPassiveDefense?: PassiveDefenseBonuses,
  supportPassiveOther?: PassiveOtherBonuses
): DerivedStats {
  const con = build.abilityScores.CON || 10;
  const dex = build.abilityScores.DEX || 10;
  const int = build.abilityScores.INT || 10;
  const str = build.abilityScores.STR || 10;
  const wis = build.abilityScores.WIS || 10;
  const cha = build.abilityScores.CHA || 10;

  const maxHp = hybridHpAtFirstLevel(hA, hB, con) + (build.level - 1) * hybridHpPerLevelGain(hA, hB);
  const o = supportPassiveOther ?? emptyPassiveOther();
  const healingSurgesPerDay = Math.max(0, hybridHealingSurgesPerDay(hA, hB, con) + o.healingSurgesPerDay);
  const surgeValue = Math.max(1, Math.floor(maxHp / 4));

  const dexMod = abilityMod(dex);
  const intMod = abilityMod(int);
  const raceSpeed = race?.speed ?? 6;
  const spdPen = bodyArmorSpeedPenalty(armor);
  const speedBreakdown = buildSpeedBreakdown(raceSpeed, spdPen, o.speed);
  const speed = speedBreakdown.total;

  const baseFort = 10;
  const baseRef = 10;
  const baseWill = 10;
  const halfLevel = Math.floor(build.level / 2);

  const mergeDef = { ...hybridDefenseBonuses };
  const sp = supportPassiveDefense ?? emptySupportDefense;
  const acBreakdown = computeAcBreakdown(dexMod, intMod, armor, shield, build.level, sp.ac);
  const armorCheckPenalty = totalArmorCheckPenalty(armor, shield);
  const initiativeBreakdown = buildInitiativeBreakdown(halfLevel, dexMod, o.initiative);
  const initiative = initiativeBreakdown.total;

  const fortAbility = Math.max(abilityMod(str), abilityMod(con));
  const refAbility = Math.max(dexMod, intMod);
  const willAbility = Math.max(abilityMod(wis), abilityMod(cha));
  const magicFort = finiteBonus(build.magicItemBonuses?.fortitude);
  const magicRef = finiteBonus(build.magicItemBonuses?.reflex);
  const magicWill = finiteBonus(build.magicItemBonuses?.will);
  const magicAc = finiteBonus(build.magicItemBonuses?.ac);

  const fortitudeBreakdown = buildNadBreakdown({
    halfLevel,
    abilityMod: fortAbility,
    abilityLabel: "STR/CON",
    classBonus: mergeDef.Fortitude || 0,
    supportBonus: sp.fortitude,
    magicItemBonus: magicFort
  });
  const reflexBreakdown = buildNadBreakdown({
    halfLevel,
    abilityMod: refAbility,
    abilityLabel: "DEX/INT",
    classBonus: mergeDef.Reflex || 0,
    supportBonus: sp.reflex,
    magicItemBonus: magicRef
  });
  const willBreakdown = buildNadBreakdown({
    halfLevel,
    abilityMod: willAbility,
    abilityLabel: "WIS/CHA",
    classBonus: mergeDef.Will || 0,
    supportBonus: sp.will,
    magicItemBonus: magicWill
  });

  const defenses = {
    ac: acBreakdown.total + magicAc,
    fortitude: fortitudeBreakdown.total,
    reflex: reflexBreakdown.total,
    will: willBreakdown.total
  };

  return {
    maxHp,
    healingSurgesPerDay,
    surgeValue,
    speed,
    initiative,
    armorCheckPenalty,
    defenses,
    acBreakdown,
    speedBreakdown,
    initiativeBreakdown,
    fortitudeBreakdown,
    reflexBreakdown,
    willBreakdown,
    supportPassiveOther: o
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

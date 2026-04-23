import { Armor, CharacterBuild, ClassDef, Race } from "./models";
import type { AcBreakdown } from "./defenseCalculator";
import { bodyArmorSpeedPenalty, computeAcBreakdown, totalArmorCheckPenalty } from "./defenseCalculator";

export interface DerivedStats {
  maxHp: number;
  healingSurgesPerDay: number;
  surgeValue: number;
  speed: number;
  initiative: number;
  /** Total armor check penalty from body armor + shield (for STR/DEX skills when untrained). */
  armorCheckPenalty: number;
  defenses: {
    ac: number;
    fortitude: number;
    reflex: number;
    will: number;
  };
  acBreakdown: AcBreakdown;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function computeDerivedStats(
  build: CharacterBuild,
  race: Race | undefined,
  cls: ClassDef | undefined,
  armor: Armor | undefined,
  shield: Armor | undefined,
  classDefenseBonuses?: Partial<Record<"Fortitude" | "Reflex" | "Will", number>>
): DerivedStats {
  const con = build.abilityScores.CON || 10;
  const dex = build.abilityScores.DEX || 10;
  const int = build.abilityScores.INT || 10;
  const str = build.abilityScores.STR || 10;
  const wis = build.abilityScores.WIS || 10;
  const cha = build.abilityScores.CHA || 10;

  const hpAt1 = (cls?.hitPointsAt1 || 10) + con;
  const hpPerLevel = cls?.hitPointsPerLevel || 5;
  const maxHp = hpAt1 + (build.level - 1) * hpPerLevel;
  const healingSurgesPerDay = (cls?.healingSurgesBase || 6) + abilityMod(con);
  const surgeValue = Math.max(1, Math.floor(maxHp / 4));

  const dexMod = abilityMod(dex);
  const intMod = abilityMod(int);
  const initiative = Math.floor(build.level / 2) + dexMod;
  const raceSpeed = race?.speed ?? 6;
  const spdPen = bodyArmorSpeedPenalty(armor);
  const speed = Math.max(0, raceSpeed - spdPen);

  const baseFort = 10;
  const baseRef = 10;
  const baseWill = 10;

  const acBreakdown = computeAcBreakdown(dexMod, intMod, armor, shield);
  const armorCheckPenalty = totalArmorCheckPenalty(armor, shield);

  const defenses = {
    ac: acBreakdown.total,
    fortitude:
      baseFort +
      Math.max(abilityMod(str), abilityMod(con)) +
      (classDefenseBonuses?.Fortitude || 0),
    reflex:
      baseRef +
      Math.max(dexMod, intMod) +
      (classDefenseBonuses?.Reflex || 0),
    will:
      baseWill +
      Math.max(abilityMod(wis), abilityMod(cha)) +
      (classDefenseBonuses?.Will || 0)
  };

  return {
    maxHp,
    healingSurgesPerDay,
    surgeValue,
    speed,
    initiative,
    armorCheckPenalty,
    defenses,
    acBreakdown
  };
}


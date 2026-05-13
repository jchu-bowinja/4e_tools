import { Armor, CharacterBuild, ClassDef, Race } from "./models";
import type { AcBreakdown } from "./defenseCalculator";
import { bodyArmorSpeedPenalty, computeAcBreakdown, totalArmorCheckPenalty } from "./defenseCalculator";
import type { PassiveDefenseBonuses } from "./supportStatAdds";

function finiteBonus(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Applies optional manual magic-item-style enhancement bonuses to computed defenses. */
export function applyMagicItemDefenseBonuses(
  defenses: DerivedStats["defenses"],
  bonuses: CharacterBuild["magicItemBonuses"] | undefined
): DerivedStats["defenses"] {
  if (!bonuses) return defenses;
  return {
    ac: defenses.ac + finiteBonus(bonuses.ac),
    fortitude: defenses.fortitude + finiteBonus(bonuses.fortitude),
    reflex: defenses.reflex + finiteBonus(bonuses.reflex),
    will: defenses.will + finiteBonus(bonuses.will)
  };
}

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

const emptySupportDefense: PassiveDefenseBonuses = { ac: 0, fortitude: 0, reflex: 0, will: 0 };

export function computeDerivedStats(
  build: CharacterBuild,
  race: Race | undefined,
  cls: ClassDef | undefined,
  armor: Armor | undefined,
  shield: Armor | undefined,
  classDefenseBonuses?: Partial<Record<"Fortitude" | "Reflex" | "Will", number>>,
  supportPassiveDefense?: PassiveDefenseBonuses
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
  const halfLevel = Math.floor(build.level / 2);
  const initiative = halfLevel + dexMod;
  const raceSpeed = race?.speed ?? 6;
  const spdPen = bodyArmorSpeedPenalty(armor);
  const speed = Math.max(0, raceSpeed - spdPen);

  const baseFort = 10;
  const baseRef = 10;
  const baseWill = 10;

  const sp = supportPassiveDefense ?? emptySupportDefense;
  const acBreakdown = computeAcBreakdown(dexMod, intMod, armor, shield, build.level, sp.ac);
  const armorCheckPenalty = totalArmorCheckPenalty(armor, shield);

  const defensesBase = {
    ac: acBreakdown.total,
    fortitude:
      baseFort +
      halfLevel +
      Math.max(abilityMod(str), abilityMod(con)) +
      (classDefenseBonuses?.Fortitude || 0) +
      sp.fortitude,
    reflex:
      baseRef +
      halfLevel +
      Math.max(dexMod, intMod) +
      (classDefenseBonuses?.Reflex || 0) +
      sp.reflex,
    will:
      baseWill +
      halfLevel +
      Math.max(abilityMod(wis), abilityMod(cha)) +
      (classDefenseBonuses?.Will || 0) +
      sp.will
  };
  const defenses = applyMagicItemDefenseBonuses(defensesBase, build.magicItemBonuses);

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


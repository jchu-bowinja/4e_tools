import { Armor, CharacterBuild, ClassDef, Race } from "./models";
import type { AcBreakdown } from "./defenseCalculator";
import { bodyArmorSpeedPenalty, computeAcBreakdown, totalArmorCheckPenalty } from "./defenseCalculator";
import type { PassiveDefenseBonuses, PassiveOtherBonuses } from "./supportStatAdds";
import { emptyPassiveOther } from "./supportStatAdds";
import {
  buildInitiativeBreakdown,
  buildNadBreakdown,
  buildSpeedBreakdown,
  type StatScoreBreakdown
} from "./statScoreBreakdown";

function finiteBonus(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
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
  speedBreakdown: StatScoreBreakdown;
  initiativeBreakdown: StatScoreBreakdown;
  fortitudeBreakdown: StatScoreBreakdown;
  reflexBreakdown: StatScoreBreakdown;
  willBreakdown: StatScoreBreakdown;
  /** Flat bonuses from support entities' statAdds (initiative, speed, healing surges, skills). */
  supportPassiveOther: PassiveOtherBonuses;
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
  supportPassiveDefense?: PassiveDefenseBonuses,
  supportPassiveOther?: PassiveOtherBonuses,
  magicItemDefense?: PassiveDefenseBonuses
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
  const o = supportPassiveOther ?? emptyPassiveOther();
  const raceSpeed = race?.speed ?? 6;
  const spdPen = bodyArmorSpeedPenalty(armor);
  const speedBreakdown = buildSpeedBreakdown(raceSpeed, spdPen, o.speed);
  const speed = speedBreakdown.total;
  const initiativeBreakdown = buildInitiativeBreakdown(halfLevel, dexMod, o.initiative);
  const initiative = initiativeBreakdown.total;

  const baseFort = 10;
  const baseRef = 10;
  const baseWill = 10;

  const sp = supportPassiveDefense ?? emptySupportDefense;
  const acBreakdown = computeAcBreakdown(dexMod, intMod, armor, shield, build.level, sp.ac);
  const armorCheckPenalty = totalArmorCheckPenalty(armor, shield);

  const healingSurgesPerDayAdjusted = Math.max(0, healingSurgesPerDay + o.healingSurgesPerDay);

  const fortAbility = Math.max(abilityMod(str), abilityMod(con));
  const refAbility = Math.max(dexMod, intMod);
  const willAbility = Math.max(abilityMod(wis), abilityMod(cha));
  const classFort = classDefenseBonuses?.Fortitude || 0;
  const classRef = classDefenseBonuses?.Reflex || 0;
  const classWill = classDefenseBonuses?.Will || 0;
  const magic = magicItemDefense ?? { ac: 0, fortitude: 0, reflex: 0, will: 0 };
  const magicFort = magic.fortitude;
  const magicRef = magic.reflex;
  const magicWill = magic.will;
  const magicAc = magic.ac;

  const fortitudeBreakdown = buildNadBreakdown({
    halfLevel,
    abilityMod: fortAbility,
    abilityLabel: "STR/CON",
    classBonus: classFort,
    supportBonus: sp.fortitude,
    magicItemBonus: magicFort
  });
  const reflexBreakdown = buildNadBreakdown({
    halfLevel,
    abilityMod: refAbility,
    abilityLabel: "DEX/INT",
    classBonus: classRef,
    supportBonus: sp.reflex,
    magicItemBonus: magicRef
  });
  const willBreakdown = buildNadBreakdown({
    halfLevel,
    abilityMod: willAbility,
    abilityLabel: "WIS/CHA",
    classBonus: classWill,
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
    healingSurgesPerDay: healingSurgesPerDayAdjusted,
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


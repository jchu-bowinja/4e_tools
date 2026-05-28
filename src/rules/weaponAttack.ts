import type { Ability, ClassDef, Implement, ProficiencyGrant, Weapon } from "./models";
import {
  formatWeaponDamageNotation,
  offHandWeaponAttackPenalty,
  versatileTwoHandedDamageBonus,
  type WeaponHandSlot
} from "./weaponWielding";
import type { EquippedSlotKey } from "./models";
import {
  isProficientWithImplementIncludingFeats,
  isProficientWithWeaponIncludingFeats
} from "./featProficiencies";

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Split PHB-style comma / semicolon proficiency lists (weapon or implement lines). */
export function parseProficiencyPhrases(text: string | null | undefined): string[] {
  const s = String(text || "")
    .replace(/\s+and\s+/gi, ",")
    .trim();
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/** Weapon category from compendium (e.g. "Simple Melee") vs class line ("simple melee"). */
export function isProficientWithWeapon(
  weapon: Weapon,
  classWeaponProficienciesText: string | null | undefined,
  featProficiencyGrants: ProficiencyGrant[] = []
): boolean {
  return isProficientWithWeaponIncludingFeats(weapon, classWeaponProficienciesText, featProficiencyGrants);
}

export function weaponAttackAbility(weapon: Weapon): "STR" | "DEX" {
  const c = String(weapon.weaponCategory || "").toLowerCase();
  return c.includes("ranged") ? "DEX" : "STR";
}

const KEY_WORD_TO_ABILITY: Record<string, Ability> = {
  strength: "STR",
  constitution: "CON",
  dexterity: "DEX",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA"
};

/** Parses class `Key Abilities` text into ability codes (order preserved). */
export function keyAbilitiesFromClass(cls: ClassDef | undefined): Ability[] {
  const raw = String(cls?.keyAbilities || "").trim();
  if (!raw) return ["STR"];
  const out: Ability[] = [];
  for (const part of raw.split(/[,;/]/)) {
    const p = part.trim().toLowerCase();
    const code = KEY_WORD_TO_ABILITY[p];
    if (code && !out.includes(code)) out.push(code);
  }
  return out.length ? out : ["STR"];
}

export function maxKeyAbilityModifier(cls: ClassDef | undefined, scores: Record<Ability, number>): number {
  let best = -99;
  for (const ab of keyAbilitiesFromClass(cls)) {
    best = Math.max(best, abilityMod(scores[ab] ?? 10));
  }
  return best;
}

export function isProficientWithImplement(
  implement: Implement,
  classImplementText: string | null | undefined,
  featProficiencyGrants: ProficiencyGrant[] = []
): boolean {
  return isProficientWithImplementIncludingFeats(implement, classImplementText, featProficiencyGrants);
}

const IMPL_PROF_BONUS = 2;

export interface WeaponAttackSummary {
  attackBonus: number;
  abilityCode: "STR" | "DEX";
  proficient: boolean;
  damageNotation: string;
}

export function summarizeMainWeaponAttack(
  level: number,
  scores: Record<Ability, number>,
  weapon: Weapon | undefined,
  classWeaponProficienciesText: string | null | undefined,
  magicItemAttackBonus?: number,
  featProficiencyGrants: ProficiencyGrant[] = [],
  handSlot?: WeaponHandSlot,
  equippedSlots?: Partial<Record<EquippedSlotKey, string>>,
  abilityCodeOverride?: "STR" | "DEX"
): WeaponAttackSummary | null {
  if (!weapon) return null;
  const abilityCode = abilityCodeOverride ?? weaponAttackAbility(weapon);
  const prof = isProficientWithWeapon(weapon, classWeaponProficienciesText, featProficiencyGrants);
  const half = Math.floor(level / 2);
  const mod = abilityMod(scores[abilityCode] ?? 10);
  const pb = weapon.proficiencyBonus ?? 0;
  const itemBonus =
    typeof magicItemAttackBonus === "number" && Number.isFinite(magicItemAttackBonus) ? magicItemAttackBonus : 0;
  const wieldPenalty = handSlot ? offHandWeaponAttackPenalty(weapon, handSlot) : 0;
  const attackBonus = half + mod + (prof ? pb : -2) + itemBonus + wieldPenalty;
  const versatileDamageBonus =
    handSlot && equippedSlots ? versatileTwoHandedDamageBonus(weapon, handSlot, equippedSlots) : 0;
  return {
    attackBonus,
    abilityCode,
    proficient: prof,
    damageNotation: formatWeaponDamageNotation(weapon.damage, versatileDamageBonus)
  };
}

export interface ImplementAttackSummary {
  attackBonus: number;
  proficient: boolean;
}

export function summarizeImplementAttack(
  level: number,
  scores: Record<Ability, number>,
  cls: ClassDef | undefined,
  implement: Implement | undefined,
  classImplementText: string | null | undefined,
  magicItemAttackBonus?: number,
  featProficiencyGrants: ProficiencyGrant[] = []
): ImplementAttackSummary | null {
  if (!implement) return null;
  const prof = isProficientWithImplement(implement, classImplementText, featProficiencyGrants);
  const half = Math.floor(level / 2);
  const mod = maxKeyAbilityModifier(cls, scores);
  const itemBonus =
    typeof magicItemAttackBonus === "number" && Number.isFinite(magicItemAttackBonus) ? magicItemAttackBonus : 0;
  const attackBonus = half + mod + (prof ? IMPL_PROF_BONUS : -2) + itemBonus;
  return { attackBonus, proficient: prof };
}

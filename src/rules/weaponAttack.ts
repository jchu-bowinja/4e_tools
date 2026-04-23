import type { Ability, ClassDef, Implement, Weapon } from "./models";

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
export function isProficientWithWeapon(weapon: Weapon, classWeaponProficienciesText: string | null | undefined): boolean {
  const phrases = parseProficiencyPhrases(classWeaponProficienciesText);
  const cat = String(weapon.weaponCategory || "").trim().toLowerCase();
  if (!cat || phrases.length === 0) return false;
  return phrases.some((p) => cat === p || cat.startsWith(`${p} `) || cat.includes(p));
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
  classImplementText: string | null | undefined
): boolean {
  const phrases = parseProficiencyPhrases(classImplementText);
  const g = String(implement.implementGroup || "").trim().toLowerCase();
  if (!g || phrases.length === 0) return false;
  return phrases.some((p) => g === p || g.includes(p) || p.includes(g));
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
  classWeaponProficienciesText: string | null | undefined
): WeaponAttackSummary | null {
  if (!weapon) return null;
  const abilityCode = weaponAttackAbility(weapon);
  const prof = isProficientWithWeapon(weapon, classWeaponProficienciesText);
  const half = Math.floor(level / 2);
  const mod = abilityMod(scores[abilityCode] ?? 10);
  const pb = weapon.proficiencyBonus ?? 0;
  const attackBonus = half + mod + (prof ? pb : -2);
  return {
    attackBonus,
    abilityCode,
    proficient: prof,
    damageNotation: String(weapon.damage || "—")
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
  classImplementText: string | null | undefined
): ImplementAttackSummary | null {
  if (!implement) return null;
  const prof = isProficientWithImplement(implement, classImplementText);
  const half = Math.floor(level / 2);
  const mod = maxKeyAbilityModifier(cls, scores);
  const attackBonus = half + mod + (prof ? IMPL_PROF_BONUS : -2);
  return { attackBonus, proficient: prof };
}

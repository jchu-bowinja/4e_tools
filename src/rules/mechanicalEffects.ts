import type {
  CharacterBuild,
  ClassFeature,
  ClassFeatureMechanicalEffect,
  ProficiencyGrant,
  RulesIndex,
  Weapon
} from "./models";
import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import { proficiencyGrantsFromClassFeatureRaw } from "./classFeatureProficiencies";

export type MechanicalEffect = ClassFeatureMechanicalEffect;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function mechanicalEffectsForClassFeature(feature: ClassFeature | undefined): MechanicalEffect[] {
  const raw = feature?.mechanicalEffects;
  return Array.isArray(raw) ? raw : [];
}

/** Active mechanical effects from class features the build has selected. */
export function collectActiveClassFeatureMechanicalEffects(
  index: RulesIndex,
  build: CharacterBuild
): MechanicalEffect[] {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const out: MechanicalEffect[] = [];
  for (const fid of collectCharacterClassFeatureIds(index, build)) {
    for (const effect of mechanicalEffectsForClassFeature(byId.get(fid))) {
      out.push(effect);
    }
  }
  return out;
}

export function applyArmorProficiencyPhraseRemovals(
  classArmorProficienciesText: string,
  effects: MechanicalEffect[]
): string {
  let text = classArmorProficienciesText;
  for (const effect of effects) {
    if (effect.type !== "removeArmorProficiencyPhrases") continue;
    for (const phrase of effect.phrases) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
    }
  }
  return text
    .replace(/,\s*,/g, ",")
    .replace(/;\s*;/g, ";")
    .replace(/^[\s,;]+|[\s,;]+$/g, "")
    .trim();
}

function isBowWeapon(weapon: Weapon): boolean {
  const group = norm(String(weapon.weaponGroup || ""));
  const cat = norm(String(weapon.weaponCategory || ""));
  return group.includes("bow") || cat.includes("bow");
}

export function weaponAttackAbilityFromMechanicalEffects(
  weapon: Weapon,
  effects: MechanicalEffect[],
  defaultAbility: "STR" | "DEX"
): "STR" | "DEX" {
  if (!isBowWeapon(weapon)) return defaultAbility;
  for (const effect of effects) {
    if (effect.type !== "weaponKeyAbility") continue;
    const wantGroup = norm(effect.weaponGroup);
    const group = norm(String(weapon.weaponGroup || ""));
    const cat = norm(String(weapon.weaponCategory || ""));
    if (group.includes(wantGroup) || cat.includes(wantGroup)) {
      return effect.ability;
    }
  }
  return defaultAbility;
}

function weaponNameMatches(weapon: Weapon, targetName: string): boolean {
  const name = norm(String(weapon.name || ""));
  const want = norm(targetName);
  return name === want || name.startsWith(`${want} `);
}

const DIE_STEPS = [4, 6, 8, 10, 12] as const;

function increaseDamageDie(notation: string, steps: number): string {
  const m = /(\d+)d(\d+)/i.exec(notation.trim());
  if (!m || steps <= 0) return notation;
  let sides = Number(m[2]);
  for (let i = 0; i < steps; i++) {
    const idx = DIE_STEPS.indexOf(sides as (typeof DIE_STEPS)[number]);
    if (idx >= 0 && idx < DIE_STEPS.length - 1) {
      sides = DIE_STEPS[idx + 1]!;
    } else {
      break;
    }
  }
  return `${m[1]}d${sides}`;
}

export function weaponDamageFromMechanicalEffects(
  weapon: Weapon,
  effects: MechanicalEffect[],
  defaultDamage: string | null | undefined
): string {
  let damage = String(defaultDamage ?? "").trim() || "—";
  for (const effect of effects) {
    if (effect.type === "weaponDamageOverride" && weaponNameMatches(weapon, effect.weaponName)) {
      damage = effect.damage;
    }
  }
  for (const effect of effects) {
    if (effect.type === "weaponDamageDieIncrease" && weaponNameMatches(weapon, effect.weaponName)) {
      damage = increaseDamageDie(damage, effect.steps);
    }
  }
  return damage;
}

/** Proficiency grants from active class features (ETL `mechanicalEffects` + raw `rules.grant`). */
export function proficiencyGrantsFromActiveClassFeatures(
  index: RulesIndex,
  build: CharacterBuild
): ProficiencyGrant[] {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const out: ProficiencyGrant[] = [];
  for (const fid of collectCharacterClassFeatureIds(index, build)) {
    const feature = byId.get(fid);
    if (!feature) continue;
    out.push(...proficiencyGrantsFromClassFeatureRaw(feature.raw));
  }
  return out;
}

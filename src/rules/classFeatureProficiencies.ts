import type { CharacterBuild, ProficiencyGrant, RulesIndex, Weapon } from "./models";
import {
  applyArmorProficiencyPhraseRemovals,
  collectActiveClassFeatureMechanicalEffects,
  weaponAttackAbilityFromMechanicalEffects
} from "./mechanicalEffects";

export const ARCHER_WARLORD_CLASS_FEATURE_ID = "ID_FMP_CLASS_FEATURE_2286";

const INTERNAL_PROFICIENCY_PREFIX = "ID_INTERNAL_PROFICIENCY_";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Parse `rules.grant` proficiency rows on a class feature (mirrors ETL). */
export function proficiencyGrantsFromClassFeatureRaw(
  raw: Record<string, unknown> | undefined
): ProficiencyGrant[] {
  const rules = raw?.rules as Record<string, unknown> | undefined;
  const grantList = rules?.grant;
  if (!Array.isArray(grantList)) return [];
  const out: ProficiencyGrant[] = [];
  for (const item of grantList) {
    const attrs = (item as { attrs?: Record<string, string> })?.attrs;
    if (!attrs || String(attrs.type || "").toLowerCase() !== "proficiency") continue;
    const name = String(attrs.name || "").trim();
    const parsed = parseInternalProficiencyGrantId(name);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseInternalProficiencyGrantId(internalId: string): ProficiencyGrant | null {
  if (!internalId.startsWith(INTERNAL_PROFICIENCY_PREFIX)) return null;
  const rest = internalId.slice(INTERNAL_PROFICIENCY_PREFIX.length);
  const weaponGroup = rest.match(/^WEAPON_GROUP_\(([^)]+)\)$/i);
  if (weaponGroup) {
    const raw = weaponGroup[1].replace(/_/g, " ").trim();
    return { kind: "weaponGroup", value: raw.toLowerCase(), label: raw };
  }
  const armor = rest.match(/^ARMOR_PROFICIENCY_\(([^)]+)\)$/i);
  if (armor) {
    const raw = armor[1].replace(/_/g, " ").trim();
    return { kind: "armor", value: raw.toLowerCase(), label: raw };
  }
  const shield = rest.match(/^SHIELD_PROFICIENCY_\(([^)]+)\)$/i);
  if (shield) {
    const raw = shield[1].replace(/_/g, " ").trim();
    return { kind: "shield", value: raw.toLowerCase(), label: raw };
  }
  const val = rest.replace(/_/g, " ").trim();
  if (!val) return null;
  return { kind: "weaponCategory", value: val.toLowerCase(), label: val };
}

export function hasArcherWarlordSelection(build: CharacterBuild): boolean {
  return Object.values(build.classSelections ?? {}).includes(ARCHER_WARLORD_CLASS_FEATURE_ID);
}

/** Drops armor proficiency phrases from active class-feature mechanical effects (e.g. Archer Warlord). */
export function effectiveClassArmorProficienciesText(
  classArmorProficienciesText: string,
  build: CharacterBuild,
  index?: RulesIndex
): string {
  if (!index) {
    if (!hasArcherWarlordSelection(build)) return classArmorProficienciesText;
    return classArmorProficienciesText
      .replace(/\bchainmail\b/gi, "")
      .replace(/\blight shields?\b/gi, "")
      .replace(/,\s*,/g, ",")
      .replace(/;\s*;/g, ";")
      .replace(/^[\s,;]+|[\s,;]+$/g, "")
      .trim();
  }
  const effects = collectActiveClassFeatureMechanicalEffects(index, build);
  if (!effects.length) return classArmorProficienciesText;
  return applyArmorProficiencyPhraseRemovals(classArmorProficienciesText, effects);
}

/** STR/DEX for attacks from active class-feature mechanical effects (e.g. bow → STR). */
export function weaponAttackAbilityForCharacter(
  weapon: Weapon,
  index: RulesIndex,
  build: CharacterBuild
): "STR" | "DEX" {
  const cat = norm(String(weapon.weaponCategory || ""));
  const defaultAbility: "STR" | "DEX" = cat.includes("ranged") ? "DEX" : "STR";
  const effects = collectActiveClassFeatureMechanicalEffects(index, build);
  return weaponAttackAbilityFromMechanicalEffects(weapon, effects, defaultAbility);
}

import type { CharacterBuild, ProficiencyGrant, RulesIndex, Weapon } from "./models";
import { buildClassFeatureLookups } from "./supportTraits";
import type { Ability } from "./models";

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

/** Archer Warlord drops chainmail and light shields from effective class armor proficiencies. */
export function effectiveClassArmorProficienciesText(
  classArmorProficienciesText: string,
  build: CharacterBuild
): string {
  if (!hasArcherWarlordSelection(build)) return classArmorProficienciesText;
  return classArmorProficienciesText
    .replace(/\bchainmail\b/gi, "")
    .replace(/\blight shields?\b/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/;\s*;/g, ";")
    .replace(/^[\s,;]+|[\s,;]+$/g, "")
    .trim();
}

function bowGroupTextstringOverrides(raw: Record<string, unknown> | undefined): boolean {
  const rules = raw?.rules as Record<string, unknown> | undefined;
  const rows = rules?.textstring;
  if (!Array.isArray(rows)) return false;
  for (const row of rows) {
    const attrs = (row as { attrs?: Record<string, string> })?.attrs;
    if (!attrs) continue;
    const name = norm(String(attrs.name || ""));
    const value = norm(String(attrs.value || ""));
    if (name.includes("bow") && name.includes("key ability") && value === "str") {
      return true;
    }
  }
  return false;
}

function isBowWeapon(weapon: Weapon): boolean {
  const group = norm(String(weapon.weaponGroup || ""));
  const cat = norm(String(weapon.weaponCategory || ""));
  return group.includes("bow") || cat.includes("bow");
}

/** STR instead of DEX for ranged bow attacks when Archer Warlord is active. */
export function weaponAttackAbilityForCharacter(
  weapon: Weapon,
  index: RulesIndex,
  build: CharacterBuild
): "STR" | "DEX" {
  const cat = norm(String(weapon.weaponCategory || ""));
  const defaultAbility: "STR" | "DEX" = cat.includes("ranged") ? "DEX" : "STR";
  if (!isBowWeapon(weapon) || !hasArcherWarlordSelection(build)) {
    return defaultAbility;
  }
  const { byId } = buildClassFeatureLookups(index);
  const archer = byId.get(ARCHER_WARLORD_CLASS_FEATURE_ID);
  if (bowGroupTextstringOverrides(archer?.raw)) return "STR";
  return defaultAbility;
}

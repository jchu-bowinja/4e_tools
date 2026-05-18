import type { Armor, CharacterBuild, Feat, Implement, ProficiencyGrant, RulesIndex, Weapon } from "./models";
import { parseProficiencyPhrases } from "./weaponAttack";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** All structured proficiency grants from selected feats (deduped). */
export function collectFeatProficiencyGrants(index: RulesIndex, featIds: string[]): ProficiencyGrant[] {
  const out: ProficiencyGrant[] = [];
  const seen = new Set<string>();
  for (const fid of featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    for (const g of feat?.proficiencyGrants ?? []) {
      const key = `${g.kind}:${g.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(g);
    }
  }
  return out;
}

export function formatProficiencyGrant(g: ProficiencyGrant): string {
  const label = g.label || g.value;
  switch (g.kind) {
    case "weaponCategory":
      return `Weapon category: ${label}`;
    case "weaponGroup":
      return `Weapon group: ${label}`;
    case "weaponName":
      return `Weapon: ${label}`;
    case "armor":
      return `Armor: ${label}`;
    case "shield":
      return `Shield: ${label}`;
    case "implement":
      return `Implement: ${label}`;
    default:
      return label;
  }
}

export interface FeatProficiencyDisplayRow {
  featId: string;
  featName: string;
  grants: string[];
}

export function collectFeatProficiencyDisplayRows(
  index: RulesIndex,
  featIds: string[]
): FeatProficiencyDisplayRow[] {
  const rows: FeatProficiencyDisplayRow[] = [];
  for (const fid of featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    const grants = feat?.proficiencyGrants ?? [];
    if (!feat || grants.length === 0) continue;
    rows.push({
      featId: feat.id,
      featName: feat.name,
      grants: grants.map(formatProficiencyGrant)
    });
  }
  return rows;
}

export function weaponMatchesProficiencyGrant(weapon: Weapon, grant: ProficiencyGrant): boolean {
  const cat = norm(String(weapon.weaponCategory || ""));
  const group = norm(String(weapon.weaponGroup || ""));
  const name = norm(weapon.name || "");
  const val = norm(grant.value);
  switch (grant.kind) {
    case "weaponCategory":
      return Boolean(cat && (cat === val || cat.startsWith(`${val} `) || cat.includes(val)));
    case "weaponGroup":
      return Boolean(group && (group === val || group.includes(val) || val.includes(group)));
    case "weaponName":
      return Boolean(name && (name === val || name.includes(val) || val.includes(name)));
    default:
      return false;
  }
}

export function isProficientWithWeaponIncludingFeats(
  weapon: Weapon,
  classWeaponProficienciesText: string | null | undefined,
  featGrants: ProficiencyGrant[]
): boolean {
  const phrases = parseProficiencyPhrases(classWeaponProficienciesText);
  const cat = norm(String(weapon.weaponCategory || ""));
  if (cat && phrases.some((p) => cat === p || cat.startsWith(`${p} `) || cat.includes(p))) {
    return true;
  }
  return featGrants.some((g) => weaponMatchesProficiencyGrant(weapon, g));
}

export function implementMatchesProficiencyGrant(implement: Implement, grant: ProficiencyGrant): boolean {
  if (grant.kind !== "implement") return false;
  const g = norm(String(implement.implementGroup || ""));
  const val = norm(grant.value);
  return Boolean(g && (g === val || g.includes(val) || val.includes(g)));
}

export function isProficientWithImplementIncludingFeats(
  implement: Implement,
  classImplementText: string | null | undefined,
  featGrants: ProficiencyGrant[]
): boolean {
  const phrases = parseProficiencyPhrases(classImplementText);
  const g = norm(String(implement.implementGroup || ""));
  if (g && phrases.some((p) => g === p || g.includes(p) || p.includes(g))) {
    return true;
  }
  return featGrants.some((gr) => implementMatchesProficiencyGrant(implement, gr));
}

const ARMOR_CATEGORY_TO_GRANT: Array<{ match: string; grantValue: string }> = [
  { match: "cloth", grantValue: "cloth" },
  { match: "leather", grantValue: "leather" },
  { match: "hide", grantValue: "hide" },
  { match: "chain", grantValue: "chainmail" },
  { match: "scale", grantValue: "scale" },
  { match: "plate", grantValue: "plate" }
];

export function hasArmorProficiencyForCategory(
  armorCategory: string,
  classArmorProficienciesText: string,
  featGrants: ProficiencyGrant[],
  legacyFeatNames: Set<string>
): boolean {
  const lower = classArmorProficienciesText.toLowerCase();
  for (const { match, grantValue } of ARMOR_CATEGORY_TO_GRANT) {
    if (!armorCategory.includes(match)) continue;
    if (lower.includes(grantValue)) return true;
    if (featGrants.some((g) => g.kind === "armor" && norm(g.value) === grantValue)) return true;
    if (legacyFeatNames.has(`armor proficiency: ${grantValue}`)) return true;
  }
  return false;
}

export function hasShieldProficiency(
  shieldCategory: string,
  classArmorProficienciesText: string,
  featGrants: ProficiencyGrant[],
  legacyFeatNames: Set<string>
): boolean {
  const lower = classArmorProficienciesText.toLowerCase();
  if (shieldCategory.includes("light")) {
    if (lower.includes("light shields")) return true;
    if (featGrants.some((g) => g.kind === "shield" && norm(g.value) === "light")) return true;
    if (legacyFeatNames.has("shield proficiency: light")) return true;
  }
  if (shieldCategory.includes("heavy")) {
    if (lower.includes("heavy shields")) return true;
    if (featGrants.some((g) => g.kind === "shield" && norm(g.value) === "heavy")) return true;
    if (legacyFeatNames.has("shield proficiency: heavy")) return true;
  }
  return false;
}

export function legacyFeatNamesSet(index: RulesIndex, build: Pick<CharacterBuild, "featIds">): Set<string> {
  return new Set(
    build.featIds
      .map((id) => index.feats.find((f) => f.id === id)?.name?.toLowerCase() || "")
      .filter(Boolean)
  );
}

export function appendFeatProficiencyPhrasesToWeaponLine(
  baseLine: string,
  featGrants: ProficiencyGrant[]
): string {
  const extra: string[] = [];
  for (const g of featGrants) {
    if (g.kind === "weaponCategory" || g.kind === "weaponGroup") {
      extra.push(g.value);
    }
  }
  if (!extra.length) return baseLine;
  const joined = extra.join(", ");
  return baseLine.trim() ? `${baseLine.trim()}, ${joined}` : joined;
}

export function appendFeatProficiencyPhrasesToImplementLine(
  baseLine: string,
  featGrants: ProficiencyGrant[]
): string {
  const extra = featGrants.filter((g) => g.kind === "implement").map((g) => g.label || g.value);
  if (!extra.length) return baseLine;
  const joined = extra.join("; ");
  return baseLine.trim() ? `${baseLine.trim()}; ${joined}` : joined;
}

export function validateArmorProficiencyForSelection(
  armor: Armor | undefined,
  classArmorProficienciesText: string,
  featGrants: ProficiencyGrant[],
  legacyFeatNames: Set<string>
): string[] {
  if (!armor) return [];
  const errors: string[] = [];
  const category = String(armor.armorCategory || "").toLowerCase();
  for (const { match, grantValue } of ARMOR_CATEGORY_TO_GRANT) {
    if (!category.includes(match)) continue;
    if (!hasArmorProficiencyForCategory(category, classArmorProficienciesText, featGrants, legacyFeatNames)) {
      errors.push(`Missing ${grantValue.charAt(0).toUpperCase() + grantValue.slice(1)} armor proficiency for selected armor.`);
    }
  }
  return errors;
}

export function validateShieldProficiencyForSelection(
  shield: Armor | undefined,
  classArmorProficienciesText: string,
  featGrants: ProficiencyGrant[],
  legacyFeatNames: Set<string>
): string[] {
  if (!shield) return [];
  const errors: string[] = [];
  const shieldCat = String(shield.armorCategory || "").toLowerCase();
  if (shieldCat.includes("light") && !hasShieldProficiency(shieldCat, classArmorProficienciesText, featGrants, legacyFeatNames)) {
    errors.push("Missing Light Shield proficiency for selected shield.");
  }
  if (shieldCat.includes("heavy") && !hasShieldProficiency(shieldCat, classArmorProficienciesText, featGrants, legacyFeatNames)) {
    errors.push("Missing Heavy Shield proficiency for selected shield.");
  }
  return errors;
}

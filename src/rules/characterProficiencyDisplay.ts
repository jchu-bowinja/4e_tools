import { effectiveClassArmorProficienciesText } from "./classFeatureProficiencies";
import {
  appendFeatProficiencyPhrasesToArmorLine,
  appendFeatProficiencyPhrasesToWeaponLine,
  collectClassFeatureProficiencyGrants
} from "./featProficiencies";
import { mergeHybridProficiencyLines } from "./hybridDerivedStats";
import type { CharacterBuild, HybridClassDef, ProficiencyGrant, RulesIndex } from "./models";

export interface ClassProficiencyBaseInput {
  isHybrid: boolean;
  hybridA?: HybridClassDef;
  hybridB?: HybridClassDef;
  classSpecific?: Record<string, unknown>;
}

export function classWeaponProficiencyBaseText(input: ClassProficiencyBaseInput): string {
  if (input.isHybrid && input.hybridA && input.hybridB) {
    return mergeHybridProficiencyLines(input.hybridA, input.hybridB).weaponLine;
  }
  return String(input.classSpecific?.["Weapon Proficiencies"] || "");
}

export function classArmorProficiencyBaseText(input: ClassProficiencyBaseInput): string {
  if (input.isHybrid && input.hybridA && input.hybridB) {
    return mergeHybridProficiencyLines(input.hybridA, input.hybridB).armorLine;
  }
  return String(input.classSpecific?.["Armor Proficiencies"] || "");
}

export function effectiveWeaponProficiencyDisplayText(
  baseText: string,
  featGrants: ProficiencyGrant[]
): string {
  return appendFeatProficiencyPhrasesToWeaponLine(baseText, featGrants).trim();
}

export function effectiveArmorProficiencyDisplayText(
  baseText: string,
  build: CharacterBuild,
  featGrants: ProficiencyGrant[],
  index?: RulesIndex
): string {
  const adjusted = effectiveClassArmorProficienciesText(baseText, build, index);
  return appendFeatProficiencyPhrasesToArmorLine(adjusted, featGrants).trim();
}

export interface CharacterProficiencyDisplayLines {
  weaponLine: string;
  armorLine: string;
}

export function computeCharacterProficiencyDisplayLines(
  base: ClassProficiencyBaseInput,
  build: CharacterBuild,
  featGrants: ProficiencyGrant[],
  index?: RulesIndex
): CharacterProficiencyDisplayLines {
  return {
    weaponLine: effectiveWeaponProficiencyDisplayText(classWeaponProficiencyBaseText(base), featGrants),
    armorLine: effectiveArmorProficiencyDisplayText(
      classArmorProficiencyBaseText(base),
      build,
      featGrants,
      index
    )
  };
}

/** Class/hybrid base proficiencies plus active class-feature grants (no feat or racial grants). */
export function computeClassGrantedProficiencyDisplayLines(
  index: RulesIndex,
  base: ClassProficiencyBaseInput,
  build: CharacterBuild
): CharacterProficiencyDisplayLines {
  const classFeatureGrants = collectClassFeatureProficiencyGrants(index, build);
  const weaponBase = classWeaponProficiencyBaseText(base);
  const armorBase = effectiveClassArmorProficienciesText(
    classArmorProficiencyBaseText(base),
    build,
    index
  );
  return {
    weaponLine: appendFeatProficiencyPhrasesToWeaponLine(weaponBase, classFeatureGrants).trim(),
    armorLine: appendFeatProficiencyPhrasesToArmorLine(armorBase, classFeatureGrants).trim()
  };
}

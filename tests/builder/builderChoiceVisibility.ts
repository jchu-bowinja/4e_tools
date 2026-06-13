import {
  applyClassFeatureChoiceOptionFilters,
  classFeaturePowerIdsForClass,
  effectiveClassSelectionsForChoiceGroups,
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups
} from "../../src/rules/classFeatureChoices";
import {
  applyEssentialsBuildSuggestedPowerSlots,
  CLASS_BUILD_OPTION_SELECTION_KEY
} from "../../src/rules/classBuildOptions";
import {
  autoGrantedClassPowers,
  resolveGrantedPowersFromActiveClassFeatures
} from "../../src/rules/grantedPowersQuery";
import { getThemeGrantedPowers } from "../../src/rules/classPowersQuery";
import type { CharacterBuild, ClassDef, RulesIndex } from "../../src/rules/models";
import { isClassSpellbookPowerGroup } from "../../src/rules/wizardSpellbook";

export interface ChoiceGroupVisibility {
  key: string;
  label: string;
  optionNames: string[];
}

function selectedClass(index: RulesIndex, build: CharacterBuild): ClassDef | undefined {
  return index.classes.find((c) => c.id === build.classId);
}

function visibleChoiceGroups(index: RulesIndex, build: CharacterBuild) {
  const cls = selectedClass(index, build);
  if (!cls) return [];
  const groups = getClassFeatureChoiceGroups(index, cls);
  const selections = effectiveClassSelectionsForChoiceGroups(
    index,
    build.classId,
    build.classSelections,
    groups,
    build.level
  );
  return applyClassFeatureChoiceOptionFilters(
    index,
    filterVisibleClassFeatureChoiceGroups(groups, selections, build.level),
    selections
  );
}

/** Mirrors `visibleNonSpellbookPowerGroupsOnPowersTab` in CharacterBuilderApp. */
export function visiblePowerPickGroupsOnPowersTab(
  index: RulesIndex,
  build: CharacterBuild
): ChoiceGroupVisibility[] {
  return visibleChoiceGroups(index, build)
    .filter((g) => g.kind === "power" && !isClassSpellbookPowerGroup(g))
    .map((g) => ({
      key: g.key,
      label: g.parentFeatureName,
      optionNames: classFeaturePowerIdsForClass(index, g, build.classId, build.level)
        .map((id) => index.powers.find((p) => p.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    }));
}

/** Mirrors `visibleClassFeatureChoiceGroupsOnClassTab` in CharacterBuilderApp. */
export function visibleClassFeaturePickGroupsOnClassTab(
  index: RulesIndex,
  build: CharacterBuild
): ChoiceGroupVisibility[] {
  return visibleChoiceGroups(index, build)
    .filter((g) => g.kind === "classFeature")
    .map((g) => ({
      key: g.key,
      label: g.parentFeatureName,
      optionNames: g.options.map((o) => o.name)
    }));
}

/** Mirrors `classAutoGrantedPowers` on the Class / Powers tabs. */
export function autoGrantedClassPowerNames(index: RulesIndex, build: CharacterBuild): string[] {
  const byId = new Map<string, string>();
  const add = (powers: { id: string; name: string }[]) => {
    for (const p of powers) byId.set(p.id, p.name);
  };
  add(autoGrantedClassPowers(index, build.classId));
  add(resolveGrantedPowersFromActiveClassFeatures(index, build));
  return [...byId.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Mirrors `themeGrantedPowers` on the Powers / Theme tabs. */
export function themeGrantedPowerNames(index: RulesIndex, build: CharacterBuild): string[] {
  if (!build.themeId) return [];
  return getThemeGrantedPowers(index, build.themeId, build.level).map((p) => p.name);
}

/** Mirrors Essentials build suggested slot prefill shown in class power slots. */
export function essentialsBuildPrefilledSlotPowerNames(
  index: RulesIndex,
  build: CharacterBuild
): string[] {
  if (!build.classId) return [];
  const slots = applyEssentialsBuildSuggestedPowerSlots(build, index, build.level, false);
  if (!slots) return [];
  const ids = new Set<string>();
  for (const powerId of Object.values(slots)) {
    if (powerId?.trim()) ids.add(powerId.trim());
  }
  return [...ids]
    .map((id) => index.powers.find((p) => p.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

export { CLASS_BUILD_OPTION_SELECTION_KEY };

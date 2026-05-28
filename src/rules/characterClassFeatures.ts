import {
  CLASS_FEATURE_CHOICE_NONE,
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups,
  resolveClassFeatureChoiceIdsForGroup
} from "./classFeatureChoices";
import type { CharacterBuild, ClassFeature, RulesIndex } from "./models";
import {
  buildClassFeatureLookups,
  featureIsAvailableAtLevel,
  parseTraitIdsFromField,
  parseTraitNamesFromField,
  specOf,
  traitDescriptionForDisplay,
  traitNameForDisplay,
  type TraitDisplayRow
} from "./supportTraits";

/** Support ids for class/hybrid grants only (excludes race, theme, path, destiny). */
function classSupportIds(index: RulesIndex, build: CharacterBuild): string[] {
  const ids: string[] = [];
  if (build.characterStyle === "hybrid") {
    const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    if (ha?.baseClassId) ids.push(ha.baseClassId);
    if (hb?.baseClassId) ids.push(hb.baseClassId);
    if (build.hybridClassIdA) ids.push(build.hybridClassIdA);
    if (build.hybridClassIdB) ids.push(build.hybridClassIdB);
  } else if (build.classId) {
    ids.push(build.classId);
  }
  return ids;
}

/** Class + hybrid feature ids (grants and player picks); excludes path, destiny, theme, and feats. */
export function collectClassFeatureIdsFromClass(
  index: RulesIndex,
  build: CharacterBuild
): string[] {
  const { byId, byName } = buildClassFeatureLookups(index);
  const ids: string[] = [];
  const seen = new Set<string>();

  const add = (feature: ClassFeature | undefined) => {
    if (!feature || seen.has(feature.id)) return;
    if (!featureIsAvailableAtLevel(feature, build.level)) return;
    seen.add(feature.id);
    ids.push(feature.id);
  };

  const addByName = (name: string) => {
    const f = byName.get(name.trim());
    if (f) add(f);
  };

  const grantedNames = index.grantedClassFeatureNamesBySupportId ?? {};
  for (const sid of classSupportIds(index, build)) {
    for (const n of grantedNames[sid] ?? []) {
      addByName(n);
    }
  }

  const selectionId =
    build.classSelections?.buildOptionId?.trim() ||
    build.classSelections?.buildOption?.trim();
  if (selectionId) {
    add(byId.get(selectionId) ?? byName.get(selectionId));
  }

  for (const id of [
    build.hybridTalentClassFeatureIdA,
    build.hybridTalentClassFeatureIdB,
    ...Object.values(build.hybridSideASelections ?? {}),
    ...Object.values(build.hybridSideBSelections ?? {})
  ]) {
    if (id?.startsWith("ID_")) add(byId.get(id));
  }

  const rs = build.classSelections ?? {};
  const applyClassFeatureChoiceGroups = (classId: string | undefined) => {
    if (!classId) return;
    const cls = index.classes.find((c) => c.id === classId);
    const groups = getClassFeatureChoiceGroups(index, cls);
    for (const g of filterVisibleClassFeatureChoiceGroups(groups, rs, build.level)) {
      for (const picked of resolveClassFeatureChoiceIdsForGroup(g, rs)) {
        if (picked !== CLASS_FEATURE_CHOICE_NONE) add(byId.get(picked));
      }
    }
  };
  if (build.characterStyle === "hybrid") {
    const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    applyClassFeatureChoiceGroups(ha?.baseClassId);
    applyClassFeatureChoiceGroups(hb?.baseClassId);
  } else {
    applyClassFeatureChoiceGroups(build.classId);
  }

  return ids;
}

/** Class feature ids the character currently has (build options, grants, path features, …). */
export function collectCharacterClassFeatureIds(index: RulesIndex, build: CharacterBuild): string[] {
  const { byId, byName } = buildClassFeatureLookups(index);
  const ids = collectClassFeatureIdsFromClass(index, build);
  const seen = new Set(ids);

  const add = (feature: ClassFeature | undefined) => {
    if (!feature || seen.has(feature.id)) return;
    if (!featureIsAvailableAtLevel(feature, build.level)) return;
    seen.add(feature.id);
    ids.push(feature.id);
  };

  const addByName = (name: string) => {
    const f = byName.get(name.trim());
    if (f) add(f);
  };

  if (build.paragonPathId) {
    const path = index.paragonPaths.find((p) => p.id === build.paragonPathId);
    for (const id of parseTraitIdsFromField(specOf(path), "Class Features")) {
      add(byId.get(id));
    }
  }
  if (build.themeId) {
    const theme = index.themes.find((t) => t.id === build.themeId);
    for (const name of parseTraitNamesFromField(specOf(theme), "_PARSED_CLASS_FEATURE")) {
      addByName(name);
    }
    for (const id of parseTraitIdsFromField(specOf(theme), "_PARSED_SUB_FEATURES")) {
      add(byId.get(id));
    }
  }
  if (build.epicDestinyId) {
    const ed = index.epicDestinies.find((e) => e.id === build.epicDestinyId);
    for (const id of parseTraitIdsFromField(specOf(ed), "Class Features")) {
      add(byId.get(id));
    }
  }

  for (const fid of build.featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    for (const cfId of feat?.grantedClassFeatureIds ?? []) {
      add(byId.get(cfId));
    }
    for (const cfId of feat?.countsAsFeatureIds ?? []) {
      add(byId.get(cfId));
    }
  }

  return ids;
}

/** Trait rows for class/hybrid features on the sheet (excludes path, destiny, theme, feats). */
export function getCharacterClassFeatureTraitRows(
  index: RulesIndex,
  build: CharacterBuild
): TraitDisplayRow[] {
  const { byId } = buildClassFeatureLookups(index);
  return collectClassFeatureIdsFromClass(index, build)
    .map((id) => byId.get(id))
    .filter((f): f is ClassFeature => !!f)
    .map((f) => ({
      id: f.id,
      name: traitNameForDisplay(f),
      shortDescription: traitDescriptionForDisplay(f)
    }));
}

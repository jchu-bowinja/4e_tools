import type { CharacterBuild, ClassFeature, RulesIndex } from "./models";
import { characterSupportIds } from "./prereqContext";
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

/** Class feature ids the character currently has (build options, grants, path features, …). */
export function collectCharacterClassFeatureIds(index: RulesIndex, build: CharacterBuild): string[] {
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
  for (const sid of characterSupportIds(index, build)) {
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
    ...Object.values(build.hybridSideBSelections ?? {}),
    ...Object.values(build.classSelections ?? {})
  ]) {
    if (id?.startsWith("ID_")) add(byId.get(id));
  }

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

/** Trait rows for class features the build actually has (not the full class parsed list). */
export function getCharacterClassFeatureTraitRows(
  index: RulesIndex,
  build: CharacterBuild
): TraitDisplayRow[] {
  const { byId } = buildClassFeatureLookups(index);
  return collectCharacterClassFeatureIds(index, build)
    .map((id) => byId.get(id))
    .filter((f): f is ClassFeature => !!f)
    .map((f) => ({
      id: f.id,
      name: traitNameForDisplay(f),
      shortDescription: traitDescriptionForDisplay(f)
    }));
}

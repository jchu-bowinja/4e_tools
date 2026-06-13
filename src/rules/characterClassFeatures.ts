import {
  CLASS_FEATURE_CHOICE_NONE,
  filterVisibleClassFeatureChoiceGroups,
  getClassFeatureChoiceGroups,
  resolveClassFeatureChoiceIdsForGroup
} from "./classFeatureChoices";
import { selectedClassBuildOptionId } from "./classBuildOptions";
import type { CharacterBuild, ClassFeature, RulesIndex } from "./models";
import { collectRoleProgressionClassFeatureIds } from "./roleProgressionFeatures";
import {
  buildClassFeatureLookups,
  featureIsAvailableAtLevel,
  parseTraitIdsFromField,
  parseTraitNamesFromField,
  specOf,
  sortClassFeatureIdsByLevel,
  sortTraitDisplayRowsByLevel,
  traitDescriptionForDisplay,
  traitNameForDisplay,
  type TraitDisplayRow
} from "./supportTraits";
import { collectActiveDomainLabels, collectActiveTraitPackageIds } from "./traitPackageIds";

function grantRequirementMet(
  requires: string | undefined,
  activeIds: Set<string>,
  activeTraitPackages: Set<string>,
  activeDomainLabels: Set<string>,
  classSelections: Record<string, string> | undefined
): boolean {
  if (!requires?.trim()) return true;
  const parts = requires.includes("|")
    ? requires.split("|").map((p) => p.trim()).filter(Boolean)
    : [requires.trim()];
  for (const req of parts) {
    if (activeIds.has(req)) return true;
    if (activeTraitPackages.has(req)) return true;
    if (activeDomainLabels.has(req)) return true;
    if (classSelections && Object.values(classSelections).includes(req)) return true;
  }
  return false;
}

/** Follow `rules.grant type=Class Feature` chains from active features (pact progressions, …). */
export function expandClassFeatureIdsWithGrants(
  index: RulesIndex,
  seedIds: readonly string[],
  characterLevel: number,
  classSelections?: Record<string, string>
): string[] {
  const { byId } = buildClassFeatureLookups(index);
  const seen = new Set<string>();
  for (const fid of seedIds) {
    const feature = byId.get(fid);
    if (feature && featureIsAvailableAtLevel(feature, characterLevel)) seen.add(fid);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const traitPackages = collectActiveTraitPackageIds(index, seen);
    const domainLabels = collectActiveDomainLabels(index, seen);
    for (const fid of [...seen]) {
      const feature = byId.get(fid);
      if (!feature) continue;
      const childIds = [
        ...(feature.grantedClassFeatureIds ?? []),
        ...grantedClassFeatureIdsFromRaw(feature)
      ];
      for (const childId of childIds) {
        if (!childId.startsWith("ID_") || seen.has(childId)) continue;
        const child = byId.get(childId);
        if (!child || !featureIsAvailableAtLevel(child, characterLevel)) continue;
        const requires = grantRequiresForChild(feature, childId);
        if (!grantRequirementMet(requires, seen, traitPackages, domainLabels, classSelections)) continue;
        seen.add(childId);
        changed = true;
      }
    }
  }

  return sortClassFeatureIdsByLevel(index, [...seen]);
}

function grantedClassFeatureIdsFromRaw(feature: ClassFeature): string[] {
  const rules = feature.raw?.rules as
    | { grant?: Array<{ attrs?: Record<string, string> }> }
    | undefined;
  const out: string[] = [];
  for (const gr of rules?.grant ?? []) {
    const attrs = gr.attrs ?? {};
    if (attrs.type !== "Class Feature") continue;
    const cid = String(attrs.name ?? "").trim();
    if (cid.startsWith("ID_")) out.push(cid);
  }
  return out;
}

function grantRequiresForChild(feature: ClassFeature, childId: string): string | undefined {
  const rules = feature.raw?.rules as
    | { grant?: Array<{ attrs?: Record<string, string> }> }
    | undefined;
  for (const gr of rules?.grant ?? []) {
    const attrs = gr.attrs ?? {};
    if (attrs.type !== "Class Feature") continue;
    if (String(attrs.name ?? "").trim() === childId) {
      const req = String(attrs.requires ?? "").trim();
      return req || undefined;
    }
  }
  return undefined;
}

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

  const selectionId = selectedClassBuildOptionId(build.classSelections);
  if (selectionId?.startsWith("ID_FMP_CLASS_FEATURE_")) {
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
    for (const fid of collectRoleProgressionClassFeatureIds(index, build.classId, build.level)) {
      add(byId.get(fid));
    }
  }

  return sortClassFeatureIdsByLevel(index, ids);
}

/** Class feature ids the character currently has (build options, grants, path features, …). */
export function collectCharacterClassFeatureIds(index: RulesIndex, build: CharacterBuild): string[] {
  const { byId, byName } = buildClassFeatureLookups(index);
  const base = collectClassFeatureIdsFromClass(index, build);
  const ids = expandClassFeatureIdsWithGrants(index, base, build.level, build.classSelections);
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

  return expandClassFeatureIdsWithGrants(index, ids, build.level, build.classSelections);
}

/** Trait rows for class/hybrid features on the sheet (excludes path, destiny, theme, feats). */
export function getCharacterClassFeatureTraitRows(
  index: RulesIndex,
  build: CharacterBuild
): TraitDisplayRow[] {
  const { byId } = buildClassFeatureLookups(index);
  const rows = collectClassFeatureIdsFromClass(index, build)
    .map((id) => byId.get(id))
    .filter((f): f is ClassFeature => !!f)
    .map((f) => ({
      id: f.id,
      name: traitNameForDisplay(f),
      shortDescription: traitDescriptionForDisplay(f)
    }));
  return sortTraitDisplayRowsByLevel(rows, byId);
}

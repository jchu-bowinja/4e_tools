import { selectedClassBuildOptionId } from "./classBuildOptions";
import type { CharacterBuild, ClassFeature, RulesIndex } from "./models";
import {
  collectCountsAsClassNames,
  collectInternalGrantKeys,
  characterHasBloodline,
  characterHasKiFocusUser,
  characterHasPsionicSecondClass,
  characterHasUnlimitedMulticlass,
  hasMulticlassEntryFeat
} from "./featGrantFlags";
import { featureNameMatches } from "./featureNameMatch";
import { collectCharacterPowerIdsForSelections } from "./powerSelections";
import { collectActiveRacialTraitIdsFromBuild } from "./activeRacialTraits";
import {
  buildClassFeatureLookups,
  parseTraitIdsFromField,
  parseTraitNamesFromField,
  specOf
} from "./supportTraits";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Cached character facts for prereq evaluation (build once per resolveFeatOptions pass). */
export interface PrereqCharacterContext {
  powerNames: Set<string>;
  featNames: Set<string>;
  racialTraitNames: Set<string>;
  classFeatureNames: Set<string>;
  heritageLabels: Set<string>;
  powerSourceLabels: Set<string>;
  negatedClassIds: Set<string>;
  /** Class names from CountsAsClass on selected feats (multiclass training). */
  countsAsClassNames: Set<string>;
  /** Internal grant keys on selected feats (bloodline, ki focus, etc.). */
  internalGrantKeys: Set<string>;
  /** Has a class-specific multiclass training feat (CountsAsClass + Multiclass grant). */
  hasMulticlassEntryFeat: boolean;
  /** Character already has a bloodline internal grant. */
  hasBloodline: boolean;
  hasKiFocusUser: boolean;
  hasPsionicSecondClass: boolean;
  hasUnlimitedMulticlass: boolean;
}

export function buildPrereqCharacterContext(index: RulesIndex, build: CharacterBuild): PrereqCharacterContext {
  const featNames = characterFeatNames(index, build);
  const heritageLabels = new Set<string>();
  for (const name of featNames) {
    heritageLabels.add(name);
    for (const suffix of [" Heritage", " Bloodline"]) {
      if (name.endsWith(suffix)) {
        heritageLabels.add(name.slice(0, -suffix.length).trim());
      }
    }
  }
  return {
    powerNames: characterPowerNames(index, build),
    featNames,
    racialTraitNames: characterRacialTraitNames(index, build),
    classFeatureNames: characterClassFeatureNames(index, build),
    heritageLabels,
    powerSourceLabels: characterPowerSourceLabels(index, build),
    negatedClassIds: characterNegatedClassIds(build),
    countsAsClassNames: new Set(collectCountsAsClassNames(index, build).map((n) => norm(n))),
    internalGrantKeys: new Set(collectInternalGrantKeys(index, build)),
    hasMulticlassEntryFeat: hasMulticlassEntryFeat(index, build),
    hasBloodline: characterHasBloodline(index, build),
    hasKiFocusUser: characterHasKiFocusUser(index, build),
    hasPsionicSecondClass: characterHasPsionicSecondClass(index, build),
    hasUnlimitedMulticlass: characterHasUnlimitedMulticlass(index, build)
  };
}

export function characterSupportIds(index: RulesIndex, build: CharacterBuild): string[] {
  const ids: string[] = [];
  if (build.raceId) ids.push(build.raceId);
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
  if (build.themeId) ids.push(build.themeId);
  if (build.paragonPathId) ids.push(build.paragonPathId);
  if (build.epicDestinyId) ids.push(build.epicDestinyId);
  return ids;
}

export function characterPowerSourceLabels(index: RulesIndex, build: CharacterBuild): Set<string> {
  const out = new Set<string>();
  const addFromClass = (classId: string | undefined) => {
    if (!classId) return;
    const cls = index.classes.find((c) => c.id === classId);
    const ps = cls?.powerSource ?? (specOf(cls)?.["Power Source"] as string | undefined);
    if (ps) out.add(norm(ps));
  };
  if (build.characterStyle === "hybrid") {
    const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    addFromClass(ha?.baseClassId);
    addFromClass(hb?.baseClassId);
    for (const h of [ha, hb]) {
      const ps = h?.powerSource;
      if (ps) out.add(norm(ps));
    }
  } else {
    addFromClass(build.classId);
  }
  return out;
}

export function characterClassFeatureNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  const map = index.grantedClassFeatureNamesBySupportId ?? {};
  for (const sid of characterSupportIds(index, build)) {
    for (const n of map[sid] ?? []) {
      names.add(n);
    }
  }

  const { byId } = buildClassFeatureLookups(index);
  const addFeature = (f: ClassFeature | undefined) => {
    if (f?.name) names.add(f.name);
  };
  for (const id of [
    build.hybridTalentClassFeatureIdA,
    build.hybridTalentClassFeatureIdB,
    ...Object.values(build.hybridSideASelections ?? {}),
    ...Object.values(build.hybridSideBSelections ?? {}),
    ...Object.values(build.classSelections ?? {})
  ]) {
    if (id) addFeature(byId.get(id));
  }

  if (build.classId) {
    const picked = selectedClassBuildOptionId(build.classSelections);
    if (picked) {
      const opts = index.classBuildOptionsByClassId?.[build.classId] ?? [];
      const row = opts.find((o) => o.id === picked || o.name === picked);
      if (row?.name) names.add(row.name);
      else names.add(picked);
    }
  }

  if (build.paragonPathId) {
    const path = index.paragonPaths.find((p) => p.id === build.paragonPathId);
    for (const id of parseTraitIdsFromField(specOf(path), "Class Features")) {
      addFeature(byId.get(id));
    }
  }
  if (build.themeId) {
    const theme = index.themes.find((t) => t.id === build.themeId);
    for (const name of parseTraitNamesFromField(specOf(theme), "_PARSED_CLASS_FEATURE")) {
      names.add(name);
    }
  }
  if (build.epicDestinyId) {
    const ed = index.epicDestinies.find((e) => e.id === build.epicDestinyId);
    for (const id of parseTraitIdsFromField(specOf(ed), "Class Features")) {
      addFeature(byId.get(id));
    }
  }

  for (const fid of build.featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    for (const cfId of feat?.grantedClassFeatureIds ?? []) {
      addFeature(byId.get(cfId));
    }
    for (const fname of feat?.countsAsFeatureNames ?? []) {
      names.add(fname);
    }
    for (const cfId of feat?.countsAsFeatureIds ?? []) {
      addFeature(byId.get(cfId));
    }
  }

  return names;
}

export function characterHasClassFeature(
  index: RulesIndex,
  build: CharacterBuild,
  featureName: string
): boolean {
  const names = characterClassFeatureNames(index, build);
  for (const n of names) {
    if (featureNameMatches(featureName, n)) return true;
  }
  return false;
}

export function characterPowerNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  const powerIds = collectCharacterPowerIdsForSelections(index, build);
  const powerById = new Map(index.powers.map((power) => [power.id, power]));
  for (const id of powerIds) {
    const power = powerById.get(id);
    if (power?.name) names.add(power.name);
  }
  return names;
}

export function characterFeatNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  for (const id of build.featIds) {
    const f = index.feats.find((x) => x.id === id);
    if (f?.name) names.add(f.name);
  }
  return names;
}

export function characterRacialTraitNames(index: RulesIndex, build: CharacterBuild): Set<string> {
  const names = new Set<string>();
  const byId = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  for (const id of collectActiveRacialTraitIdsFromBuild(index, build)) {
    const t = byId.get(id);
    if (t?.name) names.add(t.name);
  }
  return names;
}

export function characterHeritageLabels(index: RulesIndex, build: CharacterBuild): Set<string> {
  const labels = new Set<string>();
  for (const name of characterFeatNames(index, build)) {
    labels.add(name);
    for (const suffix of [" Heritage", " Bloodline"]) {
      if (name.endsWith(suffix)) {
        labels.add(name.slice(0, -suffix.length).trim());
      }
    }
  }
  return labels;
}

export function characterNegatedClassIds(build: CharacterBuild): Set<string> {
  const ids = new Set<string>();
  if (build.classId) ids.add(build.classId);
  if (build.hybridClassIdA) ids.add(build.hybridClassIdA);
  if (build.hybridClassIdB) ids.add(build.hybridClassIdB);
  return ids;
}

import type { CharacterBuild, Feat, FeatPowerModification, RulesIndex } from "./models";
import { buildClassFeatureNameLookups, resolveClassFeatureReference } from "./classFeatureNameResolution";
import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import { resolveFeatPowerModifications } from "./grantedPowersQuery";
import { buildPowerNameLookups, resolvePowerReference } from "./powerNameResolution";
import { isFeatPowerAugmentation, resolveAugmentationText } from "./featPowerModifications";
import type { TraitDisplayRow } from "./supportTraits";

export type ClassFeatureFeatAugmentation = {
  featId: string;
  featName: string;
  text: string;
};

function resolveModificationClassFeatureId(
  mod: FeatPowerModification,
  powerLookups: ReturnType<typeof buildPowerNameLookups>,
  cfLookups: ReturnType<typeof buildClassFeatureNameLookups>
): string | undefined {
  const powerId =
    (mod.powerId && resolvePowerReference(mod.powerId, powerLookups)) ||
    resolvePowerReference(mod.powerName, powerLookups);
  if (powerId) return undefined;

  if (mod.classFeatureId?.trim()) {
    const fromEtl = resolveClassFeatureReference(mod.classFeatureId, cfLookups);
    if (fromEtl) return fromEtl;
  }
  return resolveClassFeatureReference(mod.powerName, cfLookups);
}

/**
 * Feat augmentations keyed by class feature id (for traits, not power cards).
 * Only includes modifications that do not resolve to a compendium power.
 */
export function collectFeatModificationsByClassFeatureId(
  index: RulesIndex,
  featIds: readonly string[]
): Map<string, ClassFeatureFeatAugmentation[]> {
  const powerLookups = buildPowerNameLookups(index.powers, index.featPowerNameAliases ?? {});
  const cfLookups = buildClassFeatureNameLookups(index.classFeatures ?? []);
  const byFeature = new Map<string, ClassFeatureFeatAugmentation[]>();

  for (const fid of featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    if (!feat) continue;

    for (const mod of resolveFeatPowerModifications(feat)) {
      if (!isFeatPowerAugmentation(mod)) continue;
      const classFeatureId = resolveModificationClassFeatureId(mod, powerLookups, cfLookups);
      if (!classFeatureId) continue;

      const text = resolveAugmentationText(mod, feat);
      if (!text) continue;

      const bucket = byFeature.get(classFeatureId) ?? [];
      bucket.push({ featId: feat.id, featName: feat.name, text });
      byFeature.set(classFeatureId, bucket);
    }
  }

  return byFeature;
}

/** Augmentations for class features this character has and selected feats modify. */
export function collectFeatClassFeatureModificationsForBuild(
  index: RulesIndex,
  build: CharacterBuild
): Array<{ classFeatureId: string; classFeatureName: string; augmentations: ClassFeatureFeatAugmentation[] }> {
  const activeIds = new Set(collectCharacterClassFeatureIds(index, build));
  const byFeature = collectFeatModificationsByClassFeatureId(index, build.featIds ?? []);
  const { byId } = buildClassFeatureNameLookups(index.classFeatures ?? []);
  const rows: Array<{
    classFeatureId: string;
    classFeatureName: string;
    augmentations: ClassFeatureFeatAugmentation[];
  }> = [];

  for (const [classFeatureId, augmentations] of byFeature) {
    if (!activeIds.has(classFeatureId) || augmentations.length === 0) continue;
    const feature = byId.get(classFeatureId);
    rows.push({
      classFeatureId,
      classFeatureName: feature?.name ?? classFeatureId,
      augmentations
    });
  }
  rows.sort((a, b) => a.classFeatureName.localeCompare(b.classFeatureName, undefined, { sensitivity: "base" }));
  return rows;
}

export function applyFeatModificationsToTraitRows(
  rows: TraitDisplayRow[],
  byClassFeatureId: Map<string, ClassFeatureFeatAugmentation[]>
): TraitDisplayRow[] {
  if (byClassFeatureId.size === 0) return rows;
  return rows.map((row) => {
    const augmentations = byClassFeatureId.get(row.id);
    if (!augmentations?.length) return row;
    return { ...row, featAugmentations: augmentations };
  });
}

import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import {
  collectFeatModificationsByPowerId,
  type PowerFeatModifications
} from "./featPowerModifications";
import type { CharacterBuild, ClassFeature, FeatPowerModification, RulesIndex } from "./models";
import { buildPowerNameLookups, resolvePowerReference } from "./powerNameResolution";

function resolveClassFeaturePowerModifications(feature: ClassFeature): FeatPowerModification[] {
  if (feature.powerModifications?.length) return feature.powerModifications;
  const rules = feature.raw?.rules as { modify?: Array<{ attrs?: Record<string, string> }> } | undefined;
  const out: FeatPowerModification[] = [];
  for (const row of rules?.modify ?? []) {
    const attrs = row.attrs;
    if (!attrs || String(attrs.type ?? "").toLowerCase() !== "power") continue;
    const powerName = String(attrs.name ?? "").trim();
    if (!powerName) continue;
    const field = String(attrs.Field ?? attrs.field ?? feature.name).trim();
    let value = String(attrs.value ?? "").trim();
    if (!value && field === "Keywords" && attrs["list-addition"]) {
      value = String(attrs["list-addition"]).trim();
    }
    if (!value) continue;
    out.push({
      powerName,
      powerId: powerName.startsWith("ID_FMP_POWER") ? powerName : null,
      classFeatureId: null,
      field,
      value
    });
  }
  return out;
}

function resolveModificationPowerId(
  mod: FeatPowerModification,
  lookups: ReturnType<typeof buildPowerNameLookups>
): string | undefined {
  const pid = mod.powerId?.trim();
  if (pid) {
    const resolved = resolvePowerReference(pid, lookups);
    if (resolved) return resolved;
  }
  return resolvePowerReference(mod.powerName, lookups);
}

/** Class-feature `rules.modify type=Power` patches keyed by target power id. */
export function collectClassFeatureModificationsByPowerId(
  index: RulesIndex,
  build: CharacterBuild
): Map<string, PowerFeatModifications> {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  const powerLookups = buildPowerNameLookups(index.powers, index.featPowerNameAliases ?? {});
  const byPower = new Map<string, PowerFeatModifications>();

  for (const fid of collectCharacterClassFeatureIds(index, build)) {
    const feature = byId.get(fid);
    if (!feature) continue;

    for (const mod of resolveClassFeaturePowerModifications(feature)) {
      const powerId = resolveModificationPowerId(mod, powerLookups);
      if (!powerId) continue;

      const bucket = byPower.get(powerId) ?? { augmentations: [], metadata: [] };
      const value = String(mod.value ?? "").trim();
      if (!value) continue;
      bucket.metadata.push({
        featId: feature.id,
        featName: feature.name,
        field: mod.field.trim(),
        value
      });
      byPower.set(powerId, bucket);
    }
  }

  return byPower;
}

function mergeModificationBucket(
  target: PowerFeatModifications,
  source: PowerFeatModifications
): void {
  target.augmentations.push(...source.augmentations);
  target.metadata.push(...source.metadata);
}

/** Feat and class-feature power card patches merged by power id. */
export function collectPowerModificationsByPowerId(
  index: RulesIndex,
  build: CharacterBuild
): Map<string, PowerFeatModifications> {
  const merged = collectFeatModificationsByPowerId(index, build.featIds ?? []);
  for (const [powerId, mods] of collectClassFeatureModificationsByPowerId(index, build)) {
    const bucket = merged.get(powerId) ?? { augmentations: [], metadata: [] };
    mergeModificationBucket(bucket, mods);
    merged.set(powerId, bucket);
  }
  return merged;
}

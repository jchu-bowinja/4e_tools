import type { Feat, FeatPowerModification, Power, RulesIndex } from "./models";
import { resolveFeatPowerModifications } from "./grantedPowersQuery";

/** Display text for a feat augmentation on a power card. */
export type FeatPowerAugmentation = {
  featId: string;
  featName: string;
  text: string;
};

/** Compendium field patch from a feat (Display, Action Type, Special, …). */
export type FeatPowerMetadataPatch = {
  featId: string;
  featName: string;
  field: string;
  value: string;
};

export type PowerFeatModifications = {
  augmentations: FeatPowerAugmentation[];
  metadata: FeatPowerMetadataPatch[];
};

const METADATA_FIELDS = new Set([
  "Display",
  "Action Type",
  "Attack Type",
  "Target",
  "Trigger",
  "Requirement",
  "Hit",
  "Miss",
  "Effect",
  "Special",
  "Power Usage",
  "Keywords",
  "Power Type",
  "Range"
]);

const FIELD_TO_LINE_LABEL: Record<string, string> = {
  "Action Type": "Action",
  "Attack Type": "Range/Area",
  Target: "Target",
  Trigger: "Trigger",
  Requirement: "Requirement",
  Hit: "Hit",
  Miss: "Miss",
  Effect: "Effect",
  Special: "Special"
};

/** Internal compendium flags (e.g. _UniversalImplement) — not shown on cards. */
export function isInternalFeatPowerMetadataField(field: string): boolean {
  const f = field.trim();
  return f.startsWith("_");
}

export function isFeatPowerMetadataField(field: string): boolean {
  const f = field.trim();
  if (!f || isInternalFeatPowerMetadataField(f)) return false;
  return METADATA_FIELDS.has(f);
}

/** Style / arena / domain augmentations (not compendium field patches). */
export function isFeatPowerAugmentation(mod: FeatPowerModification): boolean {
  return !isFeatPowerMetadataField(mod.field);
}

export function resolveAugmentationText(mod: FeatPowerModification, feat: Feat): string {
  const explicit = String(mod.value ?? "").trim();
  if (explicit) return explicit;
  const body = typeof feat.raw?.body === "string" ? feat.raw.body.trim() : "";
  if (body) return body;
  return String(feat.shortDescription ?? "").trim();
}

function resolveModificationPowerId(
  mod: FeatPowerModification,
  powerIdByName: Map<string, string>
): string | undefined {
  const pid = mod.powerId?.trim();
  if (pid && pid.startsWith("ID_")) return pid;
  const byName = powerIdByName.get(mod.powerName.trim().toLowerCase());
  if (byName) return byName;
  if (pid) return pid;
  return undefined;
}

/**
 * All feat modifications keyed by target power id for the given feat selection.
 */
export function collectFeatModificationsByPowerId(
  index: RulesIndex,
  featIds: readonly string[]
): Map<string, PowerFeatModifications> {
  const powerIdByName = new Map(index.powers.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const byPower = new Map<string, PowerFeatModifications>();

  for (const fid of featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    if (!feat) continue;

    for (const mod of resolveFeatPowerModifications(feat)) {
      const powerId = resolveModificationPowerId(mod, powerIdByName);
      if (!powerId) continue;

      const bucket = byPower.get(powerId) ?? { augmentations: [], metadata: [] };

      if (isFeatPowerMetadataField(mod.field)) {
        const value = String(mod.value ?? "").trim();
        if (!value) continue;
        bucket.metadata.push({
          featId: feat.id,
          featName: feat.name,
          field: mod.field.trim(),
          value
        });
      } else {
        const text = resolveAugmentationText(mod, feat);
        if (!text) continue;
        bucket.augmentations.push({
          featId: feat.id,
          featName: feat.name,
          text
        });
      }

      byPower.set(powerId, bucket);
    }
  }

  return byPower;
}

export function getFeatModificationsForPower(
  byPowerId: Map<string, PowerFeatModifications>,
  power: Pick<Power, "id" | "name">
): PowerFeatModifications | undefined {
  return byPowerId.get(power.id);
}

function upsertLine(
  lines: Array<{ label: string; text: string; segmentKey: string }>,
  label: string,
  text: string,
  segmentKey: string
): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const existing = lines.find((l) => l.label === label);
  if (existing) {
    if (!existing.text.toLowerCase().includes(trimmed.toLowerCase())) {
      existing.text = `${existing.text} ${trimmed}`.trim();
    }
    return;
  }
  lines.push({ label, text: trimmed, segmentKey });
}

export type CharacterPowerCardLine = {
  label: string;
  text: string;
  segmentKey: string;
};

export type CharacterPowerCardVmShape = {
  display: string;
  preAttackLines: CharacterPowerCardLine[];
  outcomeLines: CharacterPowerCardLine[];
  augmentationLines: FeatPowerAugmentation[];
};

/** Apply feat metadata patches and collect augmentation lines for a power card view model. */
export function applyFeatModificationsToPowerCardVm<T extends CharacterPowerCardVmShape>(
  vm: T,
  mods: PowerFeatModifications | undefined,
  powerId: string
): T {
  if (!mods || (mods.augmentations.length === 0 && mods.metadata.length === 0)) {
    return { ...vm, augmentationLines: [] };
  }

  const preAttackLines = vm.preAttackLines.map((l) => ({ ...l }));
  const outcomeLines = vm.outcomeLines.map((l) => ({ ...l }));
  let display = vm.display;

  const preAttackLabels = new Set(["Action", "Range/Area", "Target", "Trigger", "Requirement"]);

  for (const patch of mods.metadata) {
    if (isInternalFeatPowerMetadataField(patch.field)) continue;
    if (patch.field === "Display") {
      if (patch.value) display = patch.value;
      continue;
    }
    if (patch.field === "Keywords" || patch.field === "Power Usage" || patch.field === "Power Type") {
      continue;
    }
    const lineLabel = FIELD_TO_LINE_LABEL[patch.field];
    if (!lineLabel) continue;
    const segmentKey = `${powerId}-feat-${patch.featId}-${patch.field}`;
    if (preAttackLabels.has(lineLabel)) {
      upsertLine(preAttackLines, lineLabel, patch.value, segmentKey);
    } else {
      upsertLine(outcomeLines, lineLabel, patch.value, segmentKey);
    }
  }

  return {
    ...vm,
    display,
    preAttackLines,
    outcomeLines,
    augmentationLines: [...mods.augmentations]
  };
}

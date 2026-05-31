import type { Feat, FeatPowerModification, Power, RulesIndex } from "./models";
import { attackPowerBucketFromUsage } from "./classPowerSlots";
import { resolveFeatPowerModifications } from "./grantedPowersQuery";
import { buildPowerNameLookups, resolvePowerReference } from "./powerNameResolution";

type PowerCardUsageBucket = "atWill" | "encounter" | "daily" | "utility";

function splitKeywordTokens(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function usageBucketFromLabel(label: string): PowerCardUsageBucket | undefined {
  const u = label.toLowerCase();
  if (u.includes("at-will") || u.includes("at will")) return "atWill";
  if (u.includes("encounter")) return "encounter";
  if (u.includes("daily")) return "daily";
  if (u.includes("utility")) return "utility";
  return undefined;
}

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

/** Header/metadata change attributed to a feat (usage, keywords, type, display). */
export type FeatPowerMetadataNote = {
  featId: string;
  featName: string;
  /** Short line for the card, e.g. "Usage: Encounter" or "Keywords: +Reliable". */
  summary: string;
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

/** Merge keyword additions from feat metadata (case-insensitive dedupe). */
export function mergePowerKeywords(existing: readonly string[], additions: string): string[] {
  const add = splitKeywordTokens(additions);
  if (add.length === 0) return [...existing];
  const seen = new Set(existing.map((k) => k.toLowerCase()));
  const out = [...existing];
  for (const kw of add) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
}

const METADATA_NOTE_LABEL: Record<string, string> = {
  "Power Usage": "Usage",
  "Power Type": "Type",
  Keywords: "Keywords",
  Display: "Display"
};

export function formatFeatMetadataNoteSummary(field: string, value: string): string {
  const label = METADATA_NOTE_LABEL[field] ?? field;
  if (field === "Keywords") {
    const parts = splitKeywordTokens(value).map((k) => `+${k}`);
    return parts.length > 0 ? `${label}: ${parts.join(", ")}` : label;
  }
  return `${label}: ${value}`;
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
  lookups: ReturnType<typeof buildPowerNameLookups>
): string | undefined {
  const pid = mod.powerId?.trim();
  if (pid) {
    const resolved = resolvePowerReference(pid, lookups);
    if (resolved) return resolved;
  }
  return resolvePowerReference(mod.powerName, lookups);
}

/**
 * All feat modifications keyed by target power id for the given feat selection.
 */
export function collectFeatModificationsByPowerId(
  index: RulesIndex,
  featIds: readonly string[]
): Map<string, PowerFeatModifications> {
  const powerLookups = buildPowerNameLookups(index.powers, index.featPowerNameAliases ?? {});
  const byPower = new Map<string, PowerFeatModifications>();

  for (const fid of featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    if (!feat) continue;

    for (const mod of resolveFeatPowerModifications(feat)) {
      const powerId = resolveModificationPowerId(mod, powerLookups);
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
  usageLabel?: string;
  usageBucket?: PowerCardUsageBucket;
  powerType?: string;
  keywords?: string[];
  preAttackLines: CharacterPowerCardLine[];
  outcomeLines: CharacterPowerCardLine[];
  augmentationLines: FeatPowerAugmentation[];
  metadataNotes?: FeatPowerMetadataNote[];
};

/** Apply feat metadata patches and collect augmentation lines for a power card view model. */
export function applyFeatModificationsToPowerCardVm<T extends CharacterPowerCardVmShape>(
  vm: T,
  mods: PowerFeatModifications | undefined,
  powerId: string
): T {
  if (!mods || (mods.augmentations.length === 0 && mods.metadata.length === 0)) {
    return { ...vm, augmentationLines: [], metadataNotes: [] };
  }

  const preAttackLines = vm.preAttackLines.map((l) => ({ ...l }));
  const outcomeLines = vm.outcomeLines.map((l) => ({ ...l }));
  let display = vm.display;
  let usageLabel = vm.usageLabel;
  let usageBucket = vm.usageBucket;
  let powerType = vm.powerType;
  let keywords = vm.keywords ? [...vm.keywords] : undefined;
  const metadataNotes: FeatPowerMetadataNote[] = [];

  const preAttackLabels = new Set(["Action", "Range/Area", "Target", "Trigger", "Requirement"]);

  for (const patch of mods.metadata) {
    if (isInternalFeatPowerMetadataField(patch.field)) continue;
    const value = patch.value.trim();
    if (!value) continue;

    if (patch.field === "Display") {
      display = value;
      metadataNotes.push({
        featId: patch.featId,
        featName: patch.featName,
        summary: formatFeatMetadataNoteSummary(patch.field, value)
      });
      continue;
    }
    if (patch.field === "Power Usage") {
      usageLabel = value;
      usageBucket = usageBucketFromLabel(value) ?? attackPowerBucketFromUsage(value) ?? usageBucket;
      metadataNotes.push({
        featId: patch.featId,
        featName: patch.featName,
        summary: formatFeatMetadataNoteSummary(patch.field, value)
      });
      continue;
    }
    if (patch.field === "Power Type") {
      powerType = value;
      metadataNotes.push({
        featId: patch.featId,
        featName: patch.featName,
        summary: formatFeatMetadataNoteSummary(patch.field, value)
      });
      continue;
    }
    if (patch.field === "Keywords") {
      keywords = mergePowerKeywords(keywords ?? [], value);
      metadataNotes.push({
        featId: patch.featId,
        featName: patch.featName,
        summary: formatFeatMetadataNoteSummary(patch.field, value)
      });
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
    ...(usageLabel !== undefined ? { usageLabel } : {}),
    ...(usageBucket !== undefined ? { usageBucket } : {}),
    ...(powerType !== undefined ? { powerType } : {}),
    ...(keywords !== undefined ? { keywords } : {}),
    preAttackLines,
    outcomeLines,
    augmentationLines: [...mods.augmentations],
    metadataNotes
  };
}

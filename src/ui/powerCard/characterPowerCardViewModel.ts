import { attackPowerBucketFromUsage } from "../../rules/classPowerSlots";
import {
  applyFeatModificationsToPowerCardVm,
  type PowerFeatModifications
} from "../../rules/featPowerModifications";
import type { Power } from "../../rules/models";
import { powerCardUsageBucketFromLabel } from "./powerCardAccent";
import { splitPowerKeywords } from "./splitPowerKeywords";
import type { CharacterPowerCardLabeledLine, CharacterPowerCardViewModel } from "./types";

function labeledLine(label: string, text: string, segmentKey: string): CharacterPowerCardLabeledLine | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return { label, text: trimmed, segmentKey };
}

export function buildCharacterPowerCardViewModel(
  power: Power,
  featMods?: PowerFeatModifications
): CharacterPowerCardViewModel {
  const raw = (power.raw || {}) as Record<string, unknown>;
  const specific = (power.raw?.specific as Record<string, unknown> | undefined) || {};
  const usageLabel = String(specific["Power Usage"] || power.usage || "-");
  const usageBucket = powerCardUsageBucketFromLabel(usageLabel) ?? attackPowerBucketFromUsage(power.usage);
  const powerType = String(specific["Power Type"] || "-");
  const display = String(specific["Display"] || power.display || "").trim();
  const keywords = splitPowerKeywords(String(specific["Keywords"] || power.keywords || "").trim());

  const preAttackLines = [
    labeledLine("Action", String(specific["Action Type"] || ""), `${power.id}-action`),
    labeledLine("Range/Area", String(specific["Attack Type"] || ""), `${power.id}-attack-type`),
    labeledLine("Target", String(specific["Target"] || ""), `${power.id}-target`),
    labeledLine("Trigger", String(specific["Trigger"] || ""), `${power.id}-trigger`),
    labeledLine("Requirement", String(specific["Requirement"] || ""), `${power.id}-requirement`)
  ].filter((line): line is CharacterPowerCardLabeledLine => line != null);

  const outcomeLines = [
    labeledLine("Hit", String(specific["Hit"] || ""), `${power.id}-hit`),
    labeledLine("Miss", String(specific["Miss"] || ""), `${power.id}-miss`),
    labeledLine("Effect", String(specific["Effect"] || ""), `${power.id}-effect`),
    labeledLine("Special", String(specific["Special"] || ""), `${power.id}-special`)
  ].filter((line): line is CharacterPowerCardLabeledLine => line != null);

  const base: CharacterPowerCardViewModel = {
    id: power.id,
    name: power.name,
    usageLabel,
    usageBucket,
    powerType,
    level: power.level ?? null,
    display,
    keywords,
    preAttackLines,
    outcomeLines,
    augmentationLines: [],
    body: typeof raw.body === "string" ? raw.body : "",
    flavor: typeof raw.flavor === "string" ? raw.flavor : ""
  };

  return applyFeatModificationsToPowerCardVm(base, featMods, power.id);
}

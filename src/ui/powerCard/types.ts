export type PowerCardUsageBucket = "atWill" | "encounter" | "daily" | "utility";

import type { FeatPowerAugmentation, FeatPowerMetadataNote } from "../../rules/featPowerModifications";

export type CharacterPowerCardLabeledLine = {
  label: string;
  text: string;
  segmentKey: string;
};

export type CharacterPowerCardViewModel = {
  id: string;
  name: string;
  usageLabel: string;
  usageBucket: PowerCardUsageBucket;
  powerType: string;
  level: number | null;
  display: string;
  keywords: string[];
  preAttackLines: CharacterPowerCardLabeledLine[];
  outcomeLines: CharacterPowerCardLabeledLine[];
  /** Feat augmentations (style, arena fighting, domain) applied to this power. */
  augmentationLines: FeatPowerAugmentation[];
  /** Feat-driven header changes (usage, keywords, type, display). */
  metadataNotes: FeatPowerMetadataNote[];
  body: string;
  flavor: string;
};

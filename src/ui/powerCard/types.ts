export type PowerCardUsageBucket = "atWill" | "encounter" | "daily" | "utility";

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
  body: string;
  flavor: string;
};

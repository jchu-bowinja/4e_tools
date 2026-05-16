import type { AcBreakdown } from "./defenseCalculator";
import type { StatScoreColumnDef } from "../ui/StatScoreTable";

export type { StatScoreColumnDef };

export interface ScoreComponent {
  key: string;
  label: string;
  value: number;
}

export const MOTION_SPEED_COLUMNS: StatScoreColumnDef[] = [
  { key: "race", header: "Race" },
  { key: "armor", header: "Armor" },
  { key: "other", header: "Other" }
];

export const MOTION_INITIATIVE_COLUMNS: StatScoreColumnDef[] = [
  { key: "halfLevel", header: "½ Lvl" },
  { key: "dex", header: "DEX" },
  { key: "other", header: "Other" }
];

/** Single motion table: speed uses race/armor/other; initiative uses ½ lvl/DEX/other. */
export const MOTION_SCORE_COLUMNS: StatScoreColumnDef[] = [
  { key: "race", header: "Race" },
  { key: "armor", header: "Armor" },
  { key: "halfLevel", header: "½ Lvl" },
  { key: "dex", header: "DEX" },
  { key: "other", header: "Other" }
];

export function motionUnifiedRowValues(
  components: ScoreComponent[],
  kind: "speed" | "initiative"
): Record<string, number | null> {
  const keys = kind === "speed" ? ["race", "armor", "other"] : ["halfLevel", "dex", "other"];
  const partial = motionRowValues(components, keys);
  const out: Record<string, number | null> = {
    race: null,
    armor: null,
    halfLevel: null,
    dex: null,
    other: null
  };
  for (const key of keys) out[key] = partial[key];
  return out;
}

export const DEFENSE_SCORE_COLUMNS: StatScoreColumnDef[] = [
  { key: "baseHalfLevel", header: ["Base +", "½ Lvl"], width: "2.75rem" },
  { key: "ability", header: "Abil" },
  { key: "armor", header: "Armor" },
  { key: "shield", header: "Shield" },
  { key: "class", header: "Class" },
  { key: "feat", header: ["Feat", "Theme"] },
  { key: "magic", header: "Magic" },
  { key: "secondWind", header: ["2nd", "Wind"] }
];

export function rowValuesFromComponents(
  components: ScoreComponent[],
  columnKeys: string[]
): Record<string, number | null> {
  const byKey = new Map(components.map((c) => [c.key, c.value]));
  const out: Record<string, number | null> = {};
  for (const key of columnKeys) {
    out[key] = byKey.has(key) ? byKey.get(key)! : null;
  }
  return out;
}

const OPTIONAL_ZERO_AS_EM_DASH = new Set(["armor", "shield", "class", "feat", "magic", "secondWind", "other"]);

export function finalizeScoreRowValues(values: Record<string, number | null>): Record<string, number | null> {
  const out: Record<string, number | null> = { ...values };
  for (const [key, value] of Object.entries(out)) {
    if (value === 0 && OPTIONAL_ZERO_AS_EM_DASH.has(key)) out[key] = null;
  }
  return out;
}

export function motionRowValues(components: ScoreComponent[], columnKeys: string[]): Record<string, number | null> {
  return finalizeScoreRowValues(rowValuesFromComponents(components, columnKeys));
}

export function defenseRowValues(components: ScoreComponent[], secondWindBonus = 0): Record<string, number | null> {
  const byKey = new Map(components.map((c) => [c.key, c.value]));
  const base = byKey.get("base") ?? 10;
  const halfLevel = byKey.get("halfLevel") ?? 0;
  const values: Record<string, number | null> = {
    baseHalfLevel: base + halfLevel
  };
  for (const { key } of DEFENSE_SCORE_COLUMNS) {
    if (key === "baseHalfLevel") continue;
    values[key] = byKey.has(key) ? byKey.get(key)! : null;
  }
  if (secondWindBonus > 0) values.secondWind = secondWindBonus;
  return finalizeScoreRowValues(values);
}

export interface StatScoreBreakdown {
  components: ScoreComponent[];
  total: number;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

/** Human-readable score breakdown (e.g. "+2 ½ lvl · +3 DEX"). */
export function formatStatScoreBreakdown(breakdown: StatScoreBreakdown, options?: { includeZero?: boolean }): string {
  const includeZero = options?.includeZero ?? false;
  const parts = breakdown.components
    .filter((c) => includeZero || c.value !== 0)
    .map((c) => `${signed(c.value)} ${c.label}`);
  return parts.join(" · ");
}

export function buildAcScoreComponents(
  bd: AcBreakdown,
  options?: { magicItemBonus?: number; secondWindBonus?: number }
): ScoreComponent[] {
  const components: ScoreComponent[] = [
    { key: "base", label: "base", value: bd.base },
    { key: "halfLevel", label: "½ lvl", value: bd.halfLevel }
  ];
  if (bd.abilityLabel !== "—") {
    components.push({ key: "ability", label: bd.abilityLabel, value: bd.abilityBonus });
  }
  components.push(
    { key: "armor", label: "armor", value: bd.armorBonus },
    { key: "shield", label: "shield", value: bd.shieldBonus },
    { key: "feat", label: "feat/theme", value: bd.supportAcBonus }
  );
  const magic = options?.magicItemBonus ?? 0;
  const sw = options?.secondWindBonus ?? 0;
  if (magic !== 0) components.push({ key: "magic", label: "magic", value: magic });
  if (sw !== 0) components.push({ key: "secondWind", label: "2nd wind", value: sw });
  return components;
}

export function formatAcScoreBreakdown(
  bd: AcBreakdown,
  options?: { magicItemBonus?: number; secondWindBonus?: number }
): string {
  const magic = options?.magicItemBonus ?? 0;
  const sw = options?.secondWindBonus ?? 0;
  return formatStatScoreBreakdown({
    components: buildAcScoreComponents(bd, options),
    total: bd.total + magic + sw
  });
}

export function buildSpeedBreakdown(raceSpeed: number, armorPenalty: number, supportBonus: number): StatScoreBreakdown {
  const total = Math.max(0, raceSpeed - armorPenalty + supportBonus);
  return {
    components: [
      { key: "race", label: "race", value: raceSpeed },
      { key: "armor", label: "armor", value: -armorPenalty },
      { key: "other", label: "other", value: supportBonus }
    ],
    total
  };
}

export function buildInitiativeBreakdown(halfLevel: number, dexMod: number, supportBonus: number): StatScoreBreakdown {
  return {
    components: [
      { key: "halfLevel", label: "½ lvl", value: halfLevel },
      { key: "dex", label: "DEX", value: dexMod },
      { key: "other", label: "other", value: supportBonus }
    ],
    total: halfLevel + dexMod + supportBonus
  };
}

export function buildNadBreakdown(params: {
  halfLevel: number;
  abilityMod: number;
  abilityLabel: string;
  classBonus: number;
  supportBonus: number;
  magicItemBonus: number;
}): StatScoreBreakdown {
  const { halfLevel, abilityMod, abilityLabel, classBonus, supportBonus, magicItemBonus } = params;
  const total = 10 + halfLevel + abilityMod + classBonus + supportBonus + magicItemBonus;
  return {
    components: [
      { key: "base", label: "base", value: 10 },
      { key: "halfLevel", label: "½ lvl", value: halfLevel },
      { key: "ability", label: abilityLabel, value: abilityMod },
      { key: "class", label: "class", value: classBonus },
      { key: "feat", label: "feat/theme", value: supportBonus },
      { key: "magic", label: "magic", value: magicItemBonus }
    ],
    total
  };
}

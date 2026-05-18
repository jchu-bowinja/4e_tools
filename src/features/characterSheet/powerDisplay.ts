import { attackPowerBucketFromUsage } from "../../rules/classPowerSlots";
import type { Power } from "../../rules/models";
import type { PowerSheetGroupBy } from "./model";
import type { GroupedPowerCards } from "./selectors";

export type { PowerSheetGroupBy } from "./model";

export type UsageBucket = "atWill" | "encounter" | "daily";

export interface PowerDisplaySection {
  key: string;
  title: string;
  powers: Power[];
  sectionKind: PowerSheetGroupBy;
  usageBucket?: UsageBucket;
}

const USAGE_SECTIONS: { key: UsageBucket; title: string }[] = [
  { key: "atWill", title: "At-Will" },
  { key: "encounter", title: "Encounter" },
  { key: "daily", title: "Daily" }
];

const ACTION_TYPE_ORDER = [
  "standard",
  "move",
  "minor",
  "free",
  "immediate",
  "opportunity",
  "no action"
] as const;

export function normalizePowerGroupBy(value: unknown): PowerSheetGroupBy {
  return value === "actionType" ? "actionType" : "usage";
}

export function getPowerActionType(power: Power): string {
  const raw = power.raw || {};
  const specific = (raw.specific as Record<string, unknown> | undefined) || {};
  return String(specific["Action Type"] || "").trim();
}

export function powerUsageBucket(power: Power): UsageBucket {
  return attackPowerBucketFromUsage(power.usage);
}

function sortPowerCards(list: Power[]): Power[] {
  return [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name);
  });
}

function actionTypeSortKey(actionType: string): number {
  const lower = actionType.toLowerCase();
  if (!lower) return ACTION_TYPE_ORDER.length + 1;
  for (let i = 0; i < ACTION_TYPE_ORDER.length; i++) {
    if (lower.includes(ACTION_TYPE_ORDER[i])) return i;
  }
  return ACTION_TYPE_ORDER.length;
}

function actionTypeSectionKey(actionType: string): string {
  return actionType.trim() || "__other__";
}

function actionTypeSectionTitle(actionType: string): string {
  return actionType.trim() || "Other";
}

export function buildPowerDisplaySections(
  grouped: GroupedPowerCards,
  groupBy: PowerSheetGroupBy
): PowerDisplaySection[] {
  if (groupBy === "usage") {
    return USAGE_SECTIONS.map(({ key, title }) => ({
      key,
      title,
      powers: grouped[key],
      sectionKind: "usage",
      usageBucket: key
    }));
  }

  const all = [...grouped.atWill, ...grouped.encounter, ...grouped.daily];
  const byAction = new Map<string, Power[]>();
  for (const power of all) {
    const actionType = getPowerActionType(power);
    const key = actionTypeSectionKey(actionType);
    const list = byAction.get(key) ?? [];
    list.push(power);
    byAction.set(key, list);
  }

  return [...byAction.entries()]
    .sort(([aKey], [bKey]) => {
      const aType = aKey === "__other__" ? "" : aKey;
      const bType = bKey === "__other__" ? "" : bKey;
      const orderDiff = actionTypeSortKey(aType) - actionTypeSortKey(bType);
      if (orderDiff !== 0) return orderDiff;
      return actionTypeSectionTitle(aType).localeCompare(actionTypeSectionTitle(bType));
    })
    .map(([key, powers]) => ({
      key,
      title: actionTypeSectionTitle(key === "__other__" ? "" : key),
      powers: sortPowerCards(powers),
      sectionKind: "actionType" as const
    }));
}

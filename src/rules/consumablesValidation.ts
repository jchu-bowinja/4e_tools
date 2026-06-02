import type { CharacterBuild, RulesIndex } from "./models";
import {
  alchemyItemsFromIndex,
  martialPracticesFromIndex,
  ritualsFromIndex
} from "./consumablesCatalog";
import { consumableEntries } from "./consumablesModel";
import { ritualCasterStatusMessage } from "./ritualCasting";

function ritualLevelWarning(name: string, ritualLevel: number, characterLevel: number): string {
  return `${name} is level ${ritualLevel}; character is level ${characterLevel}.`;
}

export function consumablesBuildWarnings(index: RulesIndex, build: CharacterBuild): string[] {
  const warnings: string[] = [];
  const level = build.level;

  const ritualCasterMsg = ritualCasterStatusMessage(index, build);
  const ritualEntries = consumableEntries(build, "rituals");
  if (ritualCasterMsg && ritualEntries.length > 0) {
    warnings.push(ritualCasterMsg);
  }

  const ritualsById = new Map(ritualsFromIndex(index).map((r) => [r.id, r]));
  for (const entry of ritualEntries) {
    const ritual = ritualsById.get(entry.id);
    if (ritual?.level != null && ritual.level > level) {
      warnings.push(ritualLevelWarning(ritual.name, ritual.level, level));
    }
  }

  const practicesById = new Map(martialPracticesFromIndex(index).map((r) => [r.id, r]));
  for (const entry of consumableEntries(build, "martialPractices")) {
    const practice = practicesById.get(entry.id);
    if (practice?.level != null && practice.level > level) {
      warnings.push(ritualLevelWarning(practice.name.replace(/\s+Martial Practice$/i, ""), practice.level, level));
    }
  }

  const alchemyById = new Map(alchemyItemsFromIndex(index).map((a) => [a.id, a]));
  for (const entry of consumableEntries(build, "alchemy")) {
    const item = alchemyById.get(entry.id);
    if (item?.level != null && item.level > level) {
      warnings.push(`${item.name} is level ${item.level}; character is level ${level}.`);
    }
  }

  return warnings;
}

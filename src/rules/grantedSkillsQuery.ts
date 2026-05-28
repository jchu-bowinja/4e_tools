import type { CharacterBuild, RulesIndex } from "./models";
import { collectFeatGrantedSkillTrainingIds } from "./featGrantFlags";

function normalized(s: string): string {
  return s.trim().toLowerCase();
}

export function autoGrantedTrainedSkillIds(index: RulesIndex, build: CharacterBuild): string[] {
  const map = index.autoGrantedSkillTrainingNamesBySupportId ?? {};
  const supportIds: string[] = [];
  if (build.raceId) supportIds.push(build.raceId);
  if (build.characterStyle === "hybrid") {
    const ha = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hb = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    if (ha?.baseClassId) supportIds.push(ha.baseClassId);
    if (hb?.baseClassId) supportIds.push(hb.baseClassId);
  } else if (build.classId) {
    supportIds.push(build.classId);
  }
  if (build.themeId) supportIds.push(build.themeId);
  if (build.paragonPathId) supportIds.push(build.paragonPathId);
  if (build.epicDestinyId) supportIds.push(build.epicDestinyId);

  const names = new Set<string>();
  for (const sid of supportIds) {
    for (const n of map[sid] ?? []) {
      names.add(normalized(n));
    }
  }

  const bySkillName = new Map(index.skills.map((s) => [normalized(s.name), s.id]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const id = bySkillName.get(n);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of collectFeatGrantedSkillTrainingIds(index, build)) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Auto-granted plus manually selected trained skills (builder, sheet, validation). */
export function effectiveTrainedSkillIdsForBuild(index: RulesIndex, build: CharacterBuild): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of autoGrantedTrainedSkillIds(index, build)) {
    push(id);
  }
  for (const id of build.trainedSkillIds ?? []) {
    push(id);
  }
  return out;
}

export function effectiveTrainedSkillIdSet(index: RulesIndex, build: CharacterBuild): Set<string> {
  return new Set(effectiveTrainedSkillIdsForBuild(index, build));
}

/**
 * Reconcile stored trained skills with current auto-grants (matches builder `useEffect` logic).
 * Manual picks are ids not in the previous auto-grant set; result is manual ∪ current auto.
 */
export function reconcileTrainedSkillIds(
  index: RulesIndex,
  build: CharacterBuild,
  currentTrainedSkillIds: string[],
  previousAutoGrantedIds: Set<string>
): string[] {
  const auto = autoGrantedTrainedSkillIds(index, build);
  const manual = currentTrainedSkillIds.filter((id) => !previousAutoGrantedIds.has(id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...manual, ...auto]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}


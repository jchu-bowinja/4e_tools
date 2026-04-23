import type { CharacterBuild, RulesIndex } from "./models";

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
  for (const n of names) {
    const id = bySkillName.get(n);
    if (id) out.push(id);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}


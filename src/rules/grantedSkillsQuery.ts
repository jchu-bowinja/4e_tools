import type { CharacterBuild, RulesIndex } from "./models";

function normalized(s: string): string {
  return s.trim().toLowerCase();
}

export function autoGrantedTrainedSkillIds(index: RulesIndex, build: CharacterBuild): string[] {
  const map = index.autoGrantedSkillTrainingNamesBySupportId ?? {};
  const supportIds = [
    build.raceId,
    build.classId,
    build.themeId,
    build.paragonPathId,
    build.epicDestinyId
  ].filter((x): x is string => !!x);

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


import { CharacterBuild, RulesIndex } from "../../rules/models";

/** Class (or hybrid pair) and level summary for saved-character lists. */
export function formatSavedCharacterClassLevel(build: CharacterBuild, index: RulesIndex): string {
  const level = build.level ?? 1;
  if (build.characterStyle === "hybrid") {
    const hybridA = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
    const hybridB = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
    if (hybridA && hybridB) {
      return `${hybridA.name} / ${hybridB.name}, level ${level}`;
    }
    const partial = hybridA?.name ?? hybridB?.name;
    if (partial) {
      return `${partial}, level ${level}`;
    }
    return `Level ${level}`;
  }
  const cls = build.classId ? index.classes?.find((c) => c.id === build.classId) : undefined;
  if (cls?.name) {
    return `${cls.name}, level ${level}`;
  }
  return `Level ${level}`;
}

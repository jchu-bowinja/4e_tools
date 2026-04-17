import { Power, RulesIndex } from "./models";

export function powerTypeCategory(p: Power): "attack" | "utility" | "other" {
  const pt = String((p.raw?.specific as Record<string, unknown> | undefined)?.["Power Type"] || "").toLowerCase();
  if (pt.includes("attack")) return "attack";
  if (pt.includes("utility")) return "utility";
  return "other";
}

/** Class attack or utility powers whose printed level is at most `maxLevel`. */
export function getClassPowersForLevelRange(
  index: RulesIndex,
  classId: string | undefined,
  maxLevel: number,
  kind: "attack" | "utility"
): Power[] {
  if (!classId || maxLevel < 1) {
    return [];
  }
  const list = index.powers.filter((p) => {
    if (p.classId !== classId) return false;
    const level = p.level ?? 0;
    if (level < 1 || level > maxLevel) return false;
    return powerTypeCategory(p) === kind;
  });
  return [...list].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

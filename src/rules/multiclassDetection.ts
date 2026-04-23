import type { CharacterBuild, RulesIndex } from "./models";

/** Feats whose name or category suggests multiclass training (read-only spike for future rules). */
export function multiclassFeatIds(index: RulesIndex, build: CharacterBuild): string[] {
  const out: string[] = [];
  for (const id of build.featIds) {
    const f = index.feats.find((x) => x.id === id);
    if (!f) continue;
    const n = (f.name || "").toLowerCase();
    const c = (f.category || "").toLowerCase();
    if (n.includes("multiclass") || c.includes("multiclass")) out.push(id);
  }
  return out;
}

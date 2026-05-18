import type { CharacterBuild, RulesIndex } from "./models";
import { collectMulticlassFeatIds } from "./featGrantFlags";

/** Feats with Multiclass grant (or name/category fallback). */
export function multiclassFeatIds(index: RulesIndex, build: CharacterBuild): string[] {
  return collectMulticlassFeatIds(index, build);
}

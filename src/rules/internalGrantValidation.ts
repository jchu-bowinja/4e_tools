import type { CharacterBuild, RulesIndex } from "./models";
import { collectInternalGrantKeys } from "./featGrantFlags";

/** At most one psionic second-class talent; ki focus is informational only. */
export function validateInternalGrantFeats(index: RulesIndex, build: CharacterBuild): string[] {
  const errors: string[] = [];
  const keys = collectInternalGrantKeys(index, build);

  const psionicFeats: string[] = [];
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    if ((feat?.internalGrantKeys ?? []).includes("PSIONIC_SECOND_CLASS")) {
      psionicFeats.push(feat?.name ?? id);
    }
  }
  if (psionicFeats.length > 1) {
    errors.push(
      `Only one psionic second-class talent allowed (found: ${psionicFeats.join(", ")}).`
    );
  }

  const heritageEntries = (build.featIds ?? [])
    .map((id) => index.feats.find((f) => f.id === id))
    .filter((f) => {
      if (!f) return false;
      if ((f.internalGrantKeys ?? []).includes("HERITAGE")) return true;
      const n = f.name || "";
      return n.endsWith(" Heritage") || n.endsWith(" Bloodline");
    });
  if (heritageEntries.length > 1) {
    errors.push(
      `Only one heritage feat allowed (found: ${heritageEntries.map((f) => f?.name).filter(Boolean).join(", ")}).`
    );
  }

  return errors;
}

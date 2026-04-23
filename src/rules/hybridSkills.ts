import type { HybridClassDef } from "./models";

function stripSkillParen(text: string): string {
  return text.replace(/\([^)]*\)/g, "").trim();
}

/** Union of hybrid class skill names from both entries (strip "(Int)" style suffixes). */
export function hybridCombinedClassSkillNames(hA: HybridClassDef | undefined, hB: HybridClassDef | undefined): string[] {
  const names = new Set<string>();
  for (const raw of [hA?.classSkillsRaw, hB?.classSkillsRaw]) {
    if (!raw) continue;
    for (const part of String(raw).split(",")) {
      const n = stripSkillParen(part.trim());
      if (n) names.add(n);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** PHB3 hybrid: trained skills = 4 + Intelligence modifier (minimum 1 trained skill). */
export function expectedHybridTrainedSkillCount(intelligenceScore: number): number {
  const n = 4 + abilityMod(intelligenceScore);
  return Math.max(1, n);
}

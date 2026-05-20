import type { RacialTrait } from "./models";

/** `rules.grant` rows with `type` Racial Trait (e.g. Moon Elf Skill Bonuses → Insight Bonus). */
export function grantedRacialTraitIdsFromTrait(trait: RacialTrait | undefined): string[] {
  if (!trait) return [];
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const grants = rules?.grant;
  if (!Array.isArray(grants)) return [];
  const ids: string[] = [];
  for (const g of grants) {
    if (!g || typeof g !== "object") continue;
    const attrs = (g as { attrs?: Record<string, unknown> }).attrs;
    if (!attrs || typeof attrs !== "object") continue;
    if (String(attrs.type ?? "") !== "Racial Trait") continue;
    const name = String(attrs.name ?? "").trim();
    if (name.startsWith("ID_")) ids.push(name);
  }
  return ids;
}

/**
 * Append traits granted by active rows (CB-style grant chain).
 * Depth 2 covers wrapper → * Bonus traits; stops before deep cycles.
 */
export function expandRacialTraitIdsWithGrantedChildren(
  seedIds: string[],
  traitsById: Map<string, RacialTrait>,
  maxDepth = 2
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const queue: Array<{ id: string; depth: number }> = [];

  for (const id of seedIds) {
    const tid = id?.trim();
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    out.push(tid);
    queue.push({ id: tid, depth: 0 });
  }

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const grantedId of grantedRacialTraitIdsFromTrait(traitsById.get(id))) {
      if (seen.has(grantedId)) continue;
      seen.add(grantedId);
      out.push(grantedId);
      queue.push({ id: grantedId, depth: depth + 1 });
    }
  }

  return out;
}

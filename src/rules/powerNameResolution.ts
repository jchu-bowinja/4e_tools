/** Known compendium typos / shorthand in feat Associated Powers or modify rows. */
const FEAT_POWER_NAME_ALIASES: Record<string, string> = {
  "command's strike": "commander's strike",
  "predator's strike": "predator strike",
  "overhwleming strike": "overwhelming strike",
  "haunting sounds": "ghost sound",
  "ghost sounds": "ghost sound",
  /** Compendium mislabels modify target; feat augments Hand of Radiance (Invoker). */
  "hand of fury": "hand of radiance"
};

/** Collapse punctuation/spacing for fuzzy power name match (wolfpack → Wolf Pack). */
export function normalizePowerMatchKey(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/\u2019|\u2018/g, "'").replace(/`/g, "'");
  return s.replace(/[^a-z0-9]/g, "");
}

function applyAlias(lowerName: string): string {
  return FEAT_POWER_NAME_ALIASES[lowerName] ?? lowerName;
}

export type PowerNameLookups = {
  byExactName: Map<string, string>;
  byNormalizedKey: Map<string, string>;
  byId: Map<string, string>;
};

export function buildPowerNameLookups(
  powers: ReadonlyArray<{ id: string; name: string }>
): PowerNameLookups {
  const byExactName = new Map<string, string>();
  const byNormalizedKey = new Map<string, string>();
  const byId = new Map<string, string>();

  for (const p of powers) {
    const id = p.id.trim();
    const name = p.name.trim();
    if (!id || !name) continue;
    byId.set(id, name);
    const exact = name.toLowerCase();
    if (!byExactName.has(exact)) byExactName.set(exact, id);
    const norm = normalizePowerMatchKey(name);
    if (norm && !byNormalizedKey.has(norm)) byNormalizedKey.set(norm, id);
  }
  return { byExactName, byNormalizedKey, byId };
}

/** Resolve a feat power modification target from compendium id or display name. */
export function resolvePowerReference(
  nameOrId: string,
  lookups: PowerNameLookups
): string | undefined {
  const raw = nameOrId.trim();
  if (!raw) return undefined;

  if (raw.startsWith("ID_") && lookups.byId.has(raw)) {
    return raw;
  }

  const lower = applyAlias(raw.toLowerCase());
  const exact = lookups.byExactName.get(lower);
  if (exact) return exact;

  const norm = normalizePowerMatchKey(lower);
  const byNorm = lookups.byNormalizedKey.get(norm);
  if (byNorm) return byNorm;

  if (raw.startsWith("ID_")) return raw;
  return undefined;
}

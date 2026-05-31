/** Collapse punctuation/spacing for fuzzy power name match (wolfpack → Wolf Pack). */
export function normalizePowerMatchKey(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/\u2019|\u2018/g, "'").replace(/`/g, "'");
  return s.replace(/[^a-z0-9]/g, "");
}

export type PowerNameLookups = {
  byExactName: Map<string, string>;
  byNormalizedKey: Map<string, string>;
  byId: Map<string, string>;
  /** From `rules_index.json` `featPowerNameAliases` (ETL). */
  nameAliases: Record<string, string>;
};

export function buildPowerNameLookups(
  powers: ReadonlyArray<{ id: string; name: string }>,
  nameAliases: Record<string, string> = {}
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
  return { byExactName, byNormalizedKey, byId, nameAliases };
}

function applyAlias(lowerName: string, aliases: Record<string, string>): string {
  return aliases[lowerName] ?? lowerName;
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

  const lower = applyAlias(raw.toLowerCase(), lookups.nameAliases);
  const exact = lookups.byExactName.get(lower);
  if (exact) return exact;

  const norm = normalizePowerMatchKey(lower);
  const byNorm = lookups.byNormalizedKey.get(norm);
  if (byNorm) return byNorm;

  if (raw.startsWith("ID_")) return raw;
  return undefined;
}

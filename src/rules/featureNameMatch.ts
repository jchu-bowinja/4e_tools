/** Normalize class feature names for fuzzy comparison. */
export function normalizeFeatureName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function featureNameMatches(want: string, have: string): boolean {
  const w = normalizeFeatureName(want);
  const h = normalizeFeatureName(have);
  if (!w || !h) return false;
  if (w === h) return true;
  return h.includes(w) || w.includes(h);
}

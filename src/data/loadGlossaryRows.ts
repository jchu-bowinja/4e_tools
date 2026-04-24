import { sanitizeGlossaryRows, type GlossaryTermRow } from "./tooltipGlossary";
import { clearGlossaryStorage, loadGlossaryRowsFromStorage } from "./glossaryStorage";

const GLOSSARY_JSON_URL = "/generated/glossary_terms.json";

export async function fetchGlossaryTermRowsFromBundle(): Promise<GlossaryTermRow[]> {
  const response = await fetch(GLOSSARY_JSON_URL);
  if (!response.ok) return [];
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return sanitizeGlossaryRows(data as GlossaryTermRow[]);
}

/** Uses saved browser copy when present, otherwise the bundled JSON file. */
export async function loadInitialGlossaryRows(): Promise<GlossaryTermRow[]> {
  const stored = loadGlossaryRowsFromStorage();
  if (stored != null) return sanitizeGlossaryRows(stored);
  return fetchGlossaryTermRowsFromBundle();
}

/** Clears local override and returns rows from the bundled file. */
export async function reloadGlossaryRowsFromBundle(): Promise<GlossaryTermRow[]> {
  clearGlossaryStorage();
  return fetchGlossaryTermRowsFromBundle();
}

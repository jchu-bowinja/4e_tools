import type { GlossaryTermRow } from "./tooltipGlossary";

const GLOSSARY_STORAGE_KEY = "dnd4e_glossary_rows_v1";

function isGlossaryRowArray(value: unknown): value is GlossaryTermRow[] {
  return Array.isArray(value) && value.every((row) => row != null && typeof row === "object");
}

export function loadGlossaryRowsFromStorage(): GlossaryTermRow[] | null {
  const raw = window.localStorage.getItem(GLOSSARY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isGlossaryRowArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGlossaryRowsToStorage(rows: GlossaryTermRow[]): void {
  window.localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(rows));
}

export function clearGlossaryStorage(): void {
  window.localStorage.removeItem(GLOSSARY_STORAGE_KEY);
}

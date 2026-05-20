import type { MonsterEntryFile } from "./storage";

const SUSPICIOUS_WEAKNESS_NAME = new Set(["his", "against", "the", "a", "an", "to", "of"]);

/** Import-time warnings stored under `sections.importWarnings` (paste/MM3 parsers). */
export function readMonsterImportWarnings(sections: MonsterEntryFile["sections"]): string[] {
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) return [];
  const raw = (sections as Record<string, unknown>).importWarnings;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => String(w ?? "").trim())
    .filter(Boolean);
}

export type SuspiciousWeaknessEntry = {
  index: number;
  label: string;
};

/** Flags ETL/XML weakness rows whose name looks like a split clause fragment. */
export function findSuspiciousWeaknesses(
  weaknesses: MonsterEntryFile["weaknesses"]
): SuspiciousWeaknessEntry[] {
  if (!Array.isArray(weaknesses) || weaknesses.length === 0) return [];
  const out: SuspiciousWeaknessEntry[] = [];
  weaknesses.forEach((weakness, index) => {
    if (!weakness || typeof weakness !== "object" || Array.isArray(weakness)) return;
    const w = weakness as Record<string, unknown>;
    const name = String(w.name ?? "").trim();
    const details = String(w.details ?? "").trim();
    const rawAmount = w.amount;
    const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
    const hasAmount = Number.isFinite(amount) && amount !== 0;

    let suspicious = false;
    if (!name && !details) {
      suspicious = true;
    } else if (name && SUSPICIOUS_WEAKNESS_NAME.has(name.toLowerCase())) {
      suspicious = true;
    } else if (name.length > 0 && name.length <= 4 && !hasAmount && !details) {
      suspicious = true;
    } else if (/^against\b/i.test(name) && !details) {
      suspicious = true;
    }

    if (!suspicious) return;

    const amountPart = hasAmount ? `${amount} ` : "";
    const label = `${amountPart}${name}${details ? ` ${details}` : ""}`.trim() || "(empty)";
    out.push({ index, label });
  });
  return out;
}

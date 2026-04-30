export type ParsedSavingThrowConditionalBonus = {
  value: number;
  when: string;
  conditions?: string[];
  sourceLine?: string;
};

export type ParsedSavingThrowsDetail = {
  value?: number;
  conditionalBonuses?: ParsedSavingThrowConditionalBonus[];
  references?: string[];
  notes?: string[];
};

function normalizeSavingThrowText(raw: string): string {
  return raw
    .replace(/\beff\s+ects\b/gi, "effects")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSavingThrowConditionTerms(when: string): string[] {
  const cleaned = when.replace(/[.]+$/g, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s*,\s*|\s+and\s+/i)
    .map((part) => part.trim().replace(/^and\s+/i, "").trim())
    .filter(Boolean);
}

function parseSavingThrowSegment(
  segment: string,
  sourceLine: string
): { conditional?: ParsedSavingThrowConditionalBonus; reference?: string } {
  const s = normalizeSavingThrowText(segment).replace(/[;]+$/g, "").trim();
  if (!s) return {};
  const refMatch = s.match(/^see(?:\s+also)?\s+(.+)$/i);
  if (refMatch?.[1]) {
    return { reference: refMatch[1].replace(/[.]+$/g, "").trim() };
  }
  const condMatch = s.match(/^([+-]?\d+)\s+against\s+(.+)$/i);
  if (condMatch?.[2]) {
    const value = Number.parseInt(condMatch[1], 10);
    const when = condMatch[2].replace(/[.]+$/g, "").trim();
    if (Number.isFinite(value) && when) {
      const conditions = splitSavingThrowConditionTerms(when);
      return {
        conditional: {
          value,
          when,
          ...(conditions.length ? { conditions } : {}),
          sourceLine
        }
      };
    }
  }
  return {};
}

export function parseSavingThrowsDetail(rawLine: string): ParsedSavingThrowsDetail {
  const sourceLine = rawLine.trim();
  const tailRaw = sourceLine.replace(/^saving\s*throws?\s*/i, "").trim();
  const tail = normalizeSavingThrowText(tailRaw).replace(/[.]+$/g, "").trim();
  if (!tail) return {};

  const conditionalBonuses: ParsedSavingThrowConditionalBonus[] = [];
  const references: string[] = [];
  const notes: string[] = [];

  const pushConditional = (entry?: ParsedSavingThrowConditionalBonus) => {
    if (!entry) return;
    const key = `${entry.value}|${entry.when.toLowerCase()}`;
    const exists = conditionalBonuses.some((x) => `${x.value}|${x.when.toLowerCase()}` === key);
    if (!exists) conditionalBonuses.push(entry);
  };
  const pushReference = (ref?: string) => {
    if (!ref) return;
    const clean = ref.trim();
    if (!clean) return;
    if (!references.some((x) => x.toLowerCase() === clean.toLowerCase())) references.push(clean);
  };

  const parenClauses = [...tail.matchAll(/\(([^)]+)\)/g)].map((m) => String(m[1] ?? "").trim()).filter(Boolean);
  for (const clause of parenClauses) {
    const parsed = parseSavingThrowSegment(clause, sourceLine);
    pushConditional(parsed.conditional);
    pushReference(parsed.reference);
  }

  const tailNoParens = tail.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  let baseValue: number | undefined;
  const baseAtStart = tailNoParens.match(/^([+-]?\d+)\b(.*)$/);
  if (baseAtStart) {
    const maybeBase = Number.parseInt(baseAtStart[1], 10);
    const restAfterBase = String(baseAtStart[2] ?? "").trim();
    if (/^against\b/i.test(restAfterBase)) {
      const parsed = parseSavingThrowSegment(`${baseAtStart[1]} ${restAfterBase}`, sourceLine);
      pushConditional(parsed.conditional);
    } else if (Number.isFinite(maybeBase)) {
      baseValue = maybeBase;
    }
  }

  for (const seg of tailNoParens.split(";").map((x) => x.trim()).filter(Boolean)) {
    if (/^[+-]?\d+$/.test(seg)) continue;
    const parsed = parseSavingThrowSegment(seg, sourceLine);
    if (parsed.conditional || parsed.reference) {
      pushConditional(parsed.conditional);
      pushReference(parsed.reference);
      continue;
    }
    if (seg) notes.push(seg);
  }

  return {
    ...(baseValue !== undefined ? { value: baseValue } : {}),
    ...(conditionalBonuses.length ? { conditionalBonuses } : {}),
    ...(references.length ? { references } : {}),
    ...(notes.length ? { notes } : {})
  };
}

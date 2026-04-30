import type {
  MonsterTemplatePasteResistanceEntryOptionB,
  MonsterTemplatePasteSkillEntryOptionB,
  MonsterTemplatePasteStatsOptionB
} from "./storage";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function ordinalLevel(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function titleCaseSkill(slug: string): string {
  return slug
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function getNumber(stats: Record<string, unknown>, altKeys: string[]): number | undefined {
  for (const k of altKeys) {
    const v = stats[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function coerceHitPointsPerLevel(hp: Record<string, unknown>): number | undefined {
  const n =
    getNumber(hp, ["perLevel", "per_level"]) ??
    (typeof hp.default === "object" && hp.default !== null
      ? getNumber(hp.default as Record<string, unknown>, ["perLevel", "per_level"])
      : undefined);
  return n;
}

function coerceHitPointsAddCon(hp: Record<string, unknown>): boolean {
  if (hp.addConstitution === true || hp.add_constitution === true) return true;
  const d = hp.default;
  if (isRecord(d) && (d.addConstitution === true || d.add_constitution === true)) return true;
  return false;
}

function formatHitPointsFormulaFragment(hp: Record<string, unknown>): string {
  const per = coerceHitPointsPerLevel(hp);
  const addCon = coerceHitPointsAddCon(hp);
  const parts: string[] = [];
  if (per !== undefined) parts.push(`${per >= 0 ? "+" : ""}${per} per level`);
  if (addCon) parts.push("+ Constitution score");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function formatHitPointsLines(stats: Record<string, unknown>): string[] {
  const hpRaw = stats.hitPoints;
  if (!isRecord(hpRaw)) return [];
  const hp = hpRaw;
  const variants = hp.variants;
  /** Dual-role templates store only `variants` (no default). Single-template uses `default` or flat formula. */
  if (Array.isArray(variants) && variants.length > 0) {
    const lines: string[] = [];
    for (const v of variants) {
      if (!isRecord(v)) continue;
      const role = v.when && isRecord(v.when) ? String(v.when.role ?? "").trim() : "";
      const formula = formatHitPointsFormulaFragment(v);
      if (!formula) continue;
      lines.push(role ? `Hit Points ${formula} (${role})` : `Hit Points ${formula}`);
    }
    return lines;
  }

  const merged =
    hp.default && isRecord(hp.default) ? { ...hp, ...(hp.default as Record<string, unknown>) } : hp;
  const formula = formatHitPointsFormulaFragment(merged);
  return formula ? [`Hit Points ${formula}`] : [];
}

function formatDefensesLine(defenses: Record<string, number>): string {
  const order = ["AC", "FORTITUDE", "REFLEX", "WILL"] as const;
  const used = new Set<string>();
  const parts: string[] = [];
  for (const canon of order) {
    const key = Object.keys(defenses).find((k) => k.toUpperCase() === canon);
    if (!key) continue;
    used.add(key);
    const n = defenses[key];
    const sign = n >= 0 ? "+" : "";
    const label =
      canon === "AC"
        ? "AC"
        : canon === "FORTITUDE"
          ? "Fortitude"
          : canon === "REFLEX"
            ? "Reflex"
            : "Will";
    parts.push(`${label} ${sign}${n}`);
  }
  for (const [k, n] of Object.entries(defenses)) {
    if (used.has(k)) continue;
    const sign = n >= 0 ? "+" : "";
    parts.push(`${k} ${sign}${n}`);
  }
  return `Defenses ${parts.join("; ")}`;
}

function formatResistanceEntry(prefix: "Resist" | "Vulnerable", e: MonsterTemplatePasteResistanceEntryOptionB): string {
  if (e.kind === "keyword" && e.type) {
    return `${prefix} ${e.type}`;
  }
  if (e.kind === "variable" && e.tiers) {
    const tiers = e.tiers;
    const riders = e.tierRiders ?? {};
    const segments: string[] = [];
    for (const lvl of ["1", "11", "21"] as const) {
      const amt = tiers[lvl];
      if (amt === undefined) continue;
      const rider = riders[lvl]?.trim();
      const ord = lvl === "1" ? "1st" : lvl === "11" ? "11th" : "21st";
      const mid = rider ? `${amt} (${rider})` : String(amt);
      segments.push(`${mid} at ${ord} level`);
    }
    return `${prefix} ${segments.join(", ")}`;
  }
  const t = (e.type ?? "").toLowerCase();
  if (e.plusHalfLevel && e.baseAmount !== undefined && t) {
    return `${prefix} ${e.baseAmount} + 1/2 level ${t}`;
  }
  if (e.tiers && t) {
    const tier = e.tiers;
    const t1 = tier["1"];
    const t11 = tier["11"];
    const t21 = tier["21"];
    if (t1 !== undefined && t11 !== undefined && t21 !== undefined) {
      if (t1 === t11 && t11 === t21) {
        return `${prefix} ${t1} ${t}`;
      }
      return `${prefix} ${t1} ${t} at 1st level, ${t11} ${t} at 11th level, ${t21} ${t} at 21st level`;
    }
    const parts: string[] = [];
    for (const lvl of ["1", "11", "21"] as const) {
      const v = tier[lvl];
      if (v === undefined) continue;
      const n = Number.parseInt(lvl, 10);
      parts.push(`${v} ${t} at ${ordinalLevel(n)} level`);
    }
    return `${prefix} ${parts.join(", ")}`;
  }
  if (t) return `${prefix} ${t}`;
  return prefix;
}

function normalizeResistanceEntries(raw: unknown): MonsterTemplatePasteResistanceEntryOptionB[] {
  if (!raw) return [];
  if (isRecord(raw) && Array.isArray(raw.entries)) {
    return raw.entries.filter(Boolean) as MonsterTemplatePasteResistanceEntryOptionB[];
  }
  if (!Array.isArray(raw)) return [];
  const out: MonsterTemplatePasteResistanceEntryOptionB[] = [];
  for (const chunk of raw) {
    if (!isRecord(chunk)) continue;
    for (const [dmgType, vals] of Object.entries(chunk)) {
      if (!Array.isArray(vals) || vals.length === 0) continue;
      const lo = dmgType.toLowerCase();
      if (vals.length >= 3) {
        out.push({
          kind: "typed",
          type: lo,
          tiers: { "1": vals[0], "11": vals[1], "21": vals[2] }
        });
      } else {
        out.push({
          kind: "typed",
          type: lo,
          tiers: { "1": vals[0], "11": vals[0], "21": vals[0] }
        });
      }
    }
  }
  return out;
}

function formatSkillsLine(entries: MonsterTemplatePasteSkillEntryOptionB[]): string {
  const parts = entries.map((e) => {
    const name = titleCaseSkill(e.skill);
    const sign = e.value >= 0 ? "+" : "";
    const trained = e.trained ? " (trained)" : "";
    return `${name} ${sign}${e.value}${trained}`;
  });
  return `Skills ${parts.join(", ")}`;
}

function formatSensesLine(
  senses: Array<{ name: string; range?: number } | Record<string, unknown>>
): string {
  const parts = senses.map((s) => {
    if (!isRecord(s)) return "";
    const name = String(s.name ?? "").trim();
    const range = typeof s.range === "number" && Number.isFinite(s.range) ? s.range : 0;
    if (!name) return "";
    return range > 0 ? `${name} ${range}` : name;
  }).filter(Boolean);
  return `Senses ${parts.join(", ")}`;
}

function pushStringNotes(stats: Record<string, unknown>, key: string, lines: string[]): void {
  const v = stats[key];
  if (typeof v === "string" && v.trim()) {
    lines.push(v.trim());
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) {
      if (typeof x === "string" && x.trim()) lines.push(x.trim());
    }
  }
}

/**
 * Builds book-style stat adjustment lines from parsed template `stats` (Option B / Python ETL).
 * Returns `null` when there is nothing mechanical to render — callers should fall back to `statLines`.
 */
export function formatMonsterTemplateStatAdjustmentLines(
  stats: Record<string, unknown> | MonsterTemplatePasteStatsOptionB | undefined
): string[] | null {
  if (!stats || typeof stats !== "object") return null;

  const lines: string[] = [];

  const defenses = stats.defenses;
  if (isRecord(defenses)) {
    const nums: Record<string, number> = {};
    for (const [k, v] of Object.entries(defenses)) {
      if (typeof v === "number" && Number.isFinite(v)) nums[k] = v;
    }
    if (Object.keys(nums).length > 0) {
      lines.push(formatDefensesLine(nums));
    }
  }
  pushStringNotes(stats, "defenseNotes", lines);

  const hpLines = formatHitPointsLines(stats as Record<string, unknown>);
  if (hpLines.length) lines.push(...hpLines);

  const stObj = stats.savingThrows;
  if (isRecord(stObj)) {
    let s = "Saving Throws";
    if (typeof stObj.value === "number") {
      const v = stObj.value;
      const sign = v >= 0 ? "+" : "";
      s += ` ${sign}${v}`;
    }
    const conditionalBonuses = Array.isArray(stObj.conditionalBonuses)
      ? stObj.conditionalBonuses
          .filter((entry): entry is { value: number; when: string } => {
            return (
              isRecord(entry) &&
              typeof entry.value === "number" &&
              Number.isFinite(entry.value) &&
              typeof entry.when === "string" &&
              entry.when.trim().length > 0
            );
          })
          .map((entry) => {
            const condSign = entry.value >= 0 ? "+" : "";
            return `${condSign}${entry.value} against ${entry.when.trim()}`;
          })
      : [];
    if (conditionalBonuses.length > 0) {
      s += `${typeof stObj.value === "number" ? "; " : " "}${conditionalBonuses.join("; ")}`;
    }
    const references = Array.isArray(stObj.references)
      ? stObj.references.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (references.length > 0) {
      const refsText = references.map((ref) => `see ${ref}`).join("; ");
      s += `${typeof stObj.value === "number" || conditionalBonuses.length > 0 ? "; " : " "}${refsText}`;
    }
    const notes = stObj.notes;
    if (Array.isArray(notes) && notes.length) {
      const cleanNotes = notes.map((n) => String(n).trim()).filter(Boolean);
      for (const note of cleanNotes) {
        const normalizedNote = note.toLowerCase();
        const duplicateConditional = conditionalBonuses.some((cond) => cond.toLowerCase() === normalizedNote);
        if (!duplicateConditional) s += `; ${note}`;
      }
    }
    if (s !== "Saving Throws") lines.push(s);
  } else {
    const stNum = getNumber(stats as Record<string, unknown>, ["savingThrows"]);
    if (stNum !== undefined) {
      const sign = stNum >= 0 ? "+" : "";
      lines.push(`Saving Throws ${sign}${stNum}`);
    }
  }
  pushStringNotes(stats, "savingThrowNotes", lines);

  const apObj = stats.actionPoints;
  if (isRecord(apObj) && typeof apObj.value === "number") {
    lines.push(`Action Points ${apObj.value}`);
  } else {
    const ap = getNumber(stats as Record<string, unknown>, ["actionPoints"]);
    if (ap !== undefined) {
      lines.push(`Action Points ${ap}`);
    }
  }

  const inObj = stats.initiative;
  if (isRecord(inObj) && typeof inObj.value === "number") {
    const v = inObj.value;
    const sign = v >= 0 ? "+" : "";
    lines.push(`Initiative ${sign}${v}`);
  } else {
    const ini = getNumber(stats as Record<string, unknown>, ["initiative"]);
    if (ini !== undefined) {
      const sign = ini >= 0 ? "+" : "";
      lines.push(`Initiative ${sign}${ini}`);
    }
  }

  const sp = stats.speed;
  if (isRecord(sp) && typeof sp.raw === "string" && sp.raw.trim()) {
    lines.push(`Speed ${sp.raw.trim()}`);
  }

  const skills = stats.skills;
  if (isRecord(skills) && Array.isArray(skills.entries) && skills.entries.length > 0) {
    lines.push(formatSkillsLine(skills.entries as MonsterTemplatePasteSkillEntryOptionB[]));
  }

  const senses = stats.senses;
  if (Array.isArray(senses) && senses.length > 0) {
    lines.push(formatSensesLine(senses));
  }

  const immunities = stats.immunities;
  if (Array.isArray(immunities) && immunities.length > 0) {
    const flat = immunities.map((x) => String(x).trim()).filter(Boolean);
    if (flat.length) {
      lines.push(`Immune ${flat.join(", ")}`);
    }
  }

  const resEntries = normalizeResistanceEntries(stats.resistances);
  for (const e of resEntries) {
    lines.push(formatResistanceEntry("Resist", e));
  }
  pushStringNotes(stats, "resistanceNotes", lines);

  const vulnEntries = normalizeResistanceEntries(stats.vulnerabilities);
  for (const e of vulnEntries) {
    lines.push(formatResistanceEntry("Vulnerable", e));
  }
  pushStringNotes(stats, "vulnerabilityNotes", lines);

  const regen = getNumber(stats as Record<string, unknown>, ["regeneration"]);
  if (regen !== undefined) {
    lines.push(`Regeneration ${regen}`);
  }

  const unparsed = stats.unparsedStatLines;
  if (Array.isArray(unparsed)) {
    for (const u of unparsed) {
      if (typeof u === "string" && u.trim()) {
        lines.push(u.trim());
      }
    }
  }

  return lines.length > 0 ? lines : null;
}

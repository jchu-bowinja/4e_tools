import type { MonsterEntryFile, MonsterPower, MonsterStats, MonsterTrait } from "./storage";
import { normalizeMonsterPowerShape } from "./monsterPowerNormalize";

/** Fix common OCR line breaks inside words (MM3 PDF extracts). */
export function normalizeMm3OcrLine(line: string): string {
  return line
    .replace(/\bRefl\s+ex\b/gi, "Reflex")
    .replace(/\bDefl\s+ection\b/gi, "Deflection")
    .replace(/\bdefl\s+ect\b/gi, "deflect")
    .replace(/\bfl\s+y\b/gi, "fly")
    .replace(/\bfi\s+re\b/gi, "fire")
    .replace(/\bfi\s+ve\b/gi, "five")
    .replace(/\bdiff\s+erent\b/gi, "different")
    .replace(/\bdiff\s+icult\b/gi, "difficult")
    .replace(/\bpetrifi\s+ed\b/gi, "petrified")
    .replace(/\bsacrifi\s+ce\b/gi, "sacrifice")
    .replace(/\beff\s+ects\b/gi, "effects")
    .replace(/\beff\s+ect\b/gi, "effect")
    .replace(/\bfl\s+anks\b/gi, "flanks")
    .replace(/\bfl\s+anking\b/gi, "flanking")
    .replace(/\s+/g, " ")
    .trim();
}

const INIT_SENSES_RE = /^Initiative\s+([+-]?\d+)\s+Senses\s+(.+)$/i;

const HP_MM3_RE =
  /^HP\s+([\d,]+)\s*;\s*Bloodied\s+([\d,]+)(?:\s*;\s*(.+))?$/i;

/** e.g. minion: HP 1; a missed attack never damages a minion. */
const HP_MM3_NO_BLOODIED_RE = /^HP\s+([\d,]+)\s*;\s*(?!Bloodied\b)(.+)$/i;

/** AC; Fortitude, Reflex, Will — Reflex may be OCR'd as Refl ex */
const AC_MM3_RE =
  /^AC\s+(\d+)\s*;\s*Fortitude\s+(\d+)\s*,\s*Reflex\s+(\d+)\s*,\s*Will\s+(\d+)(?:\s*;\s*(.+))?$/i;

const SAVING_THROWS_ONLY_RE = /^Saving Throws\s+([+-]?\d+)\s*$/i;
const ACTION_POINTS_ONLY_RE = /^Action Points\s+(\d+)\s*$/i;

/** Power line: leading m/M/C/R/r/A + name; optional (types); optional ✦ keywords */
const MM3_POWER_LEAD_RE = /^([mMcCrRaA])\s+(.+)$/;

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}

function titleCaseAlign(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "evil") return "Evil";
  if (t === "good") return "Good";
  if (t === "unaligned") return "Unaligned";
  if (t === "any") return "Any";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseLanguages(rest: string): string[] {
  if (!rest?.trim()) return [];
  const t = rest.replace(/^Languages\s+/i, "").trim();
  if (t === "—" || t === "-" || /^none$/i.test(t)) return [];
  return t.split(/,/).map((p) => p.trim()).filter(Boolean);
}

function parseAbilityScoresFromLines(lines: string[]): Record<string, number | string> {
  const scores: Record<string, number | string> = {};
  const abiRe = /\b(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s*\(([^)]+)\)/gi;
  for (const line of lines) {
    let m: RegExpExecArray | null;
    while ((m = abiRe.exec(line)) !== null) {
      scores[m[1].toUpperCase()] = Number.parseInt(m[2], 10);
    }
  }
  return scores;
}

function parseSkillsLine(line: string): Record<string, number | string> {
  const m = line.match(/^Skills\s+(.+)$/i);
  if (!m) return {};
  const body = m[1];
  const parts = body.split(/,(?![^(]*\))/);
  const skills: Record<string, number | string> = {};
  for (const part of parts) {
    const p = part.trim();
    const mm = p.match(/^(.+?)\s+([+-][\d]+)$/);
    if (mm) skills[mm[1].trim()] = mm[2];
  }
  return skills;
}

/** footer = Alignment | Skills | ability block start */
function findMm3FooterIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i].trim();
    if (/^Alignment\b/i.test(L)) return i;
    if (/^Skills\b/i.test(L)) return i;
    if (/^Str\s+\d+/i.test(L)) return i;
  }
  return lines.length;
}


function extractPerceptionFromSenses(sensesTail: string): string | undefined {
  const m = sensesTail.match(/Perception\s+([+-]?\d+)/i);
  return m ? m[1].trim() : undefined;
}

function parseSpeedToMovement(speedPart: string): Array<{ type: string; value: string | number }> {
  const out: Array<{ type: string; value: string | number }> = [];
  const cleaned = speedPart.replace(/^Speed\s+/i, "").split(";")[0]?.trim() ?? "";
  if (!cleaned) return out;
  const chunks = cleaned.split(/,\s*/);
  for (const chunk of chunks) {
    const fly = chunk.match(/^fly\s+(\d+)/i);
    if (fly) {
      out.push({ type: "Fly", value: Number(fly[1]) });
      continue;
    }
    const swim = chunk.match(/^swim\s+(\d+)/i);
    if (swim) {
      out.push({ type: "Swim", value: Number(swim[1]) });
      continue;
    }
    const climb = chunk.match(/^climb\s+(\d+)/i);
    if (climb) {
      out.push({ type: "Climb", value: Number(climb[1]) });
      continue;
    }
    const land = chunk.match(/^(\d+)/);
    if (land) out.push({ type: "Land", value: Number(land[1]) });
  }
  return out;
}

function inferMm3PowerAction(letter: string, parenSegment: string): string {
  const p = parenSegment.toLowerCase();
  if (p.includes("minor")) return "Minor";
  if (p.includes("immediate") || p.includes("opportunity") || p.includes("interrupt")) return "Triggered";
  if (p.includes("free")) return "Free";
  const L = letter.toLowerCase();
  if (L === "r" && p.includes("minor")) return "Minor";
  return "Standard";
}

function inferUsageFromParenInner(inner: string): string {
  const parts = inner.split(";").map((s) => s.trim().toLowerCase());
  const joined = parts.join(" ");
  if (joined.includes("daily")) return "Daily";
  if (joined.includes("encounter")) return "Encounter";
  if (joined.includes("at-will") || joined.includes("at will")) return "At-Will";
  if (joined.includes("recharge")) return inner.trim();
  return inner.trim() || "See text";
}

function parseMm3PowerFirstLine(firstLineRaw: string): {
  name: string;
  usage: string;
  action: string;
  keywords: string;
  letter: string;
  restOfFirstLine: string;
} | null {
  const firstLine = firstLineRaw.trim();
  const lead = firstLine.match(MM3_POWER_LEAD_RE);
  if (!lead) return null;
  const letter = lead[1];
  const afterLetter = lead[2].trim();
  const diamondIdx = afterLetter.search(/[✦◆]/);
  const beforeDiamond = diamondIdx >= 0 ? afterLetter.slice(0, diamondIdx) : afterLetter;
  const afterDiamond = diamondIdx >= 0 ? afterLetter.slice(diamondIdx + 1).replace(/^[✦◆]\s*/, "").trim() : "";

  const parenOpen = beforeDiamond.indexOf("(");
  let name = beforeDiamond;
  let innerParen = "";
  if (parenOpen >= 0) {
    const closeIdx = beforeDiamond.indexOf(")", parenOpen);
    if (closeIdx >= 0) {
      name = beforeDiamond.slice(0, parenOpen).trim();
      innerParen = beforeDiamond.slice(parenOpen + 1, closeIdx).trim();
    }
  } else {
    name = beforeDiamond.trim();
  }

  const usage = innerParen ? inferUsageFromParenInner(innerParen) : "See text";
  const action = inferMm3PowerAction(letter, innerParen);
  const keywords = afterDiamond ? afterDiamond.split(/,\s*/).map((k) => k.trim()).filter(Boolean).join(", ") : "";

  return {
    name: name || afterLetter,
    usage,
    action,
    keywords,
    letter,
    restOfFirstLine: ""
  };
}

function isAuraLine(line: string): boolean {
  return /\baura\s+\d+/i.test(line);
}

function splitMm3AbilityLines(abilityLines: string[]): Array<{ type: "trait" | "aura" | "power"; text: string }> {
  const out: Array<{ type: "trait" | "aura" | "power"; text: string }> = [];
  let i = 0;
  while (i < abilityLines.length) {
    const raw = abilityLines[i].trim();
    if (!raw) {
      i++;
      continue;
    }
    const normalized = normalizeMm3OcrLine(raw);

    if (MM3_POWER_LEAD_RE.test(normalized)) {
      const chunk: string[] = [abilityLines[i]];
      i++;
      while (i < abilityLines.length) {
        const next = abilityLines[i].trim();
        if (!next) {
          chunk.push(abilityLines[i]);
          i++;
          continue;
        }
        const nn = normalizeMm3OcrLine(next);
        if (MM3_POWER_LEAD_RE.test(nn)) break;
        chunk.push(abilityLines[i]);
        i++;
      }
      out.push({ type: "power", text: chunk.join("\n") });
      continue;
    }

    if (isAuraLine(normalized)) {
      const chunk: string[] = [abilityLines[i]];
      i++;
      while (i < abilityLines.length) {
        const next = abilityLines[i].trim();
        if (!next) {
          chunk.push(abilityLines[i]);
          i++;
          continue;
        }
        const nn = normalizeMm3OcrLine(next);
        if (MM3_POWER_LEAD_RE.test(nn) || isAuraLine(nn)) break;
        chunk.push(abilityLines[i]);
        i++;
      }
      out.push({ type: "aura", text: chunk.join("\n") });
      continue;
    }

    const chunk: string[] = [abilityLines[i]];
    i++;
    while (i < abilityLines.length) {
      const next = abilityLines[i].trim();
      if (!next) {
        chunk.push(abilityLines[i]);
        i++;
        continue;
      }
      const nn = normalizeMm3OcrLine(next);
      if (MM3_POWER_LEAD_RE.test(nn) || isAuraLine(nn)) break;
      chunk.push(abilityLines[i]);
      i++;
    }
    out.push({ type: "trait", text: chunk.join("\n") });
  }
  return out;
}

function traitAuraNameFromFirstLine(text: string): { name: string; details: string } {
  const lines = text.trim().split("\n");
  const first = lines[0]?.trim() ?? "";
  const rest = lines.slice(1).join("\n").trim();
  const wm = first.match(/^(.+?)\s+aura\s+(\d+)\s*;\s*(.*)$/i);
  if (wm) {
    return {
      name: `${wm[1].trim()} (Aura ${wm[2]})`,
      details: [wm[3].trim(), rest].filter(Boolean).join("\n")
    };
  }
  const words = first.split(/\s+/);
  if (words.length <= 8 && !first.includes(";")) {
    return { name: first, details: rest };
  }
  const cut = first.search(/\s[Aa]\w|\s[Tt]he\s|\s[Ww]hen\s|\s[Aa]ny\s|\s[Aa]n\s/);
  if (cut > 3 && cut < first.length - 5) {
    return {
      name: first.slice(0, cut).trim(),
      details: [first.slice(cut).trim(), rest].filter(Boolean).join("\n")
    };
  }
  return { name: first.slice(0, Math.min(48, first.length)).trim(), details: [first.length > 48 ? first.slice(48) : "", rest].filter(Boolean).join("\n") };
}

export function parseMm3StatBlock(args: {
  nonEmpty: string[];
  name: string;
  level: number;
  role: string;
  groupRole: string | undefined;
  isLeader: boolean;
  size: string;
  typeStr: string;
  xpNum: number;
  keywords: string[];
  commaBits: string[];
  warnings: string[];
}): { entry: MonsterEntryFile; warnings: string[] } {
  const warnings = [...args.warnings];
  const lines = args.nonEmpty.map(normalizeMm3OcrLine);
  const footerIdx = findMm3FooterIndex(lines);

  const otherNumbers: Record<string, unknown> = {};
  const defenses: Record<string, number | string> = {};
  const resistances: Array<{ name?: string; amount?: number }> = [];
  const weaknesses: Array<{ name?: string; amount?: number }> = [];
  const immunities: string[] = [];

  const statRegion = lines.slice(2, footerIdx);
  const abilityScratch: string[] = [];

  for (const Lraw of statRegion) {
    const L = Lraw.trim();
    if (!L) continue;

    const initM = L.match(INIT_SENSES_RE);
    if (initM) {
      otherNumbers.initiative = initM[1].trim();
      const sensesTail = initM[2].trim();
      const perc = extractPerceptionFromSenses(sensesTail);
      if (perc) otherNumbers.perception = perc;
      continue;
    }

    const hpM = L.match(HP_MM3_RE);
    if (hpM) {
      otherNumbers.HP = Number.parseInt(hpM[1].replace(/,/g, ""), 10);
      otherNumbers.bloodied = Number.parseInt(hpM[2].replace(/,/g, ""), 10);
      continue;
    }
    const hpAlt = L.match(HP_MM3_NO_BLOODIED_RE);
    if (hpAlt) {
      otherNumbers.HP = Number.parseInt(hpAlt[1].replace(/,/g, ""), 10);
      otherNumbers.HPExtra = hpAlt[2].trim();
      continue;
    }

    const acM = L.match(AC_MM3_RE);
    if (acM) {
      defenses.AC = Number.parseInt(acM[1], 10);
      defenses.Fortitude = Number.parseInt(acM[2], 10);
      defenses.Reflex = Number.parseInt(acM[3], 10);
      defenses.Will = Number.parseInt(acM[4], 10);
      continue;
    }

    if (/^Immune\b/i.test(L) || /^Resist\b/i.test(L) || /^Vulnerable\b/i.test(L)) {
      const pieces = L.split(";").map((p) => p.trim()).filter(Boolean);
      for (const piece of pieces) {
        const im = piece.match(/^Immune\s+(.+)$/i);
        if (im) {
          immunities.push(
            ...im[1]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          );
          continue;
        }
        const rm = piece.match(/^Resist\s+(.+)$/i);
        if (rm) {
          const rest = rm[1].trim();
          const num = rest.match(/^(\d+)\s+/);
          if (num) {
            resistances.push({
              amount: Number.parseInt(num[1], 10),
              name: rest.replace(/^\d+\s+/, "").trim() || rest
            });
          } else {
            resistances.push({ name: rest });
          }
          continue;
        }
        const vm = piece.match(/^Vulnerable\s+(.+)$/i);
        if (vm) {
          const rest = vm[1].trim();
          const num = rest.match(/^(\d+)\s+/);
          if (num) {
            weaknesses.push({
              amount: Number.parseInt(num[1], 10),
              name: rest.replace(/^\d+\s+/, "").trim() || rest
            });
          } else {
            weaknesses.push({ name: rest });
          }
        }
      }
      continue;
    }

    const regFull = L.match(/^Regeneration\s+(.+)$/i);
    if (regFull) {
      const numM = L.match(/^Regeneration\s+(\d+)\b/);
      if (numM) {
        otherNumbers.regeneration = Number.parseInt(numM[1], 10);
      }
      const detail = regFull[1].trim();
      if (detail.length > (numM ? numM[1].length : 0)) {
        otherNumbers.regenerationDetail = detail;
      }
      continue;
    }

    const stM = L.match(SAVING_THROWS_ONLY_RE);
    if (stM) {
      otherNumbers.savingThrows = stM[1].trim();
      continue;
    }

    const apM = L.match(ACTION_POINTS_ONLY_RE);
    if (apM) {
      otherNumbers.actionPoints = Number.parseInt(apM[1], 10);
      continue;
    }

    if (/^Speed\b/i.test(L)) {
      const speedPart = L.split(";")[0]?.trim() ?? L;
      const movement = parseSpeedToMovement(speedPart);
      if (movement.length) otherNumbers.movement = movement;
      continue;
    }

    abilityScratch.push(Lraw);
  }

  const abilities = splitMm3AbilityLines(abilityScratch);
  const traits: MonsterTrait[] = [];
  const auras: MonsterTrait[] = [];
  const powers: MonsterPower[] = [];

  for (const block of abilities) {
    if (block.type === "trait") {
      const { name, details } = traitAuraNameFromFirstLine(block.text);
      traits.push({ name, type: "Trait", details });
    } else if (block.type === "aura") {
      const firstLine = block.text.split("\n")[0]?.trim() ?? "";
      const rangeM = firstLine.match(/\baura\s+(\d+)/i);
      const namePart = firstLine.replace(/\s*aura\s+\d+.*$/i, "").trim();
      const details = block.text.split("\n").slice(1).join("\n").trim();
      const afterSemi = firstLine.match(/;\s*(.*)$/);
      const fullDetails = [afterSemi?.[1]?.trim(), details].filter(Boolean).join("\n");
      auras.push({
        name: namePart || "Aura",
        range: rangeM ? Number(rangeM[1]) : undefined,
        type: "Trait",
        details: fullDetails
      });
    } else {
      const powerLines = block.text.split("\n");
      const parsed = parseMm3PowerFirstLine(powerLines[0] ?? "");
      if (!parsed) continue;
      const body = [powerLines.slice(1).join("\n").trim()].filter(Boolean).join("\n");
      const description = body ? `${powerLines[0]}\n${body}`.trim() : powerLines[0].trim();
      powers.push(
        normalizeMonsterPowerShape({
          name: parsed.name,
          usage: parsed.usage,
          action: parsed.action,
          keywords: parsed.keywords,
          description
        })
      );
    }
  }

  const tailLines = lines.slice(footerIdx);
  let alignment: { name: string } | undefined;
  let languages: string[] = [];
  const skills: Record<string, number | string> = {};
  const items: Array<{ name: string }> = [];

  for (const L of tailLines) {
    const am = L.match(/^Alignment\s+(.+)$/i);
    if (am) {
      const rest = am[1];
      const langSplit = rest.split(/\bLanguages\b/i);
      const alignPart = langSplit[0]?.trim() ?? "";
      alignment = { name: titleCaseAlign(alignPart) };
      if (langSplit[1]) languages = parseLanguages(langSplit[1]);
      continue;
    }
    if (/^Skills\b/i.test(L)) Object.assign(skills, parseSkillsLine(L));
    const em = L.match(/^Equipment\s+(.+)$/i);
    if (em) items.push({ name: em[1].trim() });
  }

  const abilityScores = parseAbilityScoresFromLines(lines);

  const senses: Array<{ name: string; range?: string | number }> = [];
  for (const L of statRegion) {
    const initM = L.match(INIT_SENSES_RE);
    if (initM) {
      const tail = initM[2].trim();
      if (tail) senses.push({ name: tail, range: 0 });
    }
  }

  const regTop = otherNumbers.regeneration;
  if (typeof regTop === "number") {
    delete otherNumbers.regeneration;
  }

  const stats: MonsterStats = {
    abilityScores,
    defenses,
    attackBonuses: {},
    skills,
    otherNumbers
  };

  const id = `import-${slugId(args.name)}-${simpleHash(lines.join("\n"))}`;

  const entry: MonsterEntryFile = {
    id,
    fileName: `${id}.json`,
    relativePath: `import/${id}.json`,
    name: args.name,
    level: args.level,
    role: args.role,
    isLeader: args.isLeader,
    parseError: "",
    sourceRoot: "import",
    size: args.size,
    origin: args.commaBits[0] ?? "unknown",
    type: args.typeStr || "Unknown",
    xp: args.xpNum,
    groupRole: args.groupRole,
    alignment,
    languages: languages.length ? languages : undefined,
    keywords: args.keywords.length > 0 ? args.keywords : undefined,
    senses: senses.length ? senses : undefined,
    resistances: resistances.length ? resistances : undefined,
    weaknesses: weaknesses.length ? weaknesses : undefined,
    immunities: immunities.length ? immunities : undefined,
    items: items.length ? items : undefined,
    traits: traits.length ? traits : undefined,
    auras: auras.length ? auras : undefined,
    regeneration: typeof regTop === "number" ? regTop : undefined,
    stats,
    powers,
    sections: { layout: "mm3", importWarnings: warnings }
  };

  return { entry, warnings };
}

export function shouldUseMm3Parser(nonEmpty: string[]): boolean {
  if (nonEmpty.length < 3) return false;
  const body = nonEmpty.slice(2).map(normalizeMm3OcrLine);
  const hasSections = nonEmpty.some((l) => /^(TRAITS|STANDARD\s+ACTIONS)\b/i.test(l.trim()));
  if (hasSections) return false;

  const hasInitSenses = body.some((l) => /^Initiative\s+[+-]?\d+\s+Senses\b/i.test(l));
  const hasMm3Power = body.some((l) => /^[mMcCrRaA]\s+\S/.test(l.trim()));
  if (hasInitSenses && hasMm3Power) return true;
  if (hasMm3Power && body.some((l) => /^AC\s+\d+\s*;\s*Fortitude\b/i.test(l))) return true;
  return false;
}

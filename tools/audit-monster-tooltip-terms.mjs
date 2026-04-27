#!/usr/bin/env node
/**
 * Audit monster immunities / resistance & weakness damage names / senses against generated glossary_terms.json,
 * using the same normalization + candidateTerms expansion as tooltipGlossary.ts (resolveTooltipText).
 *
 * Matches MonsterEditorApp.tsx hover helpers:
 * - immunity segment: glossaryTerm(term) only + candidateTerms
 * - resistance name: term + "{term} damage" when term doesn't end with "damage"
 * - sense name: term + title-case variant when different
 *
 * Usage: node tools/audit-monster-tooltip-terms.mjs [path-to-generated-dir]
 * Default generated dir: ./generated (repo root).
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function normalizeTerm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mergeBuiltinTooltipLookupMap(glossaryByName) {
  const out = { ...glossaryByName };
  const CONDITION_VERB_TO_CANONICAL_NAME = {
    slow: "slowed",
    stun: "stunned",
    dominate: "dominated",
    stunning: "stunned",
    petrification: "petrified"
  };
  const TYPO_TO_CANONICAL_NAME = {
    teleporation: "teleportation",
    marial: "martial",
    arcare: "arcane"
  };
  for (const [alias, canonName] of Object.entries(CONDITION_VERB_TO_CANONICAL_NAME)) {
    const canonKey = normalizeTerm(canonName);
    const text = out[canonKey];
    if (!text) continue;
    const aliasKey = normalizeTerm(alias);
    if (!out[aliasKey]) out[aliasKey] = text;
  }
  for (const [typo, canonName] of Object.entries(TYPO_TO_CANONICAL_NAME)) {
    const canonKey = normalizeTerm(canonName);
    const text = out[canonKey];
    if (!text) continue;
    const typoKey = normalizeTerm(typo);
    if (!out[typoKey]) out[typoKey] = text;
  }
  return out;
}

function expandTooltipLookupTerms(rawTerm) {
  const term = String(rawTerm ?? "").trim();
  if (!term) return [];
  const attackVsMatch = term.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (attackVsMatch) {
    const left = attackVsMatch[1]?.trim();
    const right = attackVsMatch[2]?.trim();
    return [left, right].filter(Boolean);
  }
  return [term];
}

function candidateTerms(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return [];
  const candidates = [trimmed];

  const effectsSuffixMatch = trimmed.match(/^(\S+)\s+effects?$/i);
  if (effectsSuffixMatch?.[1]) {
    candidates.push(effectsSuffixMatch[1]);
  }

  if (/^knocked\s+prone$/i.test(trimmed)) {
    candidates.push("prone");
  }

  const withoutParens = trimmed.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (withoutParens && withoutParens !== trimmed) candidates.push(withoutParens);
  const withoutTrailingPunctuation = trimmed.replace(/[.,;:!?]+$/g, "").trim();
  if (withoutTrailingPunctuation && withoutTrailingPunctuation !== trimmed) candidates.push(withoutTrailingPunctuation);
  const skillPhraseMatch = trimmed.match(/^(.+?)\s+skill(?:\s+check)?$/i);
  if (skillPhraseMatch?.[1]) candidates.push(skillPhraseMatch[1].trim());
  const checkPhraseMatch = trimmed.match(/^(.+?)\s+check$/i);
  if (checkPhraseMatch?.[1]) candidates.push(checkPhraseMatch[1].trim());
  const trainedInMatch = trimmed.match(/^trained in\s+(.+)$/i);
  if (trainedInMatch?.[1]) candidates.push(trainedInMatch[1].trim());
  const TYPO_TO_CANONICAL_NAME = {
    teleporation: "teleportation",
    marial: "martial",
    arcare: "arcane"
  };
  const normalized = normalizeTerm(trimmed);
  const typoCanon = TYPO_TO_CANONICAL_NAME[normalized];
  if (typoCanon) candidates.push(typoCanon);
  if (trimmed.endsWith("s") && trimmed.length > 1) candidates.push(trimmed.slice(0, -1));
  if (!trimmed.endsWith("s")) candidates.push(`${trimmed}s`);
  const compoundParts = trimmed
    .split(/\s*(?:\/|,|;|\band\b|\bor\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (compoundParts.length > 1) candidates.push(...compoundParts);
  const simpleRangeMatch = trimmed.match(/^(melee|ranged|reach)\s+\d+$/i);
  if (simpleRangeMatch?.[1]) candidates.push(simpleRangeMatch[1]);
  const closeAreaRangeMatch = trimmed.match(/^((?:close|area)\s+(?:blast|burst))\s+\d+(?:\s+within\s+\d+)?$/i);
  if (closeAreaRangeMatch?.[1]) candidates.push(closeAreaRangeMatch[1]);
  return [...new Set(candidates)];
}

function resolvesTerm(term, glossaryByName) {
  for (const t of expandTooltipLookupTerms(term)) {
    for (const c of candidateTerms(t)) {
      const k = normalizeTerm(c);
      if (glossaryByName[k]) return true;
    }
  }
  return false;
}

function uniqueDedupe(arr) {
  const seen = new Map();
  for (const item of arr) {
    const k = normalizeTerm(item);
    if (!k) continue;
    if (!seen.has(k)) seen.set(k, item.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function titleCaseWords(raw) {
  return String(raw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function immunityVariants(term) {
  return uniqueDedupe([term]);
}

function resistanceVariants(term) {
  const t = term.trim();
  const out = [t];
  if (!/\bdamage$/i.test(t)) out.push(`${t} damage`);
  return uniqueDedupe(out);
}

function senseVariants(term) {
  const t = term.trim();
  const titled = titleCaseWords(t).trim();
  const out = [t];
  if (titled.length > 0 && titled.toLowerCase() !== t.toLowerCase()) out.push(titled);
  return uniqueDedupe(out);
}

function anyVariantResolves(variants, glossaryByName) {
  for (const v of variants) {
    if (resolvesTerm(v, glossaryByName)) return true;
  }
  return false;
}

function splitCommaSegments(raw) {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadGlossaryMap(generatedRoot) {
  const path = join(generatedRoot, "glossary_terms.json");
  const raw = await readFile(path, "utf8");
  const rows = JSON.parse(raw);
  const byName = {};
  for (const row of rows) {
    if (typeof row?.name !== "string" || !row.name.trim()) continue;
    const text =
      typeof row.definition === "string" && row.definition.trim()
        ? row.definition.trim()
        : typeof row.html === "string" && row.html.trim()
          ? "[html]"
          : null;
    if (!text) continue;
    const keys = [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]
      .filter((v) => typeof v === "string" && v.trim())
      .map((v) => normalizeTerm(v));
    for (const key of keys) {
      if (!byName[key]) byName[key] = text;
    }
  }
  return mergeBuiltinTooltipLookupMap(byName);
}

async function main() {
  const generatedRoot = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, "generated");
  const monstersDir = join(generatedRoot, "monsters");
  /** Full monster JSON lives in monsters/entries/ after ETL (`build_monster_index.py`). */
  const monstersEntriesDir = join(monstersDir, "entries");
  let glossaryByName;
  try {
    glossaryByName = await loadGlossaryMap(generatedRoot);
  } catch (e) {
    console.error(`Could not read ${join(generatedRoot, "glossary_terms.json")}: ${e.message}`);
    console.error("Run glossary ETL so generated/glossary_terms.json exists.");
    process.exit(1);
  }

  let indexFile;
  try {
    indexFile = JSON.parse(await readFile(join(monstersDir, "index.json"), "utf8"));
  } catch (e) {
    console.error(`Could not read monster index ${join(monstersDir, "index.json")}: ${e.message}`);
    console.error("Run monster ETL so generated/monsters/*.json exists.");
    process.exit(1);
  }

  const immunityTerms = new Set();
  const resistanceNames = new Set();
  const senseNames = new Set();
  const weaknessNames = new Set();

  /** First monster (id + display name) where each raw term appears */
  const immunityExample = new Map();
  const resistanceExample = new Map();
  const senseExample = new Map();
  const weaknessExample = new Map();

  const rows = indexFile.monsters ?? [];
  let entryDirUsed = monstersDir;
  try {
    await stat(monstersEntriesDir);
    entryDirUsed = monstersEntriesDir;
  } catch {
    entryDirUsed = monstersDir;
  }

  for (const row of rows) {
    const id = row.id;
    let m;
    try {
      m = JSON.parse(await readFile(join(entryDirUsed, `${id}.json`), "utf8"));
    } catch {
      continue;
    }
    const monsterLabel = String(m?.name ?? row?.name ?? id ?? "").trim() || id;

    function noteExample(map, term) {
      const k = normalizeTerm(term);
      if (!k || map.has(k)) return;
      map.set(k, { id, name: monsterLabel });
    }

    for (const imm of m.immunities ?? []) {
      for (const seg of splitCommaSegments(String(imm ?? ""))) {
        immunityTerms.add(seg);
        noteExample(immunityExample, seg);
      }
    }
    for (const r of m.resistances ?? []) {
      const name = String(r?.name ?? "").trim();
      if (name) {
        resistanceNames.add(name);
        noteExample(resistanceExample, name);
      }
    }
    for (const s of m.senses ?? []) {
      const name = String(s?.name ?? "").trim();
      if (name) {
        senseNames.add(name);
        noteExample(senseExample, name);
      }
    }
    for (const w of m.weaknesses ?? []) {
      const name = String(w?.name ?? "").trim();
      if (name) {
        weaknessNames.add(name);
        noteExample(weaknessExample, name);
      }
    }
  }

  const missingImmunities = [];
  for (const t of [...immunityTerms].sort()) {
    const ok = anyVariantResolves(immunityVariants(t), glossaryByName);
    if (!ok) missingImmunities.push(t);
  }

  const missingResistances = [];
  for (const t of [...resistanceNames].sort()) {
    const ok = anyVariantResolves(resistanceVariants(t), glossaryByName);
    if (!ok) missingResistances.push(t);
  }

  const missingSenses = [];
  for (const t of [...senseNames].sort()) {
    const ok = anyVariantResolves(senseVariants(t), glossaryByName);
    if (!ok) missingSenses.push(t);
  }

  const missingWeaknesses = [];
  for (const t of [...weaknessNames].sort()) {
    const ok = anyVariantResolves(resistanceVariants(t), glossaryByName);
    if (!ok) missingWeaknesses.push(t);
  }

  const glen = Object.keys(glossaryByName).length;
  console.log(`Glossary keys (normalized): ${glen}`);
  console.log(`Monsters indexed: ${rows.length}`);
  console.log(`Monster JSON directory: ${entryDirUsed}`);
  console.log(`Unique immunity segments: ${immunityTerms.size}`);
  console.log(`Unique resistance names: ${resistanceNames.size}`);
  console.log(`Unique sense names: ${senseNames.size}`);
  console.log(`Unique weakness names: ${weaknessNames.size}`);
  console.log("");

  function exampleLine(term, exampleMap) {
    const ex = exampleMap.get(normalizeTerm(term));
    if (!ex) return "";
    return `  example: ${ex.name} (${ex.id})`;
  }

  function printSection(title, missing, total, exampleMap) {
    console.log(`--- ${title} (${missing.length} missing / ${total} unique) ---`);
    if (missing.length === 0) {
      console.log("(all resolve via glossary candidate expansion)");
    } else {
      for (const line of missing) {
        console.log(line);
        if (exampleMap) console.log(exampleLine(line, exampleMap));
      }
    }
    console.log("");
  }

  printSection("Immunities", missingImmunities, immunityTerms.size, immunityExample);
  printSection("Resistance damage types / names", missingResistances, resistanceNames.size, resistanceExample);
  printSection("Senses", missingSenses, senseNames.size, senseExample);
  printSection("Weaknesses (same hover rules as resistances)", missingWeaknesses, weaknessNames.size, weaknessExample);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

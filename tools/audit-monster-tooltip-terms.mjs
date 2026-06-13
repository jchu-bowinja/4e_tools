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
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
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
    arcare: "arcane",
    ilusion: "illusion",
    pertrification: "petrified"
  };
  const DAMAGE_AND_KEYWORD_ALIAS_TO_CANONICAL_NAME = {
    electricity: "lightning"
  };
  const BUILTIN_FALLBACK_DEFINITIONS = {
    silver:
      "Many monsters are vulnerable to damage from silver or silvered weapons. Silvered weapons use the silvered modifier on ammunition or melee weapons.",
    silvered:
      "Silvered weapons (or silver ammunition) satisfy vulnerabilities that mention silver.",
    variable:
      "Variable resistance or immunity changes depending on circumstance; see this creature's powers or encounter text for how to apply it.",
    adaptive:
      "Adaptive resistance changes situationally; see the creature's powers or tactical notes for current values.",
    determined:
      "Determined when used in a stat block; see this creature's powers or the encounter setup for how this applies.",
    "all damage":
      "This creature resists or is vulnerable to all damage types unless the stat block lists exceptions.",
    "all damage from outside the tower":
      "Damage dealt from outside the named structure is reduced or negated; see the creature's encounter text for the tower boundary.",
    "by current shape":
      "Resistance value depends on the creature's current form; see its powers or stat block notes for the active shape.",
    "chromatic pillar":
      "Chromatic pillar is a Tiamat-themed defensive effect; see this creature's powers for how the pillar interacts with damage.",
    "copper defense":
      "Copper Defense is a named defensive trait on copper-themed creatures; see its powers for how damage is reduced.",
    "effects targeting ac":
      "Effects that target AC against this creature are reduced or ignored; see its powers for the exact interaction.",
    "necrotic damage":
      "Necrotic damage is a damage type that often weakens or withers the target; many undead resist or are immune to it.",
    opportunity:
      "Opportunity refers to opportunity-attack interactions in this stat block; see the creature's traits for when it can make or ignore opportunity attacks.",
    "planephase form":
      "While in planephase form the creature has altered defenses and resistances; see its powers for entering, leaving, and current values.",
    "podspawn shares any resistances that its pod demon progenitor has":
      "This podspawn inherits resistances from its pod demon progenitor; use the progenitor's current resistances.",
    "poison only":
      "Only poison damage is resisted or affected; other damage types are handled normally unless noted elsewhere.",
    "target of that attack takes an extra 5 cold damage":
      "A rider on a specific attack: the target takes additional cold damage beyond the attack's normal hit line.",
    "terrible slaughter":
      "Terrible Slaughter is a named defensive or damage-reduction trait; see this creature's powers for when it applies.",
    "arrow of fate":
      "Arrow of Fate is a named vulnerability on this creature; see encounter text or powers for what triggers extra damage.",
    "attacks by characters below 20th level":
      "Characters below 20th level cannot affect this creature with attacks; higher-level characters interact normally.",
    "attacks by characters below level 15":
      "Characters below 15th level cannot affect this creature with attacks; higher-level characters interact normally.",
    "attacks by characters below level 20":
      "Characters below 20th level cannot affect this creature with attacks; higher-level characters interact normally.",
    "attacks by creatures of lower than 20th level":
      "Creatures below 20th level cannot affect this creature with attacks; higher-level creatures interact normally.",
    "attacks and damage while in dedrick beynar's space and while dedrick has 1 or more hit points":
      "This creature is protected while sharing Dedrick Beynar's space and Dedrick remains alive; see the encounter for details.",
    "can't be teleported against its will; resist see also planar warp":
      "This creature cannot be teleported unwillingly; see planar warp and related traits for resistance details.",
    "filth fever":
      "Filth fever is a disease often spread by filth or vermin; see the Disease rules and this creature's attack for the effect.",
    "greater moon fever":
      "Greater moon fever is an advanced lycanthropy-related disease; see the Disease rules and this creature's attacks.",
    "greater moon frenzy":
      "Greater moon frenzy is a severe lycanthropy-related disease; see the Disease rules and this creature's attacks.",
    lockjaw:
      "Lockjaw is a disease that stiffens the victim; see the Disease rules and this creature's attack for the effect.",
    "meenlock corruption":
      "Meenlock corruption is a disease spread by meenlocks; see the Disease rules and this creature's powers.",
    "moon frenzy":
      "Moon frenzy is a lycanthropy-related disease; see the Disease rules and this creature's attacks.",
    "moon rage":
      "Moon rage is a lycanthropy-related disease; see the Disease rules and this creature's attacks.",
    "moontusk fever":
      "Moontusk fever is a disease associated with wereboar and similar creatures; see the Disease rules.",
    "noxious breath":
      "Noxious breath is a disease or affliction delivered by this creature's breath weapon or aura; see its powers.",
    "rot grub infestation":
      "Rot grub infestation is a disease caused by rot grubs; see the Disease rules and this creature's attacks.",
    "sewer fever":
      "Sewer fever is a disease common to wererats and sewer denizens; see the Disease rules.",
    "chaos phage":
      "Chaos phage is a plaguechanged disease; see the Disease rules and this creature's powers.",
    "bluefire burst":
      "Bluefire burst is a plaguechanged disease; see the Disease rules and this creature's powers.",
    "poison (and push, pull, slide when chained)":
      "Immune to poison and to forced movement (push, pull, slide) while chained; see the creature's traits for when the chain applies.",
    "all damage dealt to the spawn during its turn":
      "The spawn is immune to all damage dealt to it during its own turn; damage on other turns applies normally."
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
  for (const [alias, canonName] of Object.entries(DAMAGE_AND_KEYWORD_ALIAS_TO_CANONICAL_NAME)) {
    const canonKey = normalizeTerm(canonName);
    const text = out[canonKey];
    if (!text) continue;
    const aliasKey = normalizeTerm(alias);
    if (!out[aliasKey]) out[aliasKey] = text;
  }
  const nonmagicalFireKey = normalizeTerm("nonmagical fire");
  if (!out[nonmagicalFireKey]) {
    const fireText = out[normalizeTerm("fire")];
    if (fireText) {
      out[nonmagicalFireKey] =
        `${fireText}\n\nNonmagical fire is fire damage from a nonmagical source when the stat block distinguishes it from magical fire.`;
    }
  }
  for (const [key, text] of Object.entries(BUILTIN_FALLBACK_DEFINITIONS)) {
    const nk = normalizeTerm(key);
    if (!out[nk]) out[nk] = text;
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

  if (/^nonmagical\s+fire$/i.test(trimmed)) {
    candidates.push("fire");
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
    arcare: "arcane",
    ilusion: "illusion",
    pertrification: "petrified"
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

function mergeImmunityCommaFragments(segments) {
  const merged = [];
  for (const seg of segments) {
    const st = String(seg ?? "").trim();
    if (!st) continue;
    if (!merged.length) {
      merged.push(st);
      continue;
    }
    const prev = merged[merged.length - 1];
    const openParens = (prev.match(/\(/g) || []).length - (prev.match(/\)/g) || []).length;
    if (
      openParens > 0 ||
      ["pull", "push"].includes(st.toLowerCase()) ||
      (st.endsWith(")") && !st.includes("("))
    ) {
      merged[merged.length - 1] = `${prev}, ${st}`;
      continue;
    }
    merged.push(st);
  }
  return merged;
}

function expandImmunityDisplaySegments(immunities) {
  const segments = [];
  for (const imm of immunities ?? []) {
    segments.push(...splitCommaSegments(String(imm ?? "")));
  }
  return mergeImmunityCommaFragments(segments);
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
      for (const seg of expandImmunityDisplaySegments([imm])) {
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

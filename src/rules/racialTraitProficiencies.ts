import { collectActiveRacialTraitsFromBuild } from "./activeRacialTraits";
import type { CharacterBuild, ProficiencyGrant, RacialTrait, RulesIndex } from "./models";

/** Parse `ID_INTERNAL_PROFICIENCY_*` grant names (mirrors ETL `_parse_proficiency_grant_internal_id`). */
export function parseProficiencyGrantInternalId(internalId: string): ProficiencyGrant | null {
  const id = internalId.trim();
  if (!id.startsWith("ID_INTERNAL_PROFICIENCY_")) return null;
  const rest = id.slice("ID_INTERNAL_PROFICIENCY_".length);

  const patterns: Array<{ re: RegExp; kind: ProficiencyGrant["kind"] }> = [
    { re: /^WEAPON_GROUP_\(([^)]+)\)$/i, kind: "weaponGroup" },
    { re: /^ARMOR_PROFICIENCY_\(([^)]+)\)$/i, kind: "armor" },
    { re: /^SHIELD_PROFICIENCY_\(([^)]+)\)$/i, kind: "shield" },
    { re: /^IMPLEMENT_PROFICIENCY_\(([^)]+)\)$/i, kind: "implement" },
    { re: /^WEAPON_PROFICIENCY_\(([^)]+)\)$/i, kind: "weaponName" }
  ];

  for (const { re, kind } of patterns) {
    const m = rest.match(re);
    if (!m) continue;
    const raw = m[1].replace(/_/g, " ").trim();
    return { kind, value: raw.toLowerCase(), label: titleCaseWords(raw) };
  }

  const fallback = rest.replace(/_/g, " ").trim();
  if (!fallback) return null;
  return { kind: "weaponCategory", value: fallback.toLowerCase(), label: titleCaseWords(fallback) };
}

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** `rules.grant` rows with `type` Proficiency on one racial trait. */
export function proficiencyGrantsFromRacialTrait(trait: RacialTrait | undefined): ProficiencyGrant[] {
  if (!trait) return [];
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const grants = rules?.grant;
  if (!Array.isArray(grants)) return [];
  const out: ProficiencyGrant[] = [];
  for (const g of grants) {
    if (!g || typeof g !== "object") continue;
    const attrs = (g as { attrs?: Record<string, unknown> }).attrs;
    if (!attrs || String(attrs.type ?? "") !== "Proficiency") continue;
    const name = String(attrs.name ?? "").trim();
    const parsed = parseProficiencyGrantInternalId(name);
    if (parsed) out.push(parsed);
  }
  return out;
}

function dedupeProficiencyGrants(grants: ProficiencyGrant[]): ProficiencyGrant[] {
  const out: ProficiencyGrant[] = [];
  const seen = new Set<string>();
  for (const g of grants) {
    const key = `${g.kind}:${g.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

/** Structured proficiency grants from active racial traits for this build. */
export function collectRacialProficiencyGrantsFromBuild(
  index: Pick<RulesIndex, "races" | "racialTraits">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): ProficiencyGrant[] {
  const all: ProficiencyGrant[] = [];
  for (const trait of collectActiveRacialTraitsFromBuild(index, build)) {
    all.push(...proficiencyGrantsFromRacialTrait(trait));
  }
  return dedupeProficiencyGrants(all);
}

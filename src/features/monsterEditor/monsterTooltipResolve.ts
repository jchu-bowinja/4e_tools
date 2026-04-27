import type { RulesIndex } from "../../rules/models";
import { powerKeywordLookupTerms } from "../../data/glossaryHoverResolve";
import {
  expandTooltipLookupTerms,
  resolveTooltipText,
  tooltipTextForAbilityByCode
} from "../../data/tooltipGlossary";
import { monsterAbilityAbbrevFromStatKey } from "./monsterTextUtils";

export type MonsterTooltipResolveContext = {
  glossaryByName: Record<string, string>;
  index: RulesIndex;
};

/** Tooltip body for free-text monster stat terms (glossary + ability rules fallback). */
export function resolveMonsterStyleTooltip(term: string, ctx: MonsterTooltipResolveContext): string | null {
  const fromGlossary = resolveTooltipText({
    terms: expandTooltipLookupTerms(term),
    glossaryByName: ctx.glossaryByName
  });
  if (fromGlossary) return fromGlossary;
  const candidates = [...new Set([term, ...expandTooltipLookupTerms(term)])];
  for (const c of candidates) {
    const code = monsterAbilityAbbrevFromStatKey(c);
    if (code) {
      const lore = tooltipTextForAbilityByCode(ctx.index, code);
      if (lore) return lore;
    }
  }
  return null;
}

function decodeGlossaryTermsEncoded(encoded: string): string[] {
  return encoded
    .split("|")
    .map((token) => {
      try {
        return decodeURIComponent(token);
      } catch {
        return token;
      }
    })
    .map((t) => t.trim())
    .filter(Boolean);
}

export type MonsterGlossaryHoverSection = { term: string; text: string };

/**
 * Resolves tooltip sections for monster editor hover keys (including `glossaryTerms:` variants).
 */
export function resolveMonsterGlossaryHoverSections(key: string, ctx: MonsterTooltipResolveContext): MonsterGlossaryHoverSection[] {
  if (key.startsWith("powerKeyword:")) {
    const keyword = key.slice("powerKeyword:".length).trim();
    const text = resolveTooltipText({
      terms: powerKeywordLookupTerms(keyword),
      glossaryByName: ctx.glossaryByName
    });
    return text ? [{ term: keyword, text }] : [];
  }
  let termBatch: string[] = [];
  if (key.startsWith("glossaryTerms:")) {
    termBatch = decodeGlossaryTermsEncoded(key.slice("glossaryTerms:".length).trim());
  } else if (key.startsWith("glossaryTerm:")) {
    termBatch = expandTooltipLookupTerms(key.slice("glossaryTerm:".length).trim());
  } else {
    return [];
  }
  const uniqueTerms = [...new Set(termBatch.filter(Boolean))];
  const out: MonsterGlossaryHoverSection[] = [];
  for (const t of uniqueTerms) {
    const text = resolveMonsterStyleTooltip(t, ctx);
    if (text) out.push({ term: t, text });
  }
  return out;
}

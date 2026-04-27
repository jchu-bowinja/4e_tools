"""
Scan monster source XML (same pipeline as build_monster_index) and report
immunity segments, resistance names, and sense names that do not resolve
against generated/glossary_terms.json using the same normalization + candidate
expansion as src/data/tooltipGlossary.ts (resolveTooltipText).

Also matches MonsterEditorApp hover helpers:
  - resistance: term and "{term} damage" unless term already ends with damage
  - sense: raw name + title-case variant when different

Usage (from repo root):
  python tools/etl/audit_monster_tooltip_terms.py [MonsterFiles] [generated/glossary_terms.json]
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Set

# Same module as monster ETL (run this script from repo root: python tools/etl/...)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_monster_index import (  # noqa: E402
    _parse_monster_file,
    _read_source_records,
)


def normalize_term(value: str) -> str:
    return " ".join(value.strip().lower().split())


CONDITION_VERB_TO_CANONICAL_NAME: Dict[str, str] = {
    "slow": "slowed",
    "stun": "stunned",
    "dominate": "dominated",
    "stunning": "stunned",
    "petrification": "petrified",
}

TYPO_TO_CANONICAL_NAME: Dict[str, str] = {
    "teleporation": "teleportation",
    "marial": "martial",
    "arcare": "arcane",
    "ilusion": "illusion",
    "pertrification": "petrified",
}

DAMAGE_AND_KEYWORD_ALIAS_TO_CANONICAL_NAME: Dict[str, str] = {"electricity": "lightning"}

BUILTIN_FALLBACK_DEFINITIONS: Dict[str, str] = {
    "silver": (
        "Many monsters are vulnerable to damage from silver or silvered weapons. "
        "Silvered weapons use the silvered modifier on ammunition or melee weapons."
    ),
    "silvered": ("Silvered weapons (or silver ammunition) satisfy vulnerabilities that mention silver."),
    "variable": (
        "Variable resistance or immunity changes depending on circumstance; see this creature's powers "
        "or encounter text for how to apply it."
    ),
    "adaptive": (
        "Adaptive resistance changes situationally; see the creature's powers or tactical notes for current values."
    ),
    "determined": (
        "Determined when used in a stat block; see this creature's powers or the encounter setup "
        "for how this applies."
    ),
}


def merge_builtin_tooltip_lookup_map(glossary_by_name: Dict[str, str]) -> Dict[str, str]:
    """Mirror of tooltipGlossary.mergeBuiltinTooltipLookupMap."""
    out = dict(glossary_by_name)
    for alias, canon_name in CONDITION_VERB_TO_CANONICAL_NAME.items():
        canon_key = normalize_term(canon_name)
        text = out.get(canon_key)
        if not text:
            continue
        alias_key = normalize_term(alias)
        if alias_key not in out:
            out[alias_key] = text
    for typo, canon_name in TYPO_TO_CANONICAL_NAME.items():
        canon_key = normalize_term(canon_name)
        text = out.get(canon_key)
        if not text:
            continue
        typo_key = normalize_term(typo)
        if typo_key not in out:
            out[typo_key] = text
    for alias, canon_name in DAMAGE_AND_KEYWORD_ALIAS_TO_CANONICAL_NAME.items():
        canon_key = normalize_term(canon_name)
        text = out.get(canon_key)
        if not text:
            continue
        alias_key = normalize_term(alias)
        if alias_key not in out:
            out[alias_key] = text

    nm_fire_key = normalize_term("nonmagical fire")
    if nm_fire_key not in out:
        fire_text = out.get(normalize_term("fire"))
        if fire_text:
            out[nm_fire_key] = (
                f"{fire_text}\n\nNonmagical fire is fire damage from a nonmagical source when "
                "the stat block distinguishes it from magical fire."
            )

    for key, text in BUILTIN_FALLBACK_DEFINITIONS.items():
        nk = normalize_term(key)
        if nk not in out:
            out[nk] = text
    return out


def expand_tooltip_lookup_terms(raw_term: str) -> List[str]:
    """Mirror of tooltipGlossary.expandTooltipLookupTerms."""
    term = raw_term.strip()
    if not term:
        return []
    m = re.match(r"^(.+?)\s+vs\.?\s+(.+)$", term, re.I)
    if m:
        left = m.group(1).strip()
        right = m.group(2).strip()
        return [x for x in (left, right) if x]
    return [term]


def candidate_terms(input_term: str) -> List[str]:
    """Mirror of tooltipGlossary.candidateTerms (must stay in sync for audit validity)."""
    trimmed = input_term.strip()
    if not trimmed:
        return []
    candidates = [trimmed]

    m_effects = re.match(r"^(\S+)\s+effects?$", trimmed, re.I)
    if m_effects and m_effects.group(1):
        candidates.append(m_effects.group(1))

    if re.match(r"^knocked\s+prone$", trimmed, re.I):
        candidates.append("prone")

    if re.match(r"^nonmagical\s+fire$", trimmed, re.I):
        candidates.append("fire")

    without_parens = re.sub(r"\s*\([^)]*\)\s*", " ", trimmed).strip()
    if without_parens and without_parens != trimmed:
        candidates.append(without_parens)
    without_trailing = re.sub(r"[.,;:!?]+$", "", trimmed).strip()
    if without_trailing and without_trailing != trimmed:
        candidates.append(without_trailing)
    m_skill = re.match(r"^(.+?)\s+skill(?:\s+check)?$", trimmed, re.I)
    if m_skill and m_skill.group(1):
        candidates.append(m_skill.group(1).strip())
    m_check = re.match(r"^(.+?)\s+check$", trimmed, re.I)
    if m_check and m_check.group(1):
        candidates.append(m_check.group(1).strip())
    m_trained = re.match(r"^trained in\s+(.+)$", trimmed, re.I)
    if m_trained and m_trained.group(1):
        candidates.append(m_trained.group(1).strip())
    typo_canon = TYPO_TO_CANONICAL_NAME.get(normalize_term(trimmed))
    if typo_canon:
        candidates.append(typo_canon)
    if len(trimmed) > 1 and trimmed.endswith("s"):
        candidates.append(trimmed[:-1])
    if not trimmed.endswith("s"):
        candidates.append(f"{trimmed}s")
    compound_parts = re.split(r"\s*(?:/|,|;|\band\b|\bor\b)\s*", trimmed, flags=re.I)
    compound_parts = [p.strip() for p in compound_parts if p.strip()]
    if len(compound_parts) > 1:
        candidates.extend(compound_parts)
    m_melee = re.match(r"^(melee|ranged|reach)\s+\d+$", trimmed, re.I)
    if m_melee and m_melee.group(1):
        candidates.append(m_melee.group(1))
    m_close = re.match(
        r"^((?:close|area)\s+(?:blast|burst))\s+\d+(?:\s+within\s+\d+)?$",
        trimmed,
        re.I,
    )
    if m_close and m_close.group(1):
        candidates.append(m_close.group(1))
    # Deduplicate preserving order
    seen: Set[str] = set()
    out: List[str] = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def title_case_words(raw: str) -> str:
    return " ".join(w[:1].upper() + w[1:].lower() for w in raw.strip().split() if w)


def split_comma_segments(raw: str) -> List[str]:
    return [s.strip() for s in str(raw or "").split(",") if s.strip()]


def glossary_map_from_json(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    """Match glossaryRowsToTooltipMap keys (normalized). Value = any non-empty text marker."""
    by_name: Dict[str, str] = {}
    for row in rows:
        name = row.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        definition = row.get("definition")
        html = row.get("html")
        text: str | None = None
        if isinstance(definition, str) and definition.strip():
            text = definition.strip()
        elif isinstance(html, str) and html.strip():
            text = "[html]"
        if not text:
            continue
        keys = [name]
        aliases = row.get("aliases")
        if isinstance(aliases, list):
            keys.extend(a for a in aliases if isinstance(a, str) and a.strip())
        for k in keys:
            nk = normalize_term(k)
            if nk and nk not in by_name:
                by_name[nk] = text
    return merge_builtin_tooltip_lookup_map(by_name)


def term_resolves(term: str, glossary_by_name: Dict[str, str]) -> bool:
    for t in expand_tooltip_lookup_terms(term):
        for c in candidate_terms(t):
            if glossary_by_name.get(normalize_term(c)):
                return True
    return False


def any_variant_resolves(variants: List[str], glossary_by_name: Dict[str, str]) -> bool:
    return any(term_resolves(v, glossary_by_name) for v in variants if v.strip())


def immunity_variants(term: str) -> List[str]:
    return list({term.strip()})


def resistance_variants(term: str) -> List[str]:
    t = term.strip()
    out = [t]
    if not re.search(r"\bdamage$", t, re.I):
        out.append(f"{t} damage")
    # dedupe
    seen = set()
    uniq: List[str] = []
    for x in out:
        k = normalize_term(x)
        if k and k not in seen:
            seen.add(k)
            uniq.append(x)
    return uniq


def sense_variants(term: str) -> List[str]:
    t = term.strip()
    titled = title_case_words(t).strip()
    out = [t]
    if titled and titled.lower() != t.lower():
        out.append(titled)
    seen = set()
    uniq: List[str] = []
    for x in out:
        k = normalize_term(x)
        if k and k not in seen:
            seen.add(k)
            uniq.append(x)
    return uniq


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    monster_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else repo / "MonsterFiles"
    glossary_path = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else repo / "generated" / "glossary_terms.json"

    if not glossary_path.is_file():
        print(f"Missing glossary: {glossary_path}", file=sys.stderr)
        sys.exit(1)

    glossary_rows = json.loads(glossary_path.read_text(encoding="utf-8"))
    glossary_by_name = glossary_map_from_json(glossary_rows)

    records = _read_source_records(monster_root)
    immunity_terms: Set[str] = set()
    resistance_names: Set[str] = set()
    sense_names: Set[str] = set()

    for source_row in records:
        xml_text = source_row["xml"]
        fallback_name = Path(source_row["fileName"]).stem
        try:
            payload = _parse_monster_file(xml_text, fallback_name)
        except ET.ParseError:
            continue

        for imm in payload.get("immunities") or []:
            for seg in split_comma_segments(str(imm)):
                immunity_terms.add(seg)

        for r in payload.get("resistances") or []:
            if isinstance(r, dict):
                n = str(r.get("name") or "").strip()
                if n:
                    resistance_names.add(n)

        for s in payload.get("senses") or []:
            if isinstance(s, dict):
                n = str(s.get("name") or "").strip()
                if n:
                    sense_names.add(n)

    def missing(unique: Set[str], variants_fn) -> List[str]:
        out: List[str] = []
        for t in sorted(unique, key=str.lower):
            if not any_variant_resolves(variants_fn(t), glossary_by_name):
                out.append(t)
        return out

    mi = missing(immunity_terms, immunity_variants)
    mr = missing(resistance_names, resistance_variants)
    ms = missing(sense_names, sense_variants)

    print(f"Glossary normalized keys: {len(glossary_by_name)}")
    print(f"Monster files scanned: {len(records)}")
    print(f"Unique immunity segments: {len(immunity_terms)}")
    print(f"Unique resistance names: {len(resistance_names)}")
    print(f"Unique sense names: {len(sense_names)}")
    print()

    def section(title: str, missing_list: List[str], total: int) -> None:
        print(f"--- {title} ({len(missing_list)} missing / {total} unique) ---")
        if not missing_list:
            print("(all resolve via glossary candidate expansion)")
        else:
            for line in missing_list:
                print(line)
        print()

    section("Immunities", mi, len(immunity_terms))
    section("Resistance damage types / names", mr, len(resistance_names))
    section("Senses", ms, len(sense_names))


if __name__ == "__main__":
    main()

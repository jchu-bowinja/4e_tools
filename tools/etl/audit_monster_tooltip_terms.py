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


_IMMUNITY_TERM_ALIASES: Dict[str, List[str]] = {
    "slow": ["slowed"],
    "stun": ["stunned"],
    "dominate": ["dominated"],
    "stunning": ["stunned"],
    "petrification": ["petrified"],
}


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

    for a in _IMMUNITY_TERM_ALIASES.get(normalize_term(trimmed), []):
        candidates.append(a)
    if m_effects and m_effects.group(1):
        for a in _IMMUNITY_TERM_ALIASES.get(normalize_term(m_effects.group(1)), []):
            candidates.append(a)

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
    typo_aliases = {"teleporation": "teleportation", "marial": "martial", "arcare": "arcane"}
    alias = typo_aliases.get(normalize_term(trimmed))
    if alias:
        candidates.append(alias)
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
    return by_name


def term_resolves(term: str, glossary_by_name: Dict[str, str]) -> bool:
    for c in candidate_terms(term):
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

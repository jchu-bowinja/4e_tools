"""Parse Character Builder prereq strings into structured tokens."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

ABILITY_MAP = {
    "str": "STR",
    "strength": "STR",
    "con": "CON",
    "constitution": "CON",
    "dex": "DEX",
    "dexterity": "DEX",
    "int": "INT",
    "intelligence": "INT",
    "wis": "WIS",
    "wisdom": "WIS",
    "cha": "CHA",
    "charisma": "CHA",
}

POWER_SOURCE_ANY = frozenset(
    {"martial", "motion", "divine", "arcane", "primal", "psionic", "shadow"}
)
# CB typo "motion" appears rarely; treat as martial
_POWER_SOURCE_ALIASES = {"motion": "martial"}

PACT_CLASS_FEATURES = frozenset(
    {
        "star pact",
        "infernal pact",
        "fey pact",
        "vestige pact",
        "dark pact",
        "skald pact",
        "sorcerer-king pact",
    }
)

HERITAGE_SUFFIXES = (" Heritage", " Bloodline")


@dataclass
class ParseResult:
    tokens: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]


def _normalize_feature_label(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()).strip(" ,;")


def _strip_or_prefix(part: str) -> str:
    return re.sub(r"^\s*or\s+", "", part, flags=re.I).strip()


def _parse_or_group(
    part: str,
    tokens: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: Set[str],
    depth: int,
) -> bool:
    """If `part` contains OR, parse sub-clauses into an anyOf token. Returns True when handled."""
    if not re.search(r"\s+or\s+", part, flags=re.I):
        return False
    subparts = [p.strip() for p in re.split(r"\s+or\s+", part, flags=re.I) if p.strip()]
    if len(subparts) < 2:
        return False
    options: List[Dict[str, Any]] = []
    sub_anomalies: List[Dict[str, Any]] = []
    for sp in subparts:
        sp = _strip_or_prefix(sp)
        sub_tokens: List[Dict[str, Any]] = []
        _parse_one_prereq_clause(
            sp, sub_tokens, sub_anomalies, race_by_lower, known_classes, depth + 1, allow_or=False
        )
        if len(sub_tokens) == 1:
            options.append(sub_tokens[0])
        elif len(sub_tokens) > 1:
            options.append({"kind": "allOf", "requirements": sub_tokens})
    if not options:
        return False
    if sub_anomalies:
        anomalies.extend(sub_anomalies)
        return False
    tokens.append({"kind": "anyOf", "options": options})
    return True


def _parse_one_prereq_clause(
    part: str,
    tokens: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: Set[str],
    depth: int = 0,
    allow_or: bool = True,
) -> None:
    if depth > 8:
        anomalies.append({"kind": "unparsedPrereqClause", "value": part})
        return

    part = _strip_or_prefix(part.strip().strip(",").strip())
    if not part:
        return

    if allow_or and _parse_or_group(part, tokens, anomalies, race_by_lower, known_classes, depth):
        return

    # Negated internal id: !ID_FMP_CLASS_6
    if part.startswith("!ID_"):
        tokens.append({"kind": "negatedClass", "value": part[1:].strip()})
        return

    # Negated tag: !bloodline
    if part.startswith("!"):
        tokens.append({"kind": "negatedTag", "value": part[1:].strip()})
        return

    # ~TAG (compendium internal tags)
    if part.startswith("~"):
        tokens.append({"kind": "tag", "value": part[1:]})
        return

    lowered = part.lower()

    # Any {power source} class
    m_ps = re.match(r"^any\s+([a-z]+)\s+class\s*$", lowered)
    if m_ps:
        src = _POWER_SOURCE_ALIASES.get(m_ps.group(1), m_ps.group(1))
        if src in POWER_SOURCE_ANY or m_ps.group(1) in POWER_SOURCE_ANY:
            tokens.append({"kind": "powerSourceAny", "value": src})
            return

    # must worship {deity}
    m_deity = re.match(r"^must worship\s+(.+)$", part, re.I)
    if m_deity:
        tokens.append({"kind": "deity", "value": _normalize_feature_label(m_deity.group(1))})
        return

    # proficiency with {item}
    m_prof = re.match(r"^proficiency with\s+(.+)$", part, re.I)
    if m_prof:
        tokens.append({"kind": "proficiency", "value": _normalize_feature_label(m_prof.group(1))})
        return

    # {name} class feature
    m_cf = re.match(r"^(.+?)\s+class\s+feature\s*$", part, re.I)
    if m_cf:
        tokens.append({"kind": "classFeature", "value": _normalize_feature_label(m_cf.group(1))})
        return

    # ritual casting (shorthand class feature)
    if lowered == "ritual casting":
        tokens.append({"kind": "classFeature", "value": "Ritual Casting"})
        return

    # {name} racial power
    m_rp = re.match(r"^(.+?)\s+racial\s+power\s*$", part, re.I)
    if m_rp:
        tokens.append({"kind": "racialPower", "value": _normalize_feature_label(m_rp.group(1))})
        return

    # {name} racial trait
    m_rt = re.match(r"^(.+?)\s+racial\s+trait\s*$", part, re.I)
    if m_rt:
        tokens.append({"kind": "racialTrait", "value": _normalize_feature_label(m_rt.group(1))})
        return

    # {name} feat
    m_feat = re.match(r"^(.+?)\s+feat\s*$", part, re.I)
    if m_feat:
        tokens.append({"kind": "feat", "value": _normalize_feature_label(m_feat.group(1))})
        return

    # {name} power (not "class feature")
    m_pow = re.match(r"^(.+?)\s+power\s*$", part, re.I)
    if m_pow:
        tokens.append({"kind": "power", "value": _normalize_feature_label(m_pow.group(1))})
        return

    # {race} race
    m_race = re.match(r"^(.+?)\s+race\s*$", part, re.I)
    if m_race:
        race_key = m_race.group(1).strip().lower()
        if race_key in race_by_lower:
            tokens.append({"kind": "race", "value": race_by_lower[race_key]})
            return
        tokens.append({"kind": "race", "value": m_race.group(1).strip()})
        return

    # Living humanoid race / Humanoid race
    if re.match(r"^(living\s+)?humanoid\s+race\s*$", lowered):
        tokens.append({"kind": "tag", "value": "HUMANOID"})
        return

    # Size: Small or Medium size (without OR — OR handled above)
    m_size = re.match(r"^(small|medium|large|tiny)\s+size\s*$", lowered)
    if m_size:
        tokens.append({"kind": "size", "value": m_size.group(1).title()})
        return

    # Fighter CountsAsClass (multiclass feats)
    m_counts = re.match(r"^(.+?)\s+CountsAsClass\s*$", part, re.I)
    if m_counts:
        inner = m_counts.group(1).strip()
        if inner.lower() in known_classes:
            tokens.append({"kind": "class", "value": inner})
            return
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # controller role / defender role
    m_role = re.match(r"^(controller|defender|leader|striker)\s+role\s*$", lowered)
    if m_role:
        tokens.append({"kind": "tag", "value": f"{m_role.group(1).title()} Role"})
        return

    # Can use the Holy Symbol implement
    m_impl = re.match(r"^can use the (.+?) implement\s*$", lowered)
    if m_impl:
        tokens.append({"kind": "implement", "value": _normalize_feature_label(m_impl.group(1))})
        return

    # Tarmalune regional background
    if "regional background" in lowered:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # Warlock / ranger pact names
    if lowered in PACT_CLASS_FEATURES:
        label = part.strip()
        tokens.append({"kind": "classFeature", "value": label[0].upper() + label[1:] if label else label})
        return

    # Heritage / Bloodline
    for suffix in HERITAGE_SUFFIXES:
        if part.endswith(suffix):
            tokens.append({"kind": "heritage", "value": part[: -len(suffix)].strip()})
            return

    # Ordinal level: "21st-level wizard", "21st level", "21st level, fighter"
    m = re.match(r"^(\d+)(?:st|nd|rd|th)\s*-\s*level\s*(.*)$", part, re.I)
    if not m:
        m = re.match(r"^(\d+)(?:st|nd|rd|th)\s+level\s*(.*)$", part, re.I)
    if m:
        tokens.append({"kind": "levelAtLeast", "value": int(m.group(1))})
        rest = (m.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, depth + 1)
        return

    m_gap_th = re.match(r"^(\d+)\s+th\s+level\s*(.*)$", part, re.I)
    if m_gap_th:
        tokens.append({"kind": "levelAtLeast", "value": int(m_gap_th.group(1))})
        rest = (m_gap_th.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, depth + 1)
        return

    m_th_level = re.match(r"^(\d+)\s*th\s+level\s*(.*)$", part, re.I)
    if m_th_level:
        tokens.append({"kind": "levelAtLeast", "value": int(m_th_level.group(1))})
        rest = (m_th_level.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, depth + 1)
        return

    tier = re.search(r"(Heroic|Paragon|Epic)\s+Tier", part, re.I)
    if tier:
        tokens.append({"kind": "tier", "value": tier.group(1).upper()})
        return

    ability = re.search(
        r"(Str|Con|Dex|Int|Wis|Cha|Strength|Constitution|Dexterity|Intelligence|Wisdom|Charisma)\s*(\d+)",
        part,
        re.I,
    )
    if ability:
        tokens.append(
            {
                "kind": "abilityAtLeast",
                "ability": ABILITY_MAP[ability.group(1).lower()],
                "value": int(ability.group(2)),
            }
        )
        return

    trained = re.search(r"trained in\s+([a-zA-Z ]+)", part, re.I)
    if trained:
        tokens.append({"kind": "trainedSkill", "value": trained.group(1).strip()})
        return

    if lowered in race_by_lower:
        tokens.append({"kind": "race", "value": race_by_lower[lowered]})
        return

    if lowered in known_classes:
        tokens.append({"kind": "class", "value": part.strip()})
        return

    class_suffix = re.match(r"^(.+?)\s+class\s*$", part, re.I)
    if class_suffix:
        inner = class_suffix.group(1).strip()
        if inner.lower() in known_classes:
            tokens.append({"kind": "class", "value": inner})
            return

    # Common tags / keywords left as soft tags (Polytheist, spellscar, etc.)
    if lowered in {
        "polytheist",
        "spellscar",
        "multiclass",
        "unlimited multiclass",
        "shifter",
    }:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # you have a spellscar
    if lowered.startswith("you have "):
        tokens.append({"kind": "tag", "value": part[9:].strip()})
        return

    anomalies.append({"kind": "unparsedPrereqClause", "value": part})


def parse_prereqs(
    prereqs: Optional[str],
    known_races: Set[str],
    known_classes: Set[str],
) -> ParseResult:
    if not prereqs:
        return ParseResult(tokens=[], anomalies=[])

    tokens: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []
    race_by_lower = {str(r).lower(): str(r) for r in known_races if r}

    text = prereqs.strip()
    parts = [p.strip() for p in re.split(r"[;,]", text) if p.strip()]

    for part in parts:
        _parse_one_prereq_clause(part, tokens, anomalies, race_by_lower, known_classes)

    return ParseResult(tokens=tokens, anomalies=anomalies)

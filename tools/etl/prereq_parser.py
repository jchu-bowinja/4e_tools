"""Parse Character Builder prereq strings into structured tokens."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

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

_POWER_SOURCE_WORDS = frozenset(POWER_SOURCE_ANY | {"psionic"})

_ARENA_WEAPON_CATEGORY_PREFIX = "ID_INTERNAL_ARENA_WEAPON_CATEGORY_"


@dataclass
class PrereqLookups:
    """Compendium name/id resolution for bare prereq clauses."""

    feats: Dict[str, str] = field(default_factory=dict)
    themes: Dict[str, str] = field(default_factory=dict)
    powers: Dict[str, str] = field(default_factory=dict)
    skills: Dict[str, str] = field(default_factory=dict)
    class_features: Dict[str, str] = field(default_factory=dict)
    backgrounds: Dict[str, str] = field(default_factory=dict)
    racial_traits: Dict[str, str] = field(default_factory=dict)
    languages: Dict[str, str] = field(default_factory=dict)
    weapons: Dict[str, str] = field(default_factory=dict)
    entity_by_id: Dict[str, Tuple[str, str]] = field(default_factory=dict)


@dataclass
class ParseResult:
    tokens: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]


def _canon_name_map(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for row in rows:
        name = str(row.get("name") or "").strip()
        if name:
            out[name.lower()] = name
    return out


def build_prereq_lookups_from_raw(
    feats_raw: List[Dict[str, Any]],
    themes_raw: List[Dict[str, Any]],
    powers_raw: List[Dict[str, Any]],
    skills_raw: List[Dict[str, Any]],
    class_features_raw: List[Dict[str, Any]],
    backgrounds_raw: List[Dict[str, Any]],
    racial_traits_raw: List[Dict[str, Any]],
    proficiencies_raw: Optional[List[Dict[str, Any]]] = None,
    languages_raw: Optional[List[Dict[str, Any]]] = None,
    weapons_raw: Optional[List[Dict[str, Any]]] = None,
    classes_raw: Optional[List[Dict[str, Any]]] = None,
) -> PrereqLookups:
    """Build lookup tables from compendium JSON rows (pre-index)."""
    themes = _canon_name_map(themes_raw)
    for name in list(themes.values()):
        if name.lower().endswith(" theme"):
            themes[name.lower()[:-6].strip()] = name

    entity_by_id: Dict[str, Tuple[str, str]] = {}
    for rows, kind in (
        (feats_raw, "feat"),
        (themes_raw, "theme"),
        (powers_raw, "power"),
        (class_features_raw, "classFeature"),
        (backgrounds_raw, "background"),
        (racial_traits_raw, "racialTrait"),
        (proficiencies_raw or [], "proficiency"),
        (classes_raw or [], "class"),
    ):
        for row in rows:
            iid = row.get("internal_id")
            name = str(row.get("name") or "").strip()
            if isinstance(iid, str) and iid.startswith("ID_") and name:
                entity_by_id[iid] = (kind, name)

    return PrereqLookups(
        feats=_canon_name_map(feats_raw),
        themes=themes,
        powers=_canon_name_map(powers_raw),
        skills=_canon_name_map(skills_raw),
        class_features=_canon_name_map(class_features_raw),
        backgrounds=_canon_name_map(backgrounds_raw),
        racial_traits=_canon_name_map(racial_traits_raw),
        languages=_canon_name_map(languages_raw or []),
        weapons=_canon_name_map(weapons_raw or []),
        entity_by_id=entity_by_id,
    )


def _normalize_feature_label(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()).strip(" ,;")


def _strip_or_prefix(part: str) -> str:
    return re.sub(r"^\s*or\s+", "", part, flags=re.I).strip()


def _append_token(tokens: List[Dict[str, Any]], kind: str, value: Any) -> None:
    tokens.append({"kind": kind, "value": value})


def _resolve_entity_id(
    part: str, tokens: List[Dict[str, Any]], lookups: Optional[PrereqLookups]
) -> bool:
    upper = part.upper()
    if upper.startswith(_ARENA_WEAPON_CATEGORY_PREFIX):
        suffix = upper[len(_ARENA_WEAPON_CATEGORY_PREFIX) :].replace("_", " ").title()
        if suffix:
            _append_token(tokens, "proficiency", suffix)
            return True

    if not lookups or not upper.startswith("ID_"):
        return False
    hit = lookups.entity_by_id.get(part) or lookups.entity_by_id.get(part.upper())
    if not hit:
        for iid, val in lookups.entity_by_id.items():
            if iid.lower() == part.lower():
                hit = val
                break
    if not hit:
        return False
    kind, name = hit
    if kind == "proficiency":
        _append_token(tokens, "proficiency", name)
    elif kind == "class":
        _append_token(tokens, "class", name)
    else:
        _append_token(tokens, kind, name)
    return True


def _normalize_clause_part(part: str) -> str:
    part = _strip_or_prefix(part.strip().strip(",").strip())
    part = re.sub(r"^and\s+", "", part, flags=re.I).strip()
    return part.rstrip(".")


def _class_display_name(class_key: str, known_classes: Set[str]) -> str:
    if class_key in known_classes:
        return class_key.title() if class_key.islower() else class_key
    return class_key


def _try_race_class_allof(
    part: str,
    tokens: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: Set[str],
) -> bool:
    """`human fighter`, `drow ranger` → allOf [race, class]."""
    m = re.match(r"^(.+?)\s+(.+?)$", part.strip(), re.I)
    if not m:
        return False
    race_key = m.group(1).strip().lower()
    class_key = m.group(2).strip().lower()
    if race_key not in race_by_lower or class_key not in known_classes:
        return False
    tokens.append(
        {
            "kind": "allOf",
            "requirements": [
                {"kind": "race", "value": race_by_lower[race_key]},
                {"kind": "class", "value": _class_display_name(class_key, known_classes)},
            ],
        }
    )
    return True


def _try_class_with_allof(
    part: str,
    tokens: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: Set[str],
    lookups: Optional[PrereqLookups],
    depth: int,
) -> bool:
    """`swordmage with aegis of assault`, `be a warlock with the fey pact`."""
    if re.match(r"^training with\s+", part, re.I):
        return False
    m = re.match(r"^(?:be\s+a\s+)?(.+?)\s+with\s+(?:the\s+)?(.+)$", part, re.I)
    if not m:
        return False
    left = _normalize_feature_label(m.group(1))
    right = _normalize_feature_label(m.group(2))
    reqs: List[Dict[str, Any]] = []
    left_lower = left.lower()
    if left_lower in known_classes:
        reqs.append({"kind": "class", "value": _class_display_name(left_lower, known_classes)})
    else:
        sub: List[Dict[str, Any]] = []
        sub_anom: List[Dict[str, Any]] = []
        _parse_one_prereq_clause(
            left, sub, sub_anom, race_by_lower, known_classes, lookups, depth + 1, allow_or=False
        )
        if sub_anom or len(sub) != 1:
            return False
        reqs.append(sub[0])

    right_lower = right.lower()
    if right_lower in PACT_CLASS_FEATURES or right_lower.endswith(" pact"):
        label = right if right_lower.endswith(" pact") else f"{right} pact"
        reqs.append({"kind": "classFeature", "value": label.title() if label.islower() else label})
    elif lookups and lookups.class_features.get(right_lower):
        reqs.append({"kind": "classFeature", "value": lookups.class_features[right_lower]})
    elif lookups and lookups.racial_traits.get(right_lower):
        reqs.append({"kind": "racialTrait", "value": lookups.racial_traits[right_lower]})
    else:
        sub = []
        sub_anom = []
        _parse_one_prereq_clause(
            right, sub, sub_anom, race_by_lower, known_classes, lookups, depth + 1, allow_or=False
        )
        if not sub_anom and len(sub) == 1:
            reqs.append(sub[0])
        else:
            reqs.append({"kind": "classFeature", "value": right})

    tokens.append({"kind": "allOf", "requirements": reqs})
    return True


def _try_proficiency_compound(part: str, tokens: List[Dict[str, Any]]) -> bool:
    m_train = re.match(r"^training with\s+(.+)$", part, re.I)
    if m_train:
        tokens.append({"kind": "proficiency", "value": _normalize_feature_label(m_train.group(1))})
        return True
    patterns = [
        (r"^implement proficiency\s*\((.+)\)\s*$", "Implement: {}"),
        (r"^weapon proficiency\s*\((.+)\)\s*$", "{}"),
        (r"^armor proficiency\s*\((.+)\)\s*$", "{}"),
        (r"^shield proficiency\s*\((.+)\)\s*$", "{}"),
        (r"^proficient in\s+(.+)$", "{}"),
        (r"^proficient with\s+(.+)$", "{}"),
    ]
    for pat, fmt in patterns:
        m = re.match(pat, part, re.I)
        if m:
            val = _normalize_feature_label(m.group(1))
            tokens.append({"kind": "proficiency", "value": fmt.format(val)})
            return True
    return False


def _try_power_source_or_class(part: str, tokens: List[Dict[str, Any]]) -> bool:
    """`Any martial or divine class`, with optional trailing qualifier."""
    m = re.match(
        r"^any\s+([a-z]+)\s+or\s+([a-z]+)\s+class(?:\s+that\s+(.+))?\s*$",
        part.strip(),
        re.I,
    )
    if not m:
        return False
    a = _POWER_SOURCE_ALIASES.get(m.group(1).lower(), m.group(1).lower())
    b = _POWER_SOURCE_ALIASES.get(m.group(2).lower(), m.group(2).lower())
    if a not in POWER_SOURCE_ANY or b not in POWER_SOURCE_ANY:
        return False
    any_of = {
        "kind": "anyOf",
        "options": [
            {"kind": "powerSourceAny", "value": a},
            {"kind": "powerSourceAny", "value": b},
        ],
    }
    qualifier = (m.group(3) or "").strip().rstrip(".")
    if qualifier:
        tokens.append(
            {
                "kind": "allOf",
                "requirements": [any_of, {"kind": "tag", "value": qualifier}],
            }
        )
    else:
        tokens.append(any_of)
    return True


def _try_class_and_allof(
    part: str,
    tokens: List[Dict[str, Any]],
    known_classes: Set[str],
) -> bool:
    """`Shaman and swordmage`, `Warlord and barbarian` → allOf [class, class]."""
    if not re.search(r"\s+and\s+", part, flags=re.I):
        return False
    if re.search(r"\s+and\s+!", part, flags=re.I):
        return False
    subparts = [p.strip() for p in re.split(r"\s+and\s+", part, flags=re.I) if p.strip()]
    if len(subparts) < 2:
        return False
    reqs: List[Dict[str, Any]] = []
    for sp in subparts:
        class_key = sp.strip().lower()
        if class_key not in known_classes:
            return False
        reqs.append({"kind": "class", "value": _class_display_name(class_key, known_classes)})
    tokens.append({"kind": "allOf", "requirements": reqs})
    return True


def _try_be_a_phrase(
    part: str,
    tokens: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: Set[str],
) -> bool:
    """`be a half-elf`, `must be an artificer`."""
    m = re.match(r"^(?:must be|be)\s+(?:a|an)\s+(.+)$", part.strip(), re.I)
    if not m:
        return False
    target = m.group(1).strip().rstrip(".")
    target_lower = target.lower()
    if target_lower in race_by_lower:
        tokens.append({"kind": "race", "value": race_by_lower[target_lower]})
        return True
    if target_lower in known_classes:
        tokens.append({"kind": "class", "value": _class_display_name(target_lower, known_classes)})
        return True
    return False


def _try_power_source_phrase(part: str, tokens: List[Dict[str, Any]]) -> bool:
    """`Arcane power source`, `divine power source`, bare `Arcane class`."""
    lowered = part.lower()
    m_src = re.match(r"^([a-z]+)\s+power\s+source\s*$", lowered)
    if m_src:
        src = _POWER_SOURCE_ALIASES.get(m_src.group(1), m_src.group(1))
        if src in POWER_SOURCE_ANY:
            tokens.append({"kind": "powerSourceAny", "value": src})
            return True
    m_class = re.match(r"^([a-z]+)\s+class\s*$", lowered)
    if m_class:
        src = _POWER_SOURCE_ALIASES.get(m_class.group(1), m_class.group(1))
        if src in POWER_SOURCE_ANY:
            tokens.append({"kind": "powerSourceAny", "value": src})
            return True
    return False


def _try_pact_phrases(
    part: str,
    tokens: List[Dict[str, Any]],
    known_classes: Set[str],
) -> bool:
    lowered = part.lower()
    if lowered == "any warlock pact":
        tokens.append({"kind": "tag", "value": "any warlock pact"})
        return True
    m = re.match(r"^(.+?)\s+pact\s+warlock\s*$", part, re.I)
    if m:
        pact = _normalize_feature_label(m.group(1))
        if not pact.lower().endswith(" pact"):
            pact = f"{pact} pact"
        tokens.append(
            {
                "kind": "allOf",
                "requirements": [
                    {"kind": "class", "value": "Warlock"},
                    {"kind": "classFeature", "value": pact.title()},
                ],
            }
        )
        return True
    if lowered in PACT_CLASS_FEATURES:
        tokens.append({"kind": "classFeature", "value": part.strip().title()})
        return True
    m_paren = re.match(r"^(.+?)\s+pact\s*\((.+)\)\s*\.?$", part, re.I)
    if m_paren:
        label = f"{_normalize_feature_label(m_paren.group(1))} Pact ({m_paren.group(2).strip()})"
        tokens.append({"kind": "classFeature", "value": label})
        return True
    if lowered.endswith("pact") and " " not in lowered:
        m_camel = re.match(r"^hexblade([a-z]+)pact$", lowered)
        if m_camel:
            pact = m_camel.group(1)
            tokens.append({"kind": "classFeature", "value": f"{pact.title()} Pact"})
            return True
        tokens.append({"kind": "tag", "value": part.strip()})
        return True
    return False


def _try_build_option_phrases(
    part: str,
    tokens: List[Dict[str, Any]],
    known_classes: Set[str],
    lookups: Optional[PrereqLookups],
) -> bool:
    lowered = part.lower()
    if lowered.endswith(" spell source"):
        label = _normalize_feature_label(part[: -len(" spell source")])
        tokens.append({"kind": "classFeature", "value": label})
        return True
    if lowered.endswith(" manifestation") or lowered.endswith("soul manifestation"):
        label = part
        if lowered.endswith(" elemental manifestation"):
            label = _normalize_feature_label(part[: -len(" elemental manifestation")])
        elif lowered.endswith("soul manifestation"):
            label = _normalize_feature_label(part[: -len("soul manifestation")])
        else:
            label = _normalize_feature_label(part[: -len(" manifestation")])
        if lookups and lookups.racial_traits.get(label.lower()):
            tokens.append({"kind": "racialTrait", "value": lookups.racial_traits[label.lower()]})
        else:
            tokens.append({"kind": "racialTrait", "value": label})
        return True
    m = re.match(r"^(.+?)\s+(sorcerer|wizard|warlock|fighter|ranger|rogue|cleric|paladin)\s*$", part, re.I)
    if m:
        class_key = m.group(2).lower()
        if class_key in known_classes:
            option = _normalize_feature_label(m.group(1))
            tokens.append(
                {
                    "kind": "allOf",
                    "requirements": [
                        {"kind": "class", "value": _class_display_name(class_key, known_classes)},
                        {"kind": "classFeature", "value": option},
                    ],
                }
            )
            return True
    return False


def _try_language_phrase(part: str, tokens: List[Dict[str, Any]], lookups: Optional[PrereqLookups]) -> bool:
    m = re.match(r"^fluent in\s+(.+)$", part, re.I)
    if m:
        label = _normalize_feature_label(m.group(1))
        if lookups and lookups.languages.get(label.lower()):
            label = lookups.languages[label.lower()]
        tokens.append({"kind": "language", "value": label})
        return True
    m_lang = re.match(r"^(.+?)\s+language\s*$", part, re.I)
    if m_lang:
        label = _normalize_feature_label(m_lang.group(1))
        if lookups and lookups.languages.get(label.lower()):
            label = lookups.languages[label.lower()]
        tokens.append({"kind": "language", "value": label})
        return True
    return False


_COMPOUND_CLASS_FEATURE_SUFFIXES: Tuple[Tuple[str, str], ...] = (
    (" implement mastery", "Arcane Implement Mastery"),
    (" healing infusion", "Healing Infusion"),
)


def _try_compound_class_feature_label(part: str, tokens: List[Dict[str, Any]]) -> bool:
    """`tome implement mastery`, `shielding elixir healing infusion` build-option labels."""
    lowered = part.lower()
    for suffix, feature_name in _COMPOUND_CLASS_FEATURE_SUFFIXES:
        if lowered.endswith(suffix):
            choice = part[: -len(suffix)].strip()
            reqs: List[Dict[str, Any]] = [{"kind": "classFeature", "value": feature_name}]
            if choice:
                reqs.append({"kind": "tag", "value": f"{feature_name}: {choice}"})
            if len(reqs) == 1:
                tokens.append(reqs[0])
            else:
                tokens.append({"kind": "allOf", "requirements": reqs})
            return True
    return False


def _try_class_feature_with_choice(part: str, tokens: List[Dict[str, Any]]) -> bool:
    """`Beast Mastery class feature (bear or wolf)`."""
    m = re.match(r"^(.+?)\s+class\s+feature\s*\((.+)\)\s*\.?$", part, re.I)
    if not m:
        return False
    feature = _normalize_feature_label(m.group(1))
    tokens.append({"kind": "classFeature", "value": feature})
    choice = m.group(2).strip()
    if re.search(r"\s+or\s+", choice, flags=re.I):
        subparts = [p.strip() for p in re.split(r"\s+or\s+", choice, flags=re.I) if p.strip()]
        tokens.append(
            {
                "kind": "anyOf",
                "options": [{"kind": "tag", "value": f"{feature}: {opt}"} for opt in subparts],
            }
        )
    else:
        tokens.append({"kind": "tag", "value": f"{feature}: {choice}"})
    return True


def _resolve_name_lookup(
    lowered: str, tokens: List[Dict[str, Any]], lookups: Optional[PrereqLookups]
) -> bool:
    if not lookups:
        return False
    checks = (
        (lookups.feats, "feat"),
        (lookups.powers, "power"),
        (lookups.skills, "trainedSkill"),
        (lookups.themes, "theme"),
        (lookups.class_features, "classFeature"),
        (lookups.racial_traits, "racialTrait"),
        (lookups.backgrounds, "background"),
    )
    for table, kind in checks:
        name = table.get(lowered)
        if name:
            _append_token(tokens, kind, name)
            return True
    if lookups.weapons:
        weapon_key = lowered[4:] if lowered.startswith("the ") else lowered
        name = lookups.weapons.get(weapon_key)
        if name:
            _append_token(tokens, "proficiency", name)
            return True
    return False


def _parse_or_group(
    part: str,
    tokens: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: Set[str],
    lookups: Optional[PrereqLookups],
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
        sp = _normalize_clause_part(sp)
        sub_tokens: List[Dict[str, Any]] = []
        if _try_race_class_allof(sp, sub_tokens, race_by_lower, known_classes):
            options.append(sub_tokens[0])
            continue
        _parse_one_prereq_clause(
            sp,
            sub_tokens,
            sub_anomalies,
            race_by_lower,
            known_classes,
            lookups,
            depth + 1,
            allow_or=False,
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
    lookups: Optional[PrereqLookups] = None,
    depth: int = 0,
    allow_or: bool = True,
) -> None:
    if depth > 8:
        anomalies.append({"kind": "unparsedPrereqClause", "value": part})
        return

    part = _normalize_clause_part(part)
    if not part:
        return

    if part.startswith("!ID_") or part.upper().startswith("!ID_"):
        tokens.append({"kind": "negatedClass", "value": part[1:].strip()})
        return

    if part.startswith("!"):
        tokens.append({"kind": "negatedTag", "value": part[1:].strip()})
        return

    if part.startswith("~"):
        tokens.append({"kind": "tag", "value": part[1:]})
        return

    if _resolve_entity_id(part, tokens, lookups):
        return

    if re.search(r"\s+and\s+!", part, flags=re.I):
        subparts = [p.strip() for p in re.split(r"\s+and\s+", part, flags=re.I) if p.strip()]
        reqs: List[Dict[str, Any]] = []
        sub_anom: List[Dict[str, Any]] = []
        for sp in subparts:
            sub: List[Dict[str, Any]] = []
            _parse_one_prereq_clause(
                sp, sub, sub_anom, race_by_lower, known_classes, lookups, depth + 1, allow_or=False
            )
            if len(sub) == 1:
                reqs.append(sub[0])
            elif len(sub) > 1:
                reqs.append({"kind": "allOf", "requirements": sub})
        if not sub_anom and reqs:
            tokens.append({"kind": "allOf", "requirements": reqs})
            return

    if allow_or and _try_power_source_or_class(part, tokens):
        return

    if allow_or and _parse_or_group(part, tokens, anomalies, race_by_lower, known_classes, lookups, depth):
        return

    if part.lower() == "1 or more power points":
        tokens.append({"kind": "powerPointsAtLeast", "value": 1})
        return

    if _try_proficiency_compound(part, tokens):
        return

    if _try_compound_class_feature_label(part, tokens):
        return

    if _try_class_feature_with_choice(part, tokens):
        return

    if _try_be_a_phrase(part, tokens, race_by_lower, known_classes):
        return

    if _try_power_source_phrase(part, tokens):
        return

    if _try_class_and_allof(part, tokens, known_classes):
        return

    if _try_class_with_allof(part, tokens, anomalies, race_by_lower, known_classes, lookups, depth):
        return

    if _try_race_class_allof(part, tokens, race_by_lower, known_classes):
        return

    if _try_pact_phrases(part, tokens, known_classes):
        return

    if _try_build_option_phrases(part, tokens, known_classes, lookups):
        return

    if _try_language_phrase(part, tokens, lookups):
        return

    lowered = part.lower()

    if re.match(r"^member(?:ship)?\s+(?:of|in)\s+.+$", part, re.I):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    m_either = re.match(r"^either (?:the )?(.+)$", part, re.I)
    if m_either:
        inner = m_either.group(1).strip().rstrip(".")
        sub: List[Dict[str, Any]] = []
        sub_anom: List[Dict[str, Any]] = []
        _parse_one_prereq_clause(
            inner, sub, sub_anom, race_by_lower, known_classes, lookups, depth + 1, allow_or=False
        )
        if not sub_anom and sub:
            tokens.extend(sub)
            return

    m_must_have = re.match(r"^must have (?:the )?(.+)$", part, re.I)
    if m_must_have:
        tokens.append({"kind": "tag", "value": m_must_have.group(1).strip().rstrip(".")})
        return

    m_race_except = re.match(r"^any race except\s+(.+)$", lowered)
    if m_race_except:
        excluded = m_race_except.group(1).strip().rstrip(".")
        tokens.append(
            {
                "kind": "allOf",
                "requirements": [
                    {"kind": "tag", "value": "any race"},
                    {"kind": "negatedTag", "value": excluded},
                ],
            }
        )
        return

    m_beast = re.match(r"^beast companion\s*\((.+)\)\s*\.?$", part, re.I)
    if m_beast:
        tokens.append({"kind": "tag", "value": f"beast companion ({m_beast.group(1).strip()})"})
        return

    m_class_build = re.match(r"^(.+?)\s+\((.+)\)\s*\.?$", part)
    if m_class_build:
        class_key = m_class_build.group(1).strip().lower()
        if class_key in known_classes:
            tokens.append(
                {
                    "kind": "allOf",
                    "requirements": [
                        {"kind": "class", "value": _class_display_name(class_key, known_classes)},
                        {"kind": "tag", "value": m_class_build.group(2).strip()},
                    ],
                }
            )
            return

    if lowered in {"humanoid", "natural humanoid", "natural living humanoid"}:
        tokens.append({"kind": "tag", "value": "HUMANOID"})
        return

    if lowered == "psionic class":
        tokens.append({"kind": "powerSourceAny", "value": "psionic"})
        return

    if lowered == "size small":
        tokens.append({"kind": "size", "value": "Small"})
        return

    m_level = re.match(r"^level\s+(\d+)\s*$", lowered)
    if m_level:
        tokens.append({"kind": "levelAtLeast", "value": int(m_level.group(1))})
        return

    if lowered in {"paragon hybrid", "any crossbow", "any defender"}:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered.startswith("countsasclass(") and part.endswith(")"):
        inner = part[part.index("(") + 1 : -1].strip()
        tokens.append({"kind": "tag", "value": f"CountsAsClass({inner})"})
        return

    if re.match(r"^.+\s+familiar$", lowered) or lowered.endswith(" beast companion"):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered == "ability to mark a foe":
        tokens.append({"kind": "tag", "value": "mark"})
        return

    weapon_prof_pats = [
        r"^(one-handed|two-handed)\s+(.+)$",
        r"^(.+) that has the versatile property$",
        r"^any one-handed\s+(.+)\.?$",
    ]
    for pat in weapon_prof_pats:
        m_wp = re.match(pat, part, re.I)
        if m_wp:
            if m_wp.lastindex == 2:
                tokens.append(
                    {
                        "kind": "proficiency",
                        "value": f"{m_wp.group(1)} {m_wp.group(2)}".strip(),
                    }
                )
            else:
                tokens.append({"kind": "proficiency", "value": _normalize_feature_label(m_wp.group(1))})
            return

    if lookups and lookups.weapons.get(lowered):
        tokens.append({"kind": "proficiency", "value": lookups.weapons[lowered]})
        return
    if lowered in {"chainmail", "hammer", "mace", "spear", "flail", "pick"}:
        tokens.append({"kind": "proficiency", "value": part.strip()})
        return

    if lowered.endswith(" guild training") or lowered.endswith(" cantrip"):
        if _resolve_name_lookup(lowered, tokens, lookups):
            return
        tokens.append({"kind": "classFeature", "value": _normalize_feature_label(part)})
        return

    if lowered.startswith("must have at least one "):
        tokens.append({"kind": "tag", "value": part[22:].strip()})
        return

    if re.match(r"^.+ from .+$", lowered):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered.startswith("the "):
        tokens.append({"kind": "tag", "value": _normalize_feature_label(part[4:])})
        return

    # training with {armor} / proficient with {item}
    m_train = re.match(r"^training with\s+(.+)$", part, re.I)
    if m_train:
        tokens.append({"kind": "proficiency", "value": _normalize_feature_label(m_train.group(1))})
        return
    m_prof_item = re.match(r"^proficient with\s+(.+)$", part, re.I)
    if m_prof_item:
        tokens.append({"kind": "proficiency", "value": _normalize_feature_label(m_prof_item.group(1))})
        return

    # {armor type} armor / heavy shields
    m_armor = re.match(r"^(.+?)\s+armor\s*$", part, re.I)
    if m_armor:
        tokens.append({"kind": "proficiency", "value": _normalize_feature_label(m_armor.group(1))})
        return
    if lowered == "heavy shields":
        tokens.append({"kind": "proficiency", "value": "Heavy Shields"})
        return

    # follower of / you must worship
    m_follower = re.match(r"^follower of\s+(.+)$", part, re.I)
    if m_follower:
        tokens.append({"kind": "deity", "value": _normalize_feature_label(m_follower.group(1))})
        return
    m_worship = re.match(r"^you must worship\s+(.+)$", part, re.I)
    if m_worship:
        tokens.append({"kind": "deity", "value": _normalize_feature_label(m_worship.group(1))})
        return
    m_worship_bare = re.match(r"^worship\s+(.+)$", part, re.I)
    if m_worship_bare:
        tokens.append({"kind": "deity", "value": _normalize_feature_label(m_worship_bare.group(1))})
        return

    if lowered.startswith("you must be able to "):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered.startswith("must adhere to "):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered == "must have more than one class":
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered.startswith("any other "):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if " power that " in lowered:
        tokens.append({"kind": "power", "value": part.strip()})
        return

    # regional benefit / background label / alignment
    if lowered.endswith(" regional benefit"):
        tokens.append({"kind": "tag", "value": part.strip()})
        return
    if lowered.endswith(" background"):
        label = _normalize_feature_label(part[:-10])
        if lookups and lookups.backgrounds.get(label.lower()):
            _append_token(tokens, "background", lookups.backgrounds[label.lower()])
            return
        tokens.append({"kind": "tag", "value": part.strip()})
        return
    if "alignment" in lowered:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # paragon multiclassing phrases (feat/path gates)
    if lowered.startswith("paragon multiclassing"):
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # multiclass {source} class
    m_mc_class = re.match(r"^multiclass\s+([a-z]+)\s+class\s*$", lowered)
    if m_mc_class:
        src = _POWER_SOURCE_ALIASES.get(m_mc_class.group(1), m_mc_class.group(1))
        if src in POWER_SOURCE_ANY:
            tokens.append({"kind": "multiclassEntry", "value": True})
            tokens.append({"kind": "powerSourceAny", "value": src})
            return
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # Any {power source} class
    m_ps = re.match(r"^any\s+([a-z]+)\s+class\s*$", lowered)
    if m_ps:
        src = _POWER_SOURCE_ALIASES.get(m_ps.group(1), m_ps.group(1))
        if src in POWER_SOURCE_ANY or m_ps.group(1) in POWER_SOURCE_ANY:
            tokens.append({"kind": "powerSourceAny", "value": src})
            return

    # Bare power source (Psionic, Divine, …)
    if lowered in _POWER_SOURCE_WORDS:
        src = _POWER_SOURCE_ALIASES.get(lowered, lowered)
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

    # {name} theme
    m_theme = re.match(r"^(.+?)\s+theme\s*$", part, re.I)
    if m_theme:
        label = _normalize_feature_label(m_theme.group(1))
        if lookups and lookups.themes.get(label.lower()):
            _append_token(tokens, "theme", lookups.themes[label.lower()])
            return
        tokens.append({"kind": "theme", "value": label})
        return

    # {name} class feature
    m_cf = re.match(r"^(.+?)\s+class\s+feature\s*$", part, re.I)
    if m_cf:
        tokens.append({"kind": "classFeature", "value": _normalize_feature_label(m_cf.group(1))})
        return

    # {name} feature (armor of faith feature, …)
    m_feat_suffix = re.match(r"^(.+?)\s+feature\s*$", part, re.I)
    if m_feat_suffix:
        label = _normalize_feature_label(m_feat_suffix.group(1))
        if lookups and lookups.class_features.get(label.lower()):
            _append_token(tokens, "classFeature", lookups.class_features[label.lower()])
            return
        tokens.append({"kind": "classFeature", "value": label})
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

    # Multiclass power chain: "Any class-specific multiclass feat"
    if "class-specific multiclass" in lowered:
        tokens.append({"kind": "multiclassEntry", "value": True})
        return

    # {name} paragon path (optional name)
    m_pp = re.match(r"^(?:(.+?)\s+)?paragon\s+path\s*$", part, re.I)
    if m_pp:
        label = _normalize_feature_label(m_pp.group(1)) if m_pp.group(1) else None
        token: Dict[str, Any] = {"kind": "paragonPath"}
        if label:
            token["value"] = label
        tokens.append(token)
        return

    # {name} epic destiny (optional name)
    m_ed = re.match(r"^(?:(.+?)\s+)?epic\s+destiny\s*$", part, re.I)
    if m_ed:
        label = _normalize_feature_label(m_ed.group(1)) if m_ed.group(1) else None
        token = {"kind": "epicDestiny"}
        if label:
            token["value"] = label
        tokens.append(token)
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
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, lookups, depth + 1)
        return

    m_gap_th = re.match(r"^(\d+)\s+th\s+level\s*(.*)$", part, re.I)
    if m_gap_th:
        tokens.append({"kind": "levelAtLeast", "value": int(m_gap_th.group(1))})
        rest = (m_gap_th.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, lookups, depth + 1)
        return

    m_th_level = re.match(r"^(\d+)\s*th\s+level\s*(.*)$", part, re.I)
    if m_th_level:
        tokens.append({"kind": "levelAtLeast", "value": int(m_th_level.group(1))})
        rest = (m_th_level.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, lookups, depth + 1)
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

    m_training_in = re.match(r"^(?:you must have\s+)?training in\s+(.+?)\.?$", part, re.I)
    if m_training_in:
        skill = _normalize_feature_label(m_training_in.group(1))
        if lookups and lookups.skills.get(skill.lower()):
            _append_token(tokens, "trainedSkill", lookups.skills[skill.lower()])
            return
        tokens.append({"kind": "trainedSkill", "value": skill})
        return

    m_any_role = re.match(r"^any\s+(defender|leader|striker|controller)\s+class\s*$", lowered)
    if m_any_role:
        tokens.append({"kind": "tag", "value": f"{m_any_role.group(1).title()} Role Class"})
        return

    if lowered in {
        "good",
        "evil",
        "lawful good",
        "chaotic evil",
        "good or lawful good",
        "lawful good",
        "unaligned",
    }:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered == "small":
        tokens.append({"kind": "size", "value": "Small"})
        return

    m_affiliated = re.match(r"^affiliated with\s+(.+)$", part, re.I)
    if m_affiliated:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered in {"familiar", "doppelganger"}:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    if lowered in {"shortbow", "longbow", "crossbow"}:
        tokens.append({"kind": "proficiency", "value": part.strip()})
        return

    if lowered.startswith("dragon breath racial power"):
        tokens.append({"kind": "racialPower", "value": "Dragon Breath"})
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
    if lowered == "fey origin":
        tokens.append({"kind": "tag", "value": "fey origin"})
        return

    if lowered in {
        "polytheist",
        "spellscar",
        "multiclass",
        "unlimited multiclass",
        "shifter",
        "hybrid character",
        "unselectable",
        "elturgard",
        "evereska",
        "sembia",
    }:
        tokens.append({"kind": "tag", "value": part.strip()})
        return

    # you have a spellscar
    if lowered.startswith("you have "):
        tokens.append({"kind": "tag", "value": part[9:].strip()})
        return

    if _resolve_name_lookup(lowered, tokens, lookups):
        return

    anomalies.append({"kind": "unparsedPrereqClause", "value": part})


def parse_prereqs(
    prereqs: Optional[str],
    known_races: Set[str],
    known_classes: Set[str],
    lookups: Optional[PrereqLookups] = None,
) -> ParseResult:
    if not prereqs:
        return ParseResult(tokens=[], anomalies=[])

    tokens: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []
    race_by_lower = {str(r).lower(): str(r) for r in known_races if r}

    text = prereqs.strip()
    parts = [p.strip() for p in re.split(r"[;,]", text) if p.strip()]

    for part in parts:
        _parse_one_prereq_clause(part, tokens, anomalies, race_by_lower, known_classes, lookups)

    return ParseResult(tokens=tokens, anomalies=anomalies)

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


ABILITY_NAME_TO_CODE = {
    "Strength": "STR",
    "Constitution": "CON",
    "Dexterity": "DEX",
    "Intelligence": "INT",
    "Wisdom": "WIS",
    "Charisma": "CHA",
}

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


@dataclass
class ParseResult:
    tokens: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]


def normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_decimal_number(text: Any) -> Optional[float]:
    """Parse integers or decimals like '2.5', '+3.5'."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    if isinstance(text, list):
        if not text:
            return None
        text = " ".join(str(x) for x in text)
    if not isinstance(text, str):
        text = str(text)
    text = text.strip()
    if not text:
        return None
    match = re.search(r"([-+]?\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def resolve_hybrid_talent_class_features(
    hybrid_talent_options_raw: Any,
    class_feature_by_name: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Map comma-separated Hybrid Talent Options names to Class Feature rows."""
    if not hybrid_talent_options_raw or not isinstance(hybrid_talent_options_raw, str):
        return []
    raw_parts = [p.strip() for p in hybrid_talent_options_raw.split(",")]
    out: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for part in raw_parts:
        if not part:
            continue
        candidates = [part, part.rstrip("."), part.strip().rstrip(".")]
        row = None
        for c in candidates:
            row = class_feature_by_name.get(c)
            if row:
                break
        if not row:
            continue
        iid = row.get("internal_id")
        if not iid:
            continue
        sid = str(iid)
        if sid in seen:
            continue
        seen.add(sid)
        sp = row.get("specific") or {}
        out.append(
            {
                "id": sid,
                "name": row.get("name"),
                "shortDescription": sp.get("Short Description"),
            }
        )
    return out


HYBRID_DEFENSE_SUFFIXES = ("Fortitude", "Reflex", "Will")


def resolve_hybrid_defense_options(
    hybrid_name: str, class_features_raw: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Core-style Hybrid X Fortitude / Reflex / Will class features for PHB3 defense picks."""
    if not hybrid_name or not isinstance(hybrid_name, str) or not hybrid_name.startswith("Hybrid "):
        return []
    prefix = hybrid_name + " "
    out: List[Dict[str, Any]] = []
    for row in class_features_raw:
        n = row.get("name")
        if not isinstance(n, str) or not n.startswith(prefix):
            continue
        tail = n[len(prefix) :].strip()
        if tail not in HYBRID_DEFENSE_SUFFIXES:
            continue
        iid = row.get("internal_id")
        if not iid:
            continue
        spec = row.get("specific") or {}
        sd = spec.get("Short Description")
        if not sd and isinstance(row.get("body"), str):
            body = str(row["body"]).strip()
            sd = body[:160] + ("…" if len(body) > 160 else "")
        out.append({"id": str(iid), "name": n, "shortDescription": sd})
    out.sort(key=lambda x: str(x.get("name") or ""))
    return out


def build_hybrid_subfeature_groups(
    hyb: Dict[str, Any],
    features_by_id: Dict[str, Dict[str, Any]],
    class_feature_by_name: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Mantle / tradition / bond / guild — parent class features with _PARSED_SUB_FEATURES."""
    spec = hyb.get("specific") or {}
    parsed = spec.get("_PARSED_CLASS_FEATURE")
    if not parsed or not isinstance(parsed, str):
        return []
    groups: List[Dict[str, Any]] = []
    for segment in [s.strip() for s in parsed.split(",")]:
        if not segment:
            continue
        parent = class_feature_by_name.get(segment)
        if not parent:
            continue
        pspec = parent.get("specific") or {}
        sub_raw = pspec.get("_PARSED_SUB_FEATURES")
        if not sub_raw:
            continue
        pid = parent.get("internal_id")
        if not pid:
            continue
        options: List[Dict[str, Any]] = []
        for sid in [s.strip() for s in str(sub_raw).split(",")]:
            if not sid:
                continue
            row = features_by_id.get(sid)
            if not row:
                continue
            sp = row.get("specific") or {}
            options.append(
                {
                    "id": str(sid),
                    "name": row.get("name"),
                    "shortDescription": sp.get("Short Description"),
                }
            )
        if not options:
            continue
        options.sort(key=lambda x: str(x.get("name") or ""))
        groups.append({"key": f"cf:{pid}", "label": segment, "options": options})
    return groups


def build_hybrid_selection_groups(
    hyb: Dict[str, Any],
    class_features_raw: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    class_feature_by_name: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Rules-driven defense pick + parsed sub-feature groups (e.g. Ardent mantle, monk tradition)."""
    groups: List[Dict[str, Any]] = []
    hybrid_name = hyb.get("name") or ""
    rules = hyb.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Class Feature":
            continue
        cat = attrs.get("Category") or ""
        if not str(cat).endswith(" Defense"):
            continue
        opts = resolve_hybrid_defense_options(str(hybrid_name), class_features_raw)
        if opts:
            groups.append({"key": "defense", "label": "Defense bonus", "options": opts})
        break
    groups.extend(build_hybrid_subfeature_groups(hyb, features_by_id, class_feature_by_name))
    return groups


def racial_trait_has_keyword_damage_choice(trait: Dict[str, Any]) -> bool:
    """Element/damage-type support traits (e.g. Dragon Breath Acid) add Keywords via rules.modify."""
    rules = trait.get("rules") or {}
    for m in rules.get("modify") or []:
        attrs = m.get("attrs") or {}
        if attrs.get("Field") == "Keywords" and attrs.get("list-addition"):
            return True
    return False


def index_support_traits_by_power_id(
    racial_traits_raw: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in racial_traits_raw:
        spec = row.get("specific") or {}
        sid = spec.get("_SupportsID")
        if sid and isinstance(sid, str):
            out[sid].append(row)
    return out


def power_select_is_element_damage_slot(category: str, text: Any) -> bool:
    """Split key-ability row vs damage-type row (Dragon Breath has both)."""
    tail = str(category).split(",")[-1].strip().lower()
    if "element" in tail:
        return True
    if isinstance(text, str) and "damage type" in text.lower():
        return True
    return False


def category_to_power_selection_key(category: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", str(category).strip()).strip("-").lower()
    return slug or "selection"


def build_power_selection_groups(
    power: Dict[str, Any],
    support_by_pid: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    Powers with rules.select type Racial Trait (e.g. Dragon Breath) — options from internal racial traits
    whose specific._SupportsID matches this power.
    """
    pid = power.get("internal_id")
    if not pid:
        return []
    traits = support_by_pid.get(str(pid)) or []
    if not traits:
        return []
    rules = power.get("rules") or {}
    selects = rules.get("select") or []
    groups: List[Dict[str, Any]] = []
    for item in selects:
        attrs = item.get("attrs") or {}
        if str(attrs.get("type")) != "Racial Trait":
            continue
        category = str(attrs.get("Category") or "")
        text = item.get("text")
        if isinstance(text, str) and text.strip():
            label = text.strip()
        elif category:
            label = category
        else:
            label = "Selection"
        want_damage = power_select_is_element_damage_slot(category, text)
        pool = (
            [t for t in traits if racial_trait_has_keyword_damage_choice(t)]
            if want_damage
            else [t for t in traits if not racial_trait_has_keyword_damage_choice(t)]
        )
        options: List[Dict[str, Any]] = []
        for t in pool:
            iid = t.get("internal_id")
            if not iid:
                continue
            sp = t.get("specific") or {}
            options.append(
                {
                    "id": str(iid),
                    "name": t.get("name"),
                    "shortDescription": sp.get("Short Description"),
                }
            )
        options.sort(key=lambda x: str(x.get("name") or ""))
        if not options:
            continue
        key = category_to_power_selection_key(category)
        groups.append({"key": key, "label": label, "options": options})
    return groups


def parse_hp_first_level_constant(text: Any) -> Optional[int]:
    """Leading integer from '6+ Constitution Score' style hybrid entries."""
    if text is None:
        return None
    if isinstance(text, list):
        text = " ".join(str(x) for x in text)
    s = str(text).strip()
    if not s:
        return None
    match = re.match(r"^(\d+)", s)
    return int(match.group(1)) if match else parse_int_from_text(text)


def parse_int_from_text(text: Any) -> Optional[int]:
    if text is None:
        return None
    if isinstance(text, list):
        if not text:
            return None
        text = " ".join(str(x) for x in text)
    if not isinstance(text, str):
        text = str(text)
    if not text:
        return None
    match = re.search(r"(\d+)", text)
    return int(match.group(1)) if match else None


def _parse_one_prereq_clause(
    part: str,
    tokens: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    race_by_lower: Dict[str, str],
    known_classes: set[str],
    _depth: int = 0,
) -> None:
    """Parse a single comma/semicolon clause; may recurse on remainder after a level prefix."""
    if _depth > 6:
        anomalies.append({"kind": "unparsedPrereqClause", "value": part})
        return

    part = part.strip().strip(",").strip()
    if not part:
        return

    # Ordinal level: "21st-level wizard", "21st level", "21st level, fighter"
    m = re.match(r"^(\d+)(?:st|nd|rd|th)\s*-\s*level\s*(.*)$", part, re.I)
    if not m:
        m = re.match(r"^(\d+)(?:st|nd|rd|th)\s+level\s*(.*)$", part, re.I)
    if m:
        tokens.append({"kind": "levelAtLeast", "value": int(m.group(1))})
        rest = (m.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, _depth + 1)
        return

    # "10 th level" (digit, space, literal th)
    m_gap_th = re.match(r"^(\d+)\s+th\s+level\s*(.*)$", part, re.I)
    if m_gap_th:
        tokens.append({"kind": "levelAtLeast", "value": int(m_gap_th.group(1))})
        rest = (m_gap_th.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, _depth + 1)
        return

    # "11th level" spelled with literal "th" after the digit (no st/nd/rd)
    m_th_level = re.match(r"^(\d+)\s*th\s+level\s*(.*)$", part, re.I)
    if m_th_level:
        tokens.append({"kind": "levelAtLeast", "value": int(m_th_level.group(1))})
        rest = (m_th_level.group(2) or "").strip().strip(",").strip()
        if rest:
            _parse_one_prereq_clause(rest, tokens, anomalies, race_by_lower, known_classes, _depth + 1)
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

    lowered = part.lower()
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

    if part.startswith("~"):
        tokens.append({"kind": "tag", "value": part[1:]})
        return

    anomalies.append({"kind": "unparsedPrereqClause", "value": part})


def parse_prereqs(prereqs: Optional[str], known_races: set[str], known_classes: set[str]) -> ParseResult:
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


def _power_selectable_ids_from_class_feature(cf: Dict[str, Any]) -> Set[str]:
    """Power internal_ids the player picks from lists on this class feature (if any)."""
    out: Set[str] = set()
    rules = cf.get("rules") or {}
    for sel in rules.get("select") or []:
        attrs = sel.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        cat = str(attrs.get("Category") or "")
        for part in cat.split("|"):
            pid = part.strip()
            if pid.startswith("ID_FMP_POWER"):
                out.add(pid)
    return out


def _granted_power_ids_from_class_feature(cf: Dict[str, Any], class_id: str) -> Set[str]:
    """
    Auto-granted power IDs from a class feature's `grant` rules, excluding powers that are
    only obtained via a same-feature `select` list (player choice).
    """
    out: Set[str] = set()
    spec = cf.get("specific") or {}
    cf_class = spec.get("Class")
    if cf_class and cf_class != class_id:
        return out
    rules = cf.get("rules") or {}
    selectable = _power_selectable_ids_from_class_feature(cf)
    for gr in rules.get("grant") or []:
        attrs = gr.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        pid = attrs.get("name")
        if not isinstance(pid, str) or not pid.startswith("ID_FMP_POWER"):
            continue
        if pid in selectable:
            continue
        req = attrs.get("requires")
        if req and req != class_id:
            continue
        out.add(pid)
    return out


def build_auto_granted_power_ids_by_class(
    grants_raw: List[Dict[str, Any]], features_by_id: Dict[str, Dict[str, Any]]
) -> Dict[str, List[str]]:
    """
    For each class, collect powers granted by class features listed on that class's Grants row,
    excluding powers that appear only as selectable options on the same feature.
    """
    by_class: Dict[str, Set[str]] = {}
    for g in grants_raw:
        sp = g.get("specific") or {}
        class_id = sp.get("_SupportsID")
        if not isinstance(class_id, str) or not class_id.startswith("ID_FMP_CLASS_"):
            continue
        rules = g.get("rules") or {}
        bucket = by_class.setdefault(class_id, set())
        for gr in rules.get("grant") or []:
            attrs = gr.get("attrs") or {}
            if attrs.get("type") != "Class Feature":
                continue
            cf_id = attrs.get("name")
            if not isinstance(cf_id, str):
                continue
            cf = features_by_id.get(cf_id)
            if not cf:
                continue
            bucket |= _granted_power_ids_from_class_feature(cf, class_id)
    return {cid: sorted(ids) for cid, ids in by_class.items() if ids}


def build_auto_granted_skill_training_names_by_support(
    grants_raw: List[Dict[str, Any]], skill_training_by_id: Dict[str, Dict[str, Any]]
) -> Dict[str, List[str]]:
    """
    Map supported entity id (race/class/theme/etc.) -> trained skill names auto-granted by Grants rows.
    """
    out: Dict[str, Set[str]] = {}
    for g in grants_raw:
        sp = g.get("specific") or {}
        support_id = sp.get("_SupportsID")
        if not isinstance(support_id, str) or not support_id:
            continue
        rules = g.get("rules") or {}
        bucket = out.setdefault(support_id, set())
        for gr in rules.get("grant") or []:
            attrs = gr.get("attrs") or {}
            if attrs.get("type") != "Skill Training":
                continue
            st_id = attrs.get("name")
            if not isinstance(st_id, str):
                continue
            row = skill_training_by_id.get(st_id)
            if not row:
                continue
            nm = str(row.get("name") or "").strip()
            if nm:
                bucket.add(nm)
    return {sid: sorted(names) for sid, names in out.items() if names}


def _parse_internal_id_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out: List[str] = []
        for part in value:
            out.extend(_parse_internal_id_list(part))
        return out
    text = str(value).strip()
    if not text:
        return []
    ids: List[str] = []
    for part in text.split(","):
        p = part.strip()
        if p.startswith("ID_"):
            ids.append(p)
    return ids


def _granted_power_ids_from_feature_any(feature: Dict[str, Any]) -> List[str]:
    rules = feature.get("rules") or {}
    out: Set[str] = set()
    for gr in rules.get("grant") or []:
        attrs = gr.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        pid = attrs.get("name")
        if isinstance(pid, str) and pid.startswith("ID_FMP_POWER"):
            out.add(pid)
    return sorted(out)


def build_class_build_options_by_class(
    grants_raw: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Class -> selectable build options inferred from class features granted at level 1 that
    expose `_PARSED_SUB_FEATURES` and a Class Feature select.
    """
    out: Dict[str, List[Dict[str, Any]]] = {}
    for g in grants_raw:
        sp = g.get("specific") or {}
        class_id = sp.get("_SupportsID")
        if not isinstance(class_id, str) or not class_id.startswith("ID_FMP_CLASS_"):
            continue
        rules = g.get("rules") or {}
        options: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        for gr in rules.get("grant") or []:
            attrs = gr.get("attrs") or {}
            if attrs.get("type") != "Class Feature":
                continue
            parent_id = attrs.get("name")
            if not isinstance(parent_id, str):
                continue
            parent = features_by_id.get(parent_id)
            if not parent:
                continue
            ps = parent.get("specific") or {}
            level = parse_int_from_text(ps.get("Level"))
            if level not in (None, 1):
                continue
            sub_ids = _parse_internal_id_list(ps.get("_PARSED_SUB_FEATURES"))
            if not sub_ids:
                continue
            parent_name = str(parent.get("name") or parent_id)
            for sid in sub_ids:
                child = features_by_id.get(sid)
                if not child or sid in seen:
                    continue
                seen.add(sid)
                cs = child.get("specific") or {}
                options.append(
                    {
                        "id": sid,
                        "name": child.get("name"),
                        "parentFeatureId": parent_id,
                        "parentFeatureName": parent_name,
                        "shortDescription": cs.get("Short Description"),
                        "body": child.get("body"),
                        "powerIds": _granted_power_ids_from_feature_any(child),
                    }
                )
        if options:
            out[class_id] = sorted(
                options,
                key=lambda r: (
                    str(r.get("parentFeatureName") or "").lower(),
                    str(r.get("name") or "").lower(),
                ),
            )
    return out


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return value.strip()


def _collapse_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _normalize_ws(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    collapsed = _collapse_ws(value)
    return collapsed if collapsed else None


def _feat_prereq_summary(tokens: List[Dict[str, Any]]) -> Optional[str]:
    if not tokens:
        return None
    parts: List[str] = []
    min_level: Optional[int] = None
    tiers: Set[str] = set()
    ability_reqs: List[str] = []
    race_reqs: List[str] = []
    class_reqs: List[str] = []
    trained_skills: List[str] = []

    for t in tokens:
        kind = t.get("kind")
        if kind == "levelAtLeast":
            v = t.get("value")
            if isinstance(v, int):
                if min_level is None or v > min_level:
                    min_level = v
        elif kind == "tier":
            v = str(t.get("value") or "").strip().upper()
            if v:
                tiers.add(v)
        elif kind == "abilityAtLeast":
            ab = str(t.get("ability") or "").strip().upper()
            v = t.get("value")
            if ab and isinstance(v, int):
                ability_reqs.append(f"{ab} {v}+")
        elif kind == "race":
            v = str(t.get("value") or "").strip()
            if v:
                race_reqs.append(v)
        elif kind == "class":
            v = str(t.get("value") or "").strip()
            if v:
                class_reqs.append(v)
        elif kind == "trainedSkill":
            v = str(t.get("value") or "").strip()
            if v:
                trained_skills.append(v)

    if min_level is not None:
        parts.append(f"Level {min_level}+")
    if tiers:
        parts.append("Tier: " + ", ".join(sorted(x.title() for x in tiers)))
    if ability_reqs:
        parts.append("Ability: " + ", ".join(sorted(set(ability_reqs))))
    if race_reqs:
        parts.append("Race: " + ", ".join(sorted(set(race_reqs))))
    if class_reqs:
        parts.append("Class: " + ", ".join(sorted(set(class_reqs))))
    if trained_skills:
        parts.append("Trained skill: " + ", ".join(sorted(set(trained_skills))))

    if not parts:
        return None
    return "; ".join(parts)


def _feat_metadata(feat: Dict[str, Any], prereq_tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
    spec = feat.get("specific") or {}
    name = str(feat.get("name") or "")
    short_desc = str(spec.get("Short Description") or "")
    special = str(spec.get("Special") or "")
    body = str(feat.get("body") or "")
    prereqs = str(feat.get("prereqs") or "")
    tier = str(spec.get("Tier") or "").strip()
    haystack = " ".join([name, short_desc, special, body, prereqs]).lower()

    tags: Set[str] = set()
    if tier:
        tags.add(f"Tier: {tier.title()}")

    for token in prereq_tokens:
        kind = token.get("kind")
        if kind == "class":
            tags.add("Class")
        elif kind == "race":
            tags.add("Racial")
        elif kind == "trainedSkill":
            tags.add("Skill")
        elif kind == "abilityAtLeast":
            tags.add("Ability")
        elif kind == "levelAtLeast":
            tags.add("Level Prereq")
        elif kind == "tier":
            tags.add("Tier Prereq")
        elif kind == "tag":
            tags.add("Tagged")

    if "weapon" in haystack:
        tags.add("Weapon")
    if "implement" in haystack:
        tags.add("Implement")
    if "armor" in haystack or "shield" in haystack:
        tags.add("Armor")
    if (
        "ac" in haystack
        or "fortitude" in haystack
        or "reflex" in haystack
        or "will defense" in haystack
    ):
        tags.add("Defense")
    if (
        "shift" in haystack
        or "speed" in haystack
        or "charge" in haystack
        or "teleport" in haystack
        or "jump" in haystack
        or "climb" in haystack
        or "swim" in haystack
    ):
        tags.add("Mobility")
    if (
        "healing surge" in haystack
        or "regain hit points" in haystack
        or "hit points" in haystack
        or "temporary hit points" in haystack
    ):
        tags.add("Healing")
    if (
        "opportunity attack" in haystack
        or "basic attack" in haystack
        or "combat advantage" in haystack
        or "critical hit" in haystack
    ):
        tags.add("Combat")
    if "at-will" in haystack or "encounter power" in haystack or "daily power" in haystack:
        tags.add("Power")

    if "Skill" in tags:
        category = "Skill"
    elif "Class" in tags:
        category = "Class"
    elif "Racial" in tags:
        category = "Racial"
    elif "Weapon" in tags:
        category = "Weapon"
    elif "Implement" in tags:
        category = "Implement"
    elif "Armor" in tags:
        category = "Armor"
    elif "Defense" in tags:
        category = "Defense"
    elif "Mobility" in tags:
        category = "Mobility"
    elif "Healing" in tags:
        category = "Healing"
    elif "Power" in tags:
        category = "Power"
    elif "Combat" in tags:
        category = "Combat"
    else:
        category = "General"

    return {
        "category": category,
        "tags": sorted(tags),
        "prereqSummary": _feat_prereq_summary(prereq_tokens),
    }


def _rules_element_to_row(elem: ET.Element) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "internal_id": elem.attrib.get("internal-id"),
        "name": elem.attrib.get("name"),
        "type": elem.attrib.get("type"),
        "source": elem.attrib.get("source"),
        "revision_date": elem.attrib.get("revision-date"),
    }

    specific: Dict[str, Any] = {}
    rules: Dict[str, List[Dict[str, Any]]] = {}
    body_parts: List[str] = []

    if elem.text and elem.text.strip():
        body_parts.append(elem.text)

    for child in elem:
        tag = child.tag
        if tag == "Prereqs":
            text = _normalize_ws("".join(child.itertext()))
            if text:
                row["prereqs"] = text
        elif tag == "Flavor":
            text = _normalize_ws("".join(child.itertext()))
            if text:
                row["flavor"] = text
        elif tag == "specific":
            key = child.attrib.get("name")
            if key:
                val = _normalize_ws("".join(child.itertext()))
                if key in specific:
                    if isinstance(specific[key], list):
                        specific[key].append(val)
                    else:
                        specific[key] = [specific[key], val]
                else:
                    specific[key] = val
        elif tag == "rules":
            for rc in child:
                ent: Dict[str, Any] = {"attrs": dict(rc.attrib)}
                txt = _normalize_ws("".join(rc.itertext()))
                if txt:
                    ent["text"] = txt
                rules.setdefault(rc.tag, []).append(ent)
        tail = _normalize_ws(child.tail)
        if tail:
            body_parts.append(tail)

    if specific:
        row["specific"] = specific
    if rules:
        row["rules"] = rules
    body = _normalize_ws(" ".join(body_parts))
    if body:
        row["body"] = body
    return row


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def load_raw_collections_from_xml(xml_path: Path) -> Dict[str, List[Dict[str, Any]]]:
    wanted = {
        "Race",
        "Class",
        "Feat",
        "Power",
        "Skill",
        "Armor",
        "Weapon",
        "Superior Implement",
        "Ability Score",
        "Theme",
        "Paragon Path",
        "Epic Destiny",
        "Language",
        "Racial Trait",
        "Class Feature",
        "Grants",
        "Skill Training",
        "Hybrid Class",
    }
    out: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for _, elem in ET.iterparse(str(xml_path), events=("end",)):
        if _local_name(elem.tag) != "RulesElement":
            continue
        t = elem.attrib.get("type")
        if t in wanted:
            out[t].append(_rules_element_to_row(elem))
        elem.clear()
    return out


def load_raw_collections(input_path: Path) -> Dict[str, List[Dict[str, Any]]]:
    if input_path.is_file() and input_path.suffix.lower() == ".xml":
        return load_raw_collections_from_xml(input_path)

    if not input_path.is_dir():
        raise FileNotFoundError(
            f"Input path must be an XML file or a directory of JSON extracts: {input_path}"
        )

    def read_json(name: str) -> List[Dict[str, Any]]:
        p = input_path / name
        if not p.is_file():
            return []
        return json.loads(p.read_text(encoding="utf-8"))

    return {
        "Race": read_json("Race.json"),
        "Class": read_json("Class.json"),
        "Feat": read_json("Feat.json"),
        "Power": read_json("Power.json"),
        "Skill": read_json("Skill.json"),
        "Armor": read_json("Armor.json"),
        "Weapon": read_json("Weapon.json"),
        "Superior Implement": read_json("Superior Implement.json"),
        "Ability Score": read_json("Ability Score.json"),
        "Theme": read_json("Theme.json"),
        "Paragon Path": read_json("Paragon Path.json"),
        "Epic Destiny": read_json("Epic Destiny.json"),
        "Language": read_json("Language.json"),
        "Racial Trait": read_json("Racial Trait.json"),
        "Class Feature": read_json("Class Feature.json"),
        "Grants": read_json("Grants.json"),
        "Skill Training": read_json("Skill Training.json"),
        "Hybrid Class": read_json("Hybrid Class.json"),
    }


def build_index(input_path: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    anomalies_path = output_dir / "etl_anomalies.jsonl"
    collections = load_raw_collections(input_path)

    races_raw = collections["Race"]
    classes_raw = collections["Class"]
    feats_raw = collections["Feat"]
    powers_raw = collections["Power"]
    skills_raw = collections["Skill"]
    armor_raw = collections["Armor"]
    weapons_raw = collections["Weapon"]
    implements_raw = collections["Superior Implement"]
    ability_score_raw = collections["Ability Score"]
    themes_raw = collections["Theme"]
    paragon_raw = collections["Paragon Path"]
    epic_raw = collections["Epic Destiny"]
    languages_raw = collections["Language"]
    racial_traits_raw = collections["Racial Trait"]
    class_features_raw = collections["Class Feature"]
    skill_training_raw = collections["Skill Training"]
    hybrid_classes_raw = collections["Hybrid Class"]
    features_by_id: Dict[str, Dict[str, Any]] = {
        str(row.get("internal_id")): row for row in class_features_raw if row.get("internal_id")
    }
    class_feature_by_name: Dict[str, Dict[str, Any]] = {}
    for row in class_features_raw:
        n = row.get("name")
        if isinstance(n, str) and n.strip():
            class_feature_by_name[n.strip()] = row

    grants_raw = collections["Grants"]
    auto_granted_power_ids_by_class = build_auto_granted_power_ids_by_class(grants_raw, features_by_id)
    skill_training_by_id: Dict[str, Dict[str, Any]] = {
        str(row.get("internal_id")): row
        for row in skill_training_raw
        if row.get("internal_id")
    }
    auto_granted_skill_training_names_by_support = build_auto_granted_skill_training_names_by_support(
        grants_raw, skill_training_by_id
    )
    class_build_options_by_class = build_class_build_options_by_class(grants_raw, features_by_id)

    known_races = {r.get("name", "") for r in races_raw}
    known_classes = {c.get("name", "").lower() for c in classes_raw}

    anomalies: List[Dict[str, Any]] = []

    races: List[Dict[str, Any]] = []
    for race in races_raw:
        races.append(
            {
                "id": race.get("internal_id"),
                "name": race.get("name"),
                "slug": normalize_name(race.get("name", "")),
                "source": race.get("source"),
                "speed": parse_int_from_text((race.get("specific") or {}).get("Speed")),
                "size": (race.get("specific") or {}).get("Size"),
                "abilitySummary": (race.get("specific") or {}).get("Ability Scores"),
                "languages": (race.get("specific") or {}).get("Languages"),
                "raw": race,
            }
        )

    languages: List[Dict[str, Any]] = []
    for row in languages_raw:
        prereqs = row.get("prereqs")
        if prereqs and "unselectable" in str(prereqs).lower():
            continue
        if row.get("name") == "All":
            continue
        languages.append(
            {
                "id": row.get("internal_id"),
                "name": row.get("name"),
                "slug": normalize_name(row.get("name", "")),
                "source": row.get("source"),
                "prereqsRaw": prereqs,
                "raw": row,
            }
        )

    racial_traits: List[Dict[str, Any]] = []
    for row in racial_traits_raw:
        spec = row.get("specific") or {}
        racial_traits.append(
            {
                "id": row.get("internal_id"),
                "name": row.get("name"),
                "slug": normalize_name(row.get("name", "")),
                "source": row.get("source"),
                "shortDescription": spec.get("Short Description"),
                "body": row.get("body"),
                "raw": row,
            }
        )

    classes: List[Dict[str, Any]] = []
    for cls in classes_raw:
        spec = cls.get("specific") or {}
        classes.append(
            {
                "id": cls.get("internal_id"),
                "name": cls.get("name"),
                "slug": normalize_name(cls.get("name", "")),
                "source": cls.get("source"),
                "role": spec.get("Role"),
                "powerSource": spec.get("Power Source"),
                "hitPointsAt1": parse_int_from_text(spec.get("Hit Points at 1st Level")),
                "hitPointsPerLevel": parse_int_from_text(spec.get("Hit Points per Level Gained")),
                "healingSurgesBase": parse_int_from_text(spec.get("Healing Surges")),
                "keyAbilities": spec.get("Key Abilities"),
                "raw": cls,
            }
        )

    support_traits_by_power_id = index_support_traits_by_power_id(racial_traits_raw)

    feats: List[Dict[str, Any]] = []
    for feat in feats_raw:
        parse = parse_prereqs(feat.get("prereqs"), known_races, known_classes)
        feat_meta = _feat_metadata(feat, parse.tokens)
        if parse.anomalies:
            for a in parse.anomalies:
                anomalies.append(
                    {
                        "entityType": "Feat",
                        "id": feat.get("internal_id"),
                        "name": feat.get("name"),
                        "detail": a,
                    }
                )
        feats.append(
            {
                "id": feat.get("internal_id"),
                "name": feat.get("name"),
                "slug": normalize_name(feat.get("name", "")),
                "source": feat.get("source"),
                "tier": (feat.get("specific") or {}).get("Tier"),
                "shortDescription": (feat.get("specific") or {}).get("Short Description"),
                "prereqsRaw": feat.get("prereqs"),
                "prereqTokens": parse.tokens,
                "category": feat_meta["category"],
                "tags": feat_meta["tags"],
                "prereqSummary": feat_meta["prereqSummary"],
                "raw": feat,
            }
        )

    powers: List[Dict[str, Any]] = []
    for power in powers_raw:
        spec = power.get("specific") or {}
        powers.append(
            {
                "id": power.get("internal_id"),
                "name": power.get("name"),
                "slug": normalize_name(power.get("name", "")),
                "source": power.get("source"),
                "classId": spec.get("Class"),
                "usage": spec.get("Power Usage"),
                "level": parse_int_from_text(spec.get("Level")),
                "keywords": spec.get("Keywords"),
                "display": spec.get("Display"),
                "powerSelectionGroups": build_power_selection_groups(power, support_traits_by_power_id),
                "raw": power,
            }
        )

    skills: List[Dict[str, Any]] = []
    for skill in skills_raw:
        skills.append(
            {
                "id": skill.get("internal_id"),
                "name": skill.get("name"),
                "slug": normalize_name(skill.get("name", "")),
                "source": skill.get("source"),
                "keyAbility": (skill.get("specific") or {}).get("Key Ability"),
                "raw": skill,
            }
        )

    armors: List[Dict[str, Any]] = []
    for armor in armor_raw:
        spec = armor.get("specific") or {}
        armors.append(
            {
                "id": armor.get("internal_id"),
                "name": armor.get("name"),
                "slug": normalize_name(armor.get("name", "")),
                "source": armor.get("source"),
                "armorType": spec.get("Armor Type"),
                "armorCategory": spec.get("Armor Category"),
                "armorBonus": parse_int_from_text(spec.get("Armor Bonus")),
                "checkPenalty": parse_int_from_text(spec.get("Check")),
                "speedPenalty": parse_int_from_text(spec.get("Speed")),
                "raw": armor,
            }
        )

    ability_scores: List[Dict[str, Any]] = []
    for row in ability_score_raw:
        name = row.get("name") or ""
        ability_scores.append(
            {
                "id": row.get("internal_id"),
                "name": name,
                "slug": normalize_name(name),
                "source": row.get("source"),
                "abilityCode": ABILITY_NAME_TO_CODE.get(name),
                "body": row.get("body"),
                "raw": row,
            }
        )

    weapons: List[Dict[str, Any]] = []
    for weapon in weapons_raw:
        spec = weapon.get("specific") or {}
        weapons.append(
            {
                "id": weapon.get("internal_id"),
                "name": weapon.get("name"),
                "slug": normalize_name(weapon.get("name", "")),
                "source": weapon.get("source"),
                "proficiencyBonus": parse_int_from_text(spec.get("Proficiency Bonus")),
                "damage": spec.get("Damage"),
                "weaponCategory": spec.get("Weapon Category"),
                "handsRequired": spec.get("Hands Required"),
                "weaponGroup": spec.get("Group"),
                "properties": spec.get("Properties"),
                "range": spec.get("Range"),
                "itemSlot": spec.get("Item Slot"),
                "raw": weapon,
            }
        )

    implements: List[Dict[str, Any]] = []
    for imp in implements_raw:
        spec = imp.get("specific") or {}
        implements.append(
            {
                "id": imp.get("internal_id"),
                "name": imp.get("name"),
                "slug": normalize_name(imp.get("name", "")),
                "source": imp.get("source"),
                "implementGroup": spec.get("Group"),
                "properties": spec.get("Properties"),
                "itemSlot": spec.get("Item Slot"),
                "raw": imp,
            }
        )

    hybrid_classes: List[Dict[str, Any]] = []
    for hyb in hybrid_classes_raw:
        spec = hyb.get("specific") or {}
        hybrid_classes.append(
            {
                "id": hyb.get("internal_id"),
                "name": hyb.get("name"),
                "slug": normalize_name(hyb.get("name", "")),
                "source": hyb.get("source"),
                "baseClassId": spec.get("_BaseClass"),
                "hitPointsAt1": parse_hp_first_level_constant(spec.get("Hit Points at 1st Level")),
                "hitPointsPerLevel": parse_decimal_number(spec.get("Hit Points per Level Gained")),
                "healingSurgesBase": parse_decimal_number(spec.get("Healing Surges")),
                "keyAbilities": spec.get("Key Abilities"),
                "role": spec.get("Role"),
                "powerSource": spec.get("Power Source"),
                "bonusToDefense": spec.get("Bonus to Defense"),
                "weaponProficiencies": spec.get("Weapon Proficiencies"),
                "armorProficiencies": spec.get("Armor Proficiencies"),
                "implementText": spec.get("Implements") or spec.get("Implement"),
                "classSkillsRaw": spec.get("Class Skills"),
                "hybridTalentOptions": spec.get("Hybrid Talent Options"),
                "hybridTalentClassFeatures": resolve_hybrid_talent_class_features(
                    spec.get("Hybrid Talent Options"), class_feature_by_name
                ),
                "hybridSelectionGroups": build_hybrid_selection_groups(
                    hyb, class_features_raw, features_by_id, class_feature_by_name
                ),
                "raw": hyb,
            }
        )

    themes: List[Dict[str, Any]] = []
    for row in themes_raw:
        parse = parse_prereqs(row.get("prereqs"), known_races, known_classes)
        if parse.anomalies:
            for a in parse.anomalies:
                anomalies.append(
                    {
                        "entityType": "Theme",
                        "id": row.get("internal_id"),
                        "name": row.get("name"),
                        "detail": a,
                    }
                )
        themes.append(
            {
                "id": row.get("internal_id"),
                "name": row.get("name"),
                "slug": normalize_name(row.get("name", "")),
                "source": row.get("source"),
                "prereqsRaw": row.get("prereqs"),
                "prereqTokens": parse.tokens,
                "raw": row,
            }
        )

    paragon_paths: List[Dict[str, Any]] = []
    for row in paragon_raw:
        parse = parse_prereqs(row.get("prereqs"), known_races, known_classes)
        if parse.anomalies:
            for a in parse.anomalies:
                anomalies.append(
                    {
                        "entityType": "ParagonPath",
                        "id": row.get("internal_id"),
                        "name": row.get("name"),
                        "detail": a,
                    }
                )
        paragon_paths.append(
            {
                "id": row.get("internal_id"),
                "name": row.get("name"),
                "slug": normalize_name(row.get("name", "")),
                "source": row.get("source"),
                "prereqsRaw": row.get("prereqs"),
                "prereqTokens": parse.tokens,
                "raw": row,
            }
        )

    epic_destinies: List[Dict[str, Any]] = []
    for row in epic_raw:
        parse = parse_prereqs(row.get("prereqs"), known_races, known_classes)
        if parse.anomalies:
            for a in parse.anomalies:
                anomalies.append(
                    {
                        "entityType": "EpicDestiny",
                        "id": row.get("internal_id"),
                        "name": row.get("name"),
                        "detail": a,
                    }
                )
        epic_destinies.append(
            {
                "id": row.get("internal_id"),
                "name": row.get("name"),
                "slug": normalize_name(row.get("name", "")),
                "source": row.get("source"),
                "prereqsRaw": row.get("prereqs"),
                "prereqTokens": parse.tokens,
                "raw": row,
            }
        )

    index = {
        "meta": {
            "version": 1,
            "counts": {
                "races": len(races),
                "classes": len(classes),
                "feats": len(feats),
                "powers": len(powers),
                "skills": len(skills),
                "languages": len(languages),
                "racialTraits": len(racial_traits),
                "armors": len(armors),
                "weapons": len(weapons),
                "implements": len(implements),
                "abilityScores": len(ability_scores),
                "themes": len(themes),
                "paragonPaths": len(paragon_paths),
                "epicDestinies": len(epic_destinies),
                "hybridClasses": len(hybrid_classes),
            },
        },
        "races": races,
        "classes": classes,
        "feats": feats,
        "powers": powers,
        "skills": skills,
        "languages": languages,
        "racialTraits": racial_traits,
        "armors": armors,
        "weapons": weapons,
        "implements": implements,
        "abilityScores": ability_scores,
        "themes": themes,
        "paragonPaths": paragon_paths,
        "epicDestinies": epic_destinies,
        "hybridClasses": hybrid_classes,
        "autoGrantedPowerIdsByClassId": auto_granted_power_ids_by_class,
        "autoGrantedSkillTrainingNamesBySupportId": auto_granted_skill_training_names_by_support,
        "classBuildOptionsByClassId": class_build_options_by_class,
    }

    (output_dir / "rules_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    with anomalies_path.open("w", encoding="utf-8") as f:
        for row in anomalies:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote rules index: {output_dir / 'rules_index.json'}")
    print(f"Wrote anomalies: {anomalies_path}")
    print(f"Anomalies count: {len(anomalies)}")


def main() -> None:
    in_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("combined.dnd40.merged.xml")
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("generated")
    build_index(in_dir, out_dir)


if __name__ == "__main__":
    main()


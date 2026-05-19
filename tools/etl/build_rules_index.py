import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

_ETL_DIR = Path(__file__).resolve().parent
if str(_ETL_DIR) not in sys.path:
    sys.path.insert(0, str(_ETL_DIR))


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


from prereq_parser import ParseResult, parse_prereqs  # noqa: E402


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


def build_granted_class_feature_names_by_support(
    grants_raw: List[Dict[str, Any]], features_by_id: Dict[str, Dict[str, Any]]
) -> Dict[str, List[str]]:
    """Map supported entity id -> class feature names granted via Grants rows (direct grants only)."""
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
            if attrs.get("type") != "Class Feature":
                continue
            cf_id = attrs.get("name")
            if not isinstance(cf_id, str):
                continue
            row = features_by_id.get(cf_id)
            if not row:
                continue
            nm = str(row.get("name") or "").strip()
            if nm:
                bucket.add(nm)
    return {sid: sorted(names) for sid, names in out.items() if names}


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


PARAGON_FEAT_MIN_LEVEL = 11
EPIC_FEAT_MIN_LEVEL = 21


def _max_level_at_least(tokens: List[Dict[str, Any]]) -> Optional[int]:
    max_level: Optional[int] = None
    for token in tokens:
        if token.get("kind") != "levelAtLeast":
            continue
        value = token.get("value")
        if not isinstance(value, int):
            continue
        if max_level is None or value > max_level:
            max_level = value
    return max_level


def _tier_from_prereq_tokens(tokens: List[Dict[str, Any]]) -> Optional[str]:
    for token in tokens:
        if token.get("kind") != "tier":
            continue
        value = str(token.get("value") or "").strip().upper()
        if value == "PARAGON":
            return "Paragon"
        if value == "EPIC":
            return "Epic"
        if value == "HEROIC":
            return "Heroic"
    for token in tokens:
        kind = token.get("kind")
        if kind == "paragonPath":
            return "Paragon"
        if kind == "epicDestiny":
            return "Epic"
    max_level = _max_level_at_least(tokens)
    if max_level is not None and max_level >= EPIC_FEAT_MIN_LEVEL:
        return "Epic"
    if max_level is not None and max_level >= PARAGON_FEAT_MIN_LEVEL:
        return "Paragon"
    return None


def _tier_from_prereqs_raw(prereqs_raw: Optional[str]) -> Optional[str]:
    if not prereqs_raw:
        return None
    lowered = prereqs_raw.lower()
    if "epic tier" in lowered:
        return "Epic"
    if "paragon tier" in lowered:
        return "Paragon"
    return None


def _normalize_feat_tier_label(tier: Optional[str]) -> Optional[str]:
    if not tier:
        return None
    text = str(tier).strip()
    if not text:
        return None
    lowered = text.lower()
    if lowered == "heroic":
        return "Heroic"
    if lowered == "paragon":
        return "Paragon"
    if lowered == "epic":
        return "Epic"
    return text


def resolve_feat_tier_and_prereqs(
    spec_tier: Any,
    prereq_tokens: List[Dict[str, Any]],
    prereqs_raw: Optional[str],
) -> tuple[Optional[str], List[Dict[str, Any]]]:
    """Infer feat tier from compendium + prereqs; inject 11+/21+ level when paragon/epic lacks it."""
    tier = _normalize_feat_tier_label(str(spec_tier or "").strip() or None)
    if not tier:
        tier = _tier_from_prereq_tokens(prereq_tokens)
    if not tier:
        tier = _tier_from_prereqs_raw(prereqs_raw)

    tokens = list(prereq_tokens)
    max_level = _max_level_at_least(tokens)
    tier_key = (tier or "").lower()
    if tier_key == "paragon" and (max_level is None or max_level < PARAGON_FEAT_MIN_LEVEL):
        tokens.insert(0, {"kind": "levelAtLeast", "value": PARAGON_FEAT_MIN_LEVEL})
    elif tier_key == "epic" and (max_level is None or max_level < EPIC_FEAT_MIN_LEVEL):
        tokens.insert(0, {"kind": "levelAtLeast", "value": EPIC_FEAT_MIN_LEVEL})
    return tier, tokens


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


def _feat_metadata(
    feat: Dict[str, Any],
    prereq_tokens: List[Dict[str, Any]],
    *,
    tier: Optional[str] = None,
) -> Dict[str, Any]:
    spec = feat.get("specific") or {}
    name = str(feat.get("name") or "")
    short_desc = str(spec.get("Short Description") or "")
    special = str(spec.get("Special") or "")
    body = str(feat.get("body") or "")
    prereqs = str(feat.get("prereqs") or "")
    tier = _normalize_feat_tier_label(tier or str(spec.get("Tier") or "").strip() or None) or ""
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


def _normalize_statadd_entry_attrs(attrs: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten Character Builder statadd attrs for JSON (feats, themes, paths, destinies)."""
    out: Dict[str, Any] = {
        "name": str(attrs.get("name") or "").strip(),
        "value": str(attrs.get("value") or "").strip(),
    }
    for key in ("condition", "wearing", "requires", "type"):
        v = attrs.get(key)
        if v is not None and str(v).strip():
            out[key] = str(v).strip()
    return out


def _parse_proficiency_grant_internal_id(internal_id: str) -> Optional[Dict[str, str]]:
    """Parse ID_INTERNAL_PROFICIENCY_* grant targets into structured proficiency grants."""
    if not internal_id.startswith("ID_INTERNAL_PROFICIENCY_"):
        return None
    rest = internal_id[len("ID_INTERNAL_PROFICIENCY_") :]
    patterns = [
        (r"^WEAPON_GROUP_\(([^)]+)\)$", "weaponGroup"),
        (r"^ARMOR_PROFICIENCY_\(([^)]+)\)$", "armor"),
        (r"^SHIELD_PROFICIENCY_\(([^)]+)\)$", "shield"),
        (r"^IMPLEMENT_PROFICIENCY_\(([^)]+)\)$", "implement"),
        (r"^WEAPON_PROFICIENCY_\(([^)]+)\)$", "weaponName"),
    ]
    for pat, kind in patterns:
        m = re.match(pat, rest)
        if m:
            raw = m.group(1).replace("_", " ").strip()
            return {
                "kind": kind,
                "value": raw.lower(),
                "label": raw.title(),
            }
    val = rest.replace("_", " ").strip()
    if not val:
        return None
    return {
        "kind": "weaponCategory",
        "value": val.lower(),
        "label": val.title(),
    }


def _internal_grant_key_from_id(internal_id: str) -> Optional[str]:
    """Stable key for Internal grant rows (bloodline flags, ki focus, etc.)."""
    if internal_id.startswith("ID_INTERNAL_INTERNAL_"):
        return internal_id[len("ID_INTERNAL_INTERNAL_") :]
    if internal_id.startswith("ID_INTERNAL_"):
        return internal_id[len("ID_INTERNAL_") :]
    return None


def _class_feature_lookup_priority(name: str) -> int:
    """Prefer base class features over Hybrid / Multiclass rows when keys collide."""
    lower = name.lower()
    if "(hybrid)" in lower or "(multiclass)" in lower:
        return 0
    return 1


def _build_class_feature_name_lookup(
    class_features_raw: List[Dict[str, Any]],
) -> Dict[str, str]:
    """Lowercase / normalized keys -> canonical class feature display name."""
    lookup: Dict[str, str] = {}
    sorted_rows = sorted(
        class_features_raw,
        key=lambda r: _class_feature_lookup_priority(str(r.get("name") or "")),
    )
    for row in sorted_rows:
        name = row.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        canonical = name.strip()
        keys = {
            canonical.lower(),
            re.sub(r"\s*\([^)]+\)\s*$", "", canonical).strip().lower(),
            canonical.replace(" ", "").lower(),
        }
        for k in keys:
            if k:
                lookup[k] = canonical
    return lookup


def _resolve_class_feature_label(label: str, feature_name_lookup: Dict[str, str]) -> str:
    if not label:
        return label
    candidates = [
        label.lower(),
        label.replace(" ", "").lower(),
        re.sub(r"\s+", " ", label).strip().lower(),
    ]
    for key in candidates:
        if key in feature_name_lookup:
            return feature_name_lookup[key]
    return label


def _counts_as_feature_label_from_id(internal_id: str) -> Optional[str]:
    """Human label from ID_INTERNAL_COUNTSASFEATURE_* (e.g. CHANNEL_DIVINITY -> Channel Divinity)."""
    prefix = "ID_INTERNAL_COUNTSASFEATURE_"
    if not internal_id.startswith(prefix):
        return None
    suffix = internal_id[len(prefix) :]
    words = [w for w in suffix.split("_") if w]
    return " ".join(w.title() for w in words) if words else None


def _skill_training_from_grant(
    internal_id: str,
    skill_training_by_id: Dict[str, Dict[str, Any]],
    skill_name_to_id: Dict[str, str],
) -> tuple[Optional[str], Optional[str]]:
    """Resolve Skill Training grant id -> (skill name, skill id)."""
    row = skill_training_by_id.get(internal_id)
    if row:
        nm = str(row.get("name") or "").strip()
        if nm:
            return nm, skill_name_to_id.get(nm.lower())
    if internal_id.startswith("ID_INTERNAL_SKILL_TRAINING_"):
        suffix = internal_id[len("ID_INTERNAL_SKILL_TRAINING_") :].replace("_", " ").title()
        return suffix, skill_name_to_id.get(suffix.lower())
    return None, None


def _counts_as_class_label_from_id(internal_id: str) -> Optional[str]:
    """Human label from ID_INTERNAL_COUNTSASCLASS_* (e.g. ROGUE -> Rogue, [Dilettante])."""
    prefix = "ID_INTERNAL_COUNTSASCLASS_"
    if not internal_id.startswith(prefix):
        return None
    suffix = internal_id[len(prefix) :]
    if suffix.startswith("[") and suffix.endswith("]"):
        inner = suffix[1:-1].replace("_", " ").strip()
        return inner.title() if inner else inner
    return suffix.replace("_", " ").title()


def extract_grants_from_rules(
    rules: Any,
    class_name_to_id: Optional[Dict[str, str]] = None,
    skill_training_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
    skill_name_to_id: Optional[Dict[str, str]] = None,
    class_feature_name_lookup: Optional[Dict[str, str]] = None,
    class_feature_id_by_name: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Flatten `rules.grant` into compendium internal_ids and structured grant flags."""
    empty: Dict[str, Any] = {
        "grantedPowerIds": [],
        "grantedClassFeatureIds": [],
        "grantedRacialTraitIds": [],
        "proficiencyGrants": [],
        "hasMulticlassGrant": False,
        "countsAsClassNames": [],
        "countsAsClassIds": [],
        "internalGrantKeys": [],
        "grantedSkillTrainingNames": [],
        "grantedSkillTrainingIds": [],
        "countsAsFeatureNames": [],
        "countsAsFeatureIds": [],
    }
    if not isinstance(rules, dict):
        return empty

    power_ids: List[str] = []
    feature_ids: List[str] = []
    trait_ids: List[str] = []
    proficiency_grants: List[Dict[str, str]] = []
    counts_as_names: List[str] = []
    counts_as_ids: List[str] = []
    internal_keys: List[str] = []
    skill_training_names: List[str] = []
    skill_training_ids: List[str] = []
    counts_as_features: List[str] = []
    counts_as_feature_ids: List[str] = []
    has_multiclass = False
    seen_p: Set[str] = set()
    seen_f: Set[str] = set()
    seen_t: Set[str] = set()
    seen_prof: Set[str] = set()
    seen_counts_name: Set[str] = set()
    seen_counts_id: Set[str] = set()
    seen_internal: Set[str] = set()
    seen_skill_name: Set[str] = set()
    seen_skill_id: Set[str] = set()
    seen_feature_name: Set[str] = set()
    seen_feature_id: Set[str] = set()
    class_lookup = class_name_to_id or {}
    feature_name_lookup: Dict[str, str] = {}
    st_lookup = skill_training_by_id or {}
    skill_lookup = skill_name_to_id or {}
    if class_feature_name_lookup:
        feature_name_lookup = class_feature_name_lookup
    feature_id_lookup = class_feature_id_by_name or {}

    for gr in rules.get("grant") or []:
        if not isinstance(gr, dict):
            continue
        attrs = gr.get("attrs") or {}
        name = attrs.get("name")
        if not isinstance(name, str):
            continue
        gtype = str(attrs.get("type") or "").strip().lower()
        if gtype == "proficiency" and name.startswith("ID_INTERNAL_PROFICIENCY_"):
            parsed = _parse_proficiency_grant_internal_id(name)
            if parsed:
                key = f"{parsed['kind']}:{parsed['value']}"
                if key not in seen_prof:
                    seen_prof.add(key)
                    proficiency_grants.append(parsed)
            continue
        if gtype == "multiclass" or name == "ID_INTERNAL_MULTICLASS_MULTICLASS":
            has_multiclass = True
            continue
        if gtype == "countsasclass":
            label = _counts_as_class_label_from_id(name)
            if label and label not in seen_counts_name:
                seen_counts_name.add(label)
                counts_as_names.append(label)
                cid = class_lookup.get(label.lower())
                if cid and cid not in seen_counts_id:
                    seen_counts_id.add(cid)
                    counts_as_ids.append(cid)
            continue
        if gtype == "internal":
            ikey = _internal_grant_key_from_id(name)
            if ikey and ikey not in seen_internal:
                seen_internal.add(ikey)
                internal_keys.append(ikey)
            continue
        if gtype == "skill training":
            sk_name, sk_id = _skill_training_from_grant(name, st_lookup, skill_lookup)
            if sk_name and sk_name not in seen_skill_name:
                seen_skill_name.add(sk_name)
                skill_training_names.append(sk_name)
            if sk_id and sk_id not in seen_skill_id:
                seen_skill_id.add(sk_id)
                skill_training_ids.append(sk_id)
            continue
        if gtype == "countsasfeature":
            raw_label = _counts_as_feature_label_from_id(name)
            if not raw_label:
                continue
            flabel = _resolve_class_feature_label(raw_label, feature_name_lookup)
            if flabel not in seen_feature_name:
                seen_feature_name.add(flabel)
                counts_as_features.append(flabel)
            fid = feature_id_lookup.get(flabel.lower())
            if fid and fid not in seen_feature_id:
                seen_feature_id.add(fid)
                counts_as_feature_ids.append(fid)
            continue
        if not name.startswith("ID_"):
            continue
        if gtype == "power" and "_POWER_" in name:
            if name not in seen_p:
                seen_p.add(name)
                power_ids.append(name)
        elif gtype == "class feature":
            if name not in seen_f:
                seen_f.add(name)
                feature_ids.append(name)
        elif gtype == "racial trait":
            if name not in seen_t:
                seen_t.add(name)
                trait_ids.append(name)

    return {
        "grantedPowerIds": power_ids,
        "grantedClassFeatureIds": feature_ids,
        "grantedRacialTraitIds": trait_ids,
        "proficiencyGrants": proficiency_grants,
        "hasMulticlassGrant": has_multiclass,
        "countsAsClassNames": counts_as_names,
        "countsAsClassIds": counts_as_ids,
        "internalGrantKeys": internal_keys,
        "grantedSkillTrainingNames": skill_training_names,
        "grantedSkillTrainingIds": skill_training_ids,
        "countsAsFeatureNames": counts_as_features,
        "countsAsFeatureIds": counts_as_feature_ids,
    }


def _parse_associated_power_names(spec: Any) -> List[str]:
    """Comma-separated power names from feat specific['Associated Powers'] (augmentations, not grants)."""
    if not isinstance(spec, dict):
        return []
    raw = str(spec.get("Associated Powers") or "").strip()
    if not raw or raw.lower() == "null":
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _build_power_name_to_id(powers_raw: List[Dict[str, Any]]) -> Dict[str, str]:
    """First compendium row per display name (case-insensitive), matching builder name resolution."""
    lookup: Dict[str, str] = {}
    for power in powers_raw:
        pid = power.get("internal_id")
        pname = power.get("name")
        if not isinstance(pid, str) or not isinstance(pname, str):
            continue
        key = pname.strip().lower()
        if key and key not in lookup:
            lookup[key] = pid
    return lookup


def _append_synthesized_power_modify_rules(
    feat: Dict[str, Any], power_modifications: List[Dict[str, Any]]
) -> None:
    """Merge Associated Powers augmentations into feat.rules.modify (CB style feats)."""
    if not power_modifications:
        return
    rules = feat.get("rules")
    if not isinstance(rules, dict):
        rules = {}
        feat["rules"] = rules
    modify = rules.get("modify")
    if not isinstance(modify, list):
        modify = []
        rules["modify"] = modify
    existing_names = {
        str((m.get("attrs") or {}).get("name") or "").strip().lower()
        for m in modify
        if isinstance(m, dict) and str((m.get("attrs") or {}).get("type") or "").strip().lower() == "power"
    }
    for entry in power_modifications:
        pname = str(entry.get("powerName") or "").strip()
        if not pname or pname.lower() in existing_names:
            continue
        existing_names.add(pname.lower())
        modify.append(
            {
                "attrs": {
                    "name": pname,
                    "type": "Power",
                    "Field": str(entry.get("field") or feat.get("name") or "").strip(),
                    "value": str(entry.get("value") or "").strip(),
                }
            }
        )


def extract_feat_power_modifications(
    feat: Dict[str, Any],
    power_name_to_id: Dict[str, str],
) -> Dict[str, Any]:
    """
  Powers a feat augments (style / arena fighting), not grants.

  Sources:
  - rules.modify with type Power (e.g. Corellon's Wrath Style)
  - specific['Associated Powers'] when no explicit modify row exists (e.g. Gulg Hunter Practice)
    """
    rules = feat.get("rules") if isinstance(feat.get("rules"), dict) else {}
    spec = feat.get("specific") if isinstance(feat.get("specific"), dict) else {}
    feat_name = str(feat.get("name") or "").strip()

    entries: List[Dict[str, Any]] = []
    seen_names: Set[str] = set()

    for modify in rules.get("modify") or []:
        if not isinstance(modify, dict):
            continue
        attrs = modify.get("attrs") or {}
        if str(attrs.get("type") or "").strip().lower() != "power":
            continue
        pname = str(attrs.get("name") or "").strip()
        if not pname:
            continue
        key = pname.lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        field = str(attrs.get("Field") or attrs.get("field") or feat_name).strip()
        value = str(attrs.get("value") or "").strip()
        pid = power_name_to_id.get(key)
        entries.append(
            {
                "powerName": pname,
                "powerId": pid,
                "field": field,
                "value": value,
            }
        )

    synthesized: List[Dict[str, Any]] = []
    for pname in _parse_associated_power_names(spec):
        key = pname.lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        entry = {
            "powerName": pname,
            "powerId": power_name_to_id.get(key),
            "field": feat_name,
            "value": "",
        }
        entries.append(entry)
        synthesized.append(entry)

    if synthesized:
        _append_synthesized_power_modify_rules(feat, synthesized)

    power_ids: List[str] = []
    seen_ids: Set[str] = set()
    for entry in entries:
        pid = entry.get("powerId")
        if isinstance(pid, str) and pid and pid not in seen_ids:
            seen_ids.add(pid)
            power_ids.append(pid)

    return {
        "modifiedPowerIds": power_ids,
        "powerModifications": entries,
    }


def extract_stat_adds_from_rules(rules: Any) -> List[Dict[str, Any]]:
    """rules.statadd from a compendium row (feat, theme, paragon path, epic destiny, etc.)."""
    if not isinstance(rules, dict):
        return []
    raw_list = rules.get("statadd")
    if not isinstance(raw_list, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        attrs = item.get("attrs")
        if not isinstance(attrs, dict):
            continue
        normalized = _normalize_statadd_entry_attrs(attrs)
        if normalized.get("name") or normalized.get("value"):
            out.append(normalized)
    return out


def parse_nad_bonuses_from_bonus_to_defense_field(specific: Any) -> Dict[str, int]:
    """Parse specific['Bonus to Defense'] e.g. '+1 Fortitude, +1 Reflex' -> {fortitude: 1, reflex: 1}."""
    if not isinstance(specific, dict):
        return {}
    text = str(specific.get("Bonus to Defense") or "")
    sums: Dict[str, int] = {}
    for m in re.finditer(r"([+-]\d+)\s*(Fortitude|Reflex|Will)\b", text, re.IGNORECASE):
        k = m.group(2).lower()
        if k not in ("fortitude", "reflex", "will"):
            continue
        sums[k] = sums.get(k, 0) + int(m.group(1))
    return sums


def support_entity_stat_bonuses(row: Dict[str, Any]) -> Dict[str, Any]:
    """statAdds + optional nadBonusesFromSpecific for support entities (feat, theme, path, destiny)."""
    rules = row.get("rules") or {}
    stat_adds = extract_stat_adds_from_rules(rules)
    nad = parse_nad_bonuses_from_bonus_to_defense_field(row.get("specific") or {})
    out: Dict[str, Any] = {"statAdds": stat_adds}
    if nad:
        out["nadBonusesFromSpecific"] = nad
    return out


def _split_csv_field(text: Any) -> List[str]:
    """Split compendium comma/semicolon lists (Associated Skills, Category ids, etc.)."""
    if text is None:
        return []
    if isinstance(text, list):
        parts: List[str] = []
        for item in text:
            parts.extend(_split_csv_field(item))
        return parts
    s = str(text).strip()
    if not s:
        return []
    out: List[str] = []
    for chunk in re.split(r"[,;]", s):
        piece = chunk.strip()
        if piece:
            out.append(piece)
    return out


def _proficiency_index_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize Proficiency compendium rows (internal grant targets + weapon category tags)."""
    iid = row.get("internal_id")
    name = row.get("name") or ""
    grant = _parse_proficiency_grant_internal_id(str(iid)) if isinstance(iid, str) else None
    category_raw = row.get("category")
    category_ids = _split_csv_field(category_raw) if category_raw else []
    entry: Dict[str, Any] = {
        "id": iid,
        "name": name,
        "slug": normalize_name(name),
        "source": row.get("source"),
        "categoryIds": category_ids,
        "raw": row,
    }
    if grant:
        entry["grant"] = grant
    body = row.get("body")
    if isinstance(body, str) and body.strip():
        entry["body"] = body.strip()
    return entry


def _background_index_entry(
    row: Dict[str, Any],
    known_races: Set[str],
    known_classes: Set[str],
    anomalies: List[Dict[str, Any]],
) -> Dict[str, Any]:
    spec = row.get("specific") or {}
    prereqs = row.get("prereqs")
    parse = parse_prereqs(prereqs, known_races, known_classes)
    if parse.anomalies:
        for a in parse.anomalies:
            anomalies.append(
                {
                    "entityType": "Background",
                    "id": row.get("internal_id"),
                    "name": row.get("name"),
                    "detail": a,
                }
            )
    name = row.get("name") or ""
    return {
        "id": row.get("internal_id"),
        "name": name,
        "slug": normalize_name(name),
        "source": row.get("source"),
        "backgroundType": spec.get("type"),
        "shortDescription": spec.get("Short Description"),
        "benefit": spec.get("Benefit"),
        "commonKnowledge": spec.get("Common Knowledge"),
        "campaign": spec.get("Campaign"),
        "associatedSkills": _split_csv_field(spec.get("Associated Skills")),
        "associatedLanguages": _split_csv_field(spec.get("Associated Languages")),
        "prereqsRaw": prereqs,
        "prereqTokens": parse.tokens,
        "raw": row,
    }


def _enhancement_bonus_from_magic_item(row: Dict[str, Any]) -> Optional[int]:
    """Item level enhancement (+1, +2, …) from rules.statadd or Enhancement specific."""
    rules = row.get("rules") or {}
    for item in rules.get("statadd") or []:
        if not isinstance(item, dict):
            continue
        attrs = item.get("attrs") or {}
        nm = str(attrs.get("name") or "")
        if nm.endswith(" Enhancement Bonus"):
            val = parse_int_from_text(attrs.get("value"))
            if val is not None:
                return val
    spec = row.get("specific") or {}
    text = spec.get("Enhancement")
    if text:
        val = parse_int_from_text(text)
        if val is not None:
            return val
    return None


def _is_enchant_from_specific(spec: Dict[str, Any]) -> Optional[str]:
    """Character Builder tags shield/armor/weapon enchantments via `_IsEnchant` on magic rows."""
    raw = spec.get("_IsEnchant")
    if raw is None:
        return None
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    text = str(raw).strip() if raw is not None else ""
    return text or None


def _magic_item_index_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    spec = row.get("specific") or {}
    name = row.get("name") or ""
    stat_adds = extract_stat_adds_from_rules(row.get("rules"))
    armor_types = _split_csv_field(spec.get("Armor"))
    weapon_types = _split_csv_field(spec.get("Weapon"))
    is_enchant = _is_enchant_from_specific(spec)
    entry: Dict[str, Any] = {
        "id": row.get("internal_id"),
        "name": name,
        "slug": normalize_name(name),
        "source": row.get("source"),
        "flavor": row.get("flavor"),
        "level": parse_int_from_text(spec.get("Level")),
        "gold": parse_int_from_text(spec.get("Gold")),
        "magicItemType": spec.get("Magic Item Type"),
        "itemSlot": spec.get("Item Slot") or None,
        "tier": spec.get("Tier") or None,
        "rarity": spec.get("Rarity") or None,
        "armorTypes": armor_types or None,
        "weaponTypes": weapon_types or None,
        "isEnchant": is_enchant,
        "enhancement": spec.get("Enhancement"),
        "enhancementBonus": _enhancement_bonus_from_magic_item(row),
        "property": spec.get("Property") or None,
        "power": spec.get("Power") or None,
        "critical": spec.get("Critical") or None,
        "requirement": spec.get("Requirement") or None,
        "statAdds": stat_adds,
        "raw": row,
    }
    if not entry["itemSlot"]:
        entry.pop("itemSlot", None)
    if not entry["tier"]:
        entry.pop("tier", None)
    if not entry["rarity"]:
        entry.pop("rarity", None)
    if not entry["armorTypes"]:
        entry.pop("armorTypes", None)
    if not entry["weaponTypes"]:
        entry.pop("weaponTypes", None)
    if not entry["isEnchant"]:
        entry.pop("isEnchant", None)
    if not entry["property"]:
        entry.pop("property", None)
    if not entry["power"]:
        entry.pop("power", None)
    if not entry["critical"]:
        entry.pop("critical", None)
    if not entry["requirement"]:
        entry.pop("requirement", None)
    if not entry["flavor"]:
        entry.pop("flavor", None)
    return entry


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
        elif tag == "Category":
            text = _normalize_ws("".join(child.itertext()))
            if text:
                row["category"] = text
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
        "Proficiency",
        "Background",
        "Magic Item",
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
        "Proficiency": read_json("Proficiency.json"),
        "Background": read_json("Background.json"),
        "Magic Item": read_json("Magic Item.json"),
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
    proficiencies_raw = collections["Proficiency"]
    backgrounds_raw = collections["Background"]
    magic_items_raw = collections["Magic Item"]
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
    granted_class_feature_names_by_support_id = build_granted_class_feature_names_by_support(
        grants_raw, features_by_id
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

    class_features: List[Dict[str, Any]] = []
    for row in class_features_raw:
        spec = row.get("specific") or {}
        class_features.append(
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

    class_feature_name_lookup = _build_class_feature_name_lookup(class_features_raw)
    class_feature_id_by_name: Dict[str, str] = {}
    for row in sorted(
        class_features_raw,
        key=lambda r: _class_feature_lookup_priority(str(r.get("name") or "")),
    ):
        cid = row.get("internal_id")
        cname = row.get("name")
        if isinstance(cid, str) and isinstance(cname, str) and cname.strip():
            class_feature_id_by_name[cname.strip().lower()] = cid
            base = re.sub(r"\s*\([^)]+\)\s*$", "", cname.strip()).strip().lower()
            if base:
                class_feature_id_by_name[base] = cid

    class_name_to_id: Dict[str, str] = {}
    for cls in classes_raw:
        cid = cls.get("internal_id")
        cname = cls.get("name")
        if isinstance(cid, str) and isinstance(cname, str) and cname.strip():
            class_name_to_id[cname.strip().lower()] = cid

    skill_name_to_id: Dict[str, str] = {}
    for skill in skills_raw:
        sid = skill.get("internal_id")
        sname = skill.get("name")
        if isinstance(sid, str) and isinstance(sname, str) and sname.strip():
            skill_name_to_id[sname.strip().lower()] = sid

    power_name_to_id = _build_power_name_to_id(powers_raw)

    feats: List[Dict[str, Any]] = []
    for feat in feats_raw:
        parse = parse_prereqs(feat.get("prereqs"), known_races, known_classes)
        spec = feat.get("specific") or {}
        feat_tier, feat_prereq_tokens = resolve_feat_tier_and_prereqs(
            spec.get("Tier"),
            parse.tokens,
            feat.get("prereqs"),
        )
        feat_meta = _feat_metadata(feat, feat_prereq_tokens, tier=feat_tier)
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
        feat_grants = extract_grants_from_rules(
            feat.get("rules"),
            class_name_to_id,
            skill_training_by_id,
            skill_name_to_id,
            class_feature_name_lookup,
            class_feature_id_by_name,
        )
        feat_power_mods = extract_feat_power_modifications(feat, power_name_to_id)
        feats.append(
            {
                "id": feat.get("internal_id"),
                "name": feat.get("name"),
                "slug": normalize_name(feat.get("name", "")),
                "source": feat.get("source"),
                "tier": feat_tier,
                "shortDescription": spec.get("Short Description"),
                "prereqsRaw": feat.get("prereqs"),
                "prereqTokens": feat_prereq_tokens,
                "category": feat_meta["category"],
                "tags": feat_meta["tags"],
                "prereqSummary": feat_meta["prereqSummary"],
                "raw": feat,
                **support_entity_stat_bonuses(feat),
                **feat_grants,
                **feat_power_mods,
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
                **support_entity_stat_bonuses(row),
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
                **support_entity_stat_bonuses(row),
            }
        )

    proficiencies: List[Dict[str, Any]] = []
    for row in proficiencies_raw:
        proficiencies.append(_proficiency_index_entry(row))

    backgrounds: List[Dict[str, Any]] = []
    for row in backgrounds_raw:
        backgrounds.append(_background_index_entry(row, known_races, known_classes, anomalies))

    magic_items: List[Dict[str, Any]] = []
    for row in magic_items_raw:
        magic_items.append(_magic_item_index_entry(row))

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
                **support_entity_stat_bonuses(row),
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
                "classFeatures": len(class_features),
                "armors": len(armors),
                "weapons": len(weapons),
                "implements": len(implements),
                "abilityScores": len(ability_scores),
                "themes": len(themes),
                "paragonPaths": len(paragon_paths),
                "epicDestinies": len(epic_destinies),
                "hybridClasses": len(hybrid_classes),
                "proficiencies": len(proficiencies),
                "backgrounds": len(backgrounds),
                "magicItems": len(magic_items),
            },
        },
        "races": races,
        "classes": classes,
        "feats": feats,
        "powers": powers,
        "skills": skills,
        "languages": languages,
        "racialTraits": racial_traits,
        "classFeatures": class_features,
        "armors": armors,
        "weapons": weapons,
        "implements": implements,
        "abilityScores": ability_scores,
        "themes": themes,
        "paragonPaths": paragon_paths,
        "epicDestinies": epic_destinies,
        "hybridClasses": hybrid_classes,
        "proficiencies": proficiencies,
        "backgrounds": backgrounds,
        "magicItems": magic_items,
        "autoGrantedPowerIdsByClassId": auto_granted_power_ids_by_class,
        "autoGrantedSkillTrainingNamesBySupportId": auto_granted_skill_training_names_by_support,
        "grantedClassFeatureNamesBySupportId": granted_class_feature_names_by_support_id,
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


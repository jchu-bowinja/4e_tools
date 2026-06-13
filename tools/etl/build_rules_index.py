import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

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


ARCHER_WARLORD_CLASS_FEATURE_ID = "ID_FMP_CLASS_FEATURE_2286"
PARAGON_POWER_POINTS_CLASS_FEATURE_ID = "ID_FMP_CLASS_FEATURE_1818"
HUMAN_POWER_SELECTION_TRAIT_ID = "ID_FMP_RACIAL_TRAIT_2966"
BONUS_AT_WILL_TRAIT_ID = "ID_FMP_RACIAL_TRAIT_356"
HEROIC_EFFORT_TRAIT_ID = "ID_FMP_RACIAL_TRAIT_2965"

# PHB3 Psionic Augmentation cumulative power points by character level (1–30).
PSIONIC_POWER_POINTS_BY_LEVEL: Dict[str, int] = {
    str(lv): pp
    for lv, pp in [
        (1, 2),
        (2, 2),
        (3, 4),
        (4, 4),
        (5, 4),
        (6, 4),
        (7, 6),
        (8, 6),
        (9, 6),
        (10, 6),
        (11, 6),
        (12, 6),
        (13, 7),
        (14, 7),
        (15, 7),
        (16, 7),
        (17, 9),
        (18, 9),
        (19, 9),
        (20, 9),
        (21, 11),
        (22, 11),
        (23, 13),
        (24, 13),
        (25, 13),
        (26, 13),
        (27, 15),
        (28, 15),
        (29, 15),
        (30, 15),
    ]
}

# PHB3 hybrid psionic augmentation: power points vs encounter use at these levels.
HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS: List[int] = [7, 13, 17, 23, 27]

# PHB3 paragon multiclass: non-psionic primary → psionic secondary loses this many at-will slots at 11+.
PARAGON_MC_NON_PSIONIC_TO_PSIONIC_AT_WILL_PENALTY = 1


def _parse_comma_internal_ids(raw: Any) -> List[str]:
    return [s.strip() for s in str(raw or "").split(",") if s.strip()]


def _racial_trait_power_select_category(row: Dict[str, Any]) -> Optional[str]:
    rules = row.get("rules") or {}
    for item in rules.get("select") or []:
        if not isinstance(item, dict):
            continue
        attrs = item.get("attrs") or {}
        if str(attrs.get("type") or "") != "Power":
            continue
        cat = str(attrs.get("Category") or "").strip()
        if cat:
            return cat
    return None


def _category_is_dilettante_at_will(category: str) -> bool:
    return category.strip().lower().startswith("$$not_class,at-will,1")


def _category_grants_bonus_class_at_will(category: str) -> bool:
    return category.strip().lower().startswith("$$class,at-will,1")


def _racial_trait_has_dilettante_select(row: Dict[str, Any]) -> bool:
    cat = _racial_trait_power_select_category(row)
    return bool(cat and _category_is_dilettante_at_will(cat))


def _extract_racial_trait_index_fields(
    row: Dict[str, Any], traits_by_id: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    trait_id = str(row.get("internal_id") or "")
    cat = _racial_trait_power_select_category(row)
    if cat:
        out["powerSelectCategory"] = cat
    if _racial_trait_has_dilettante_select(row):
        out["powerUsageOverride"] = "Encounter"
    if trait_id == BONUS_AT_WILL_TRAIT_ID or (cat and _category_grants_bonus_class_at_will(cat)):
        out["grantsBonusClassAtWill"] = True
    if trait_id == HUMAN_POWER_SELECTION_TRAIT_ID:
        out["grantsBonusClassAtWillByDefault"] = True
        out["heroicEffortTraitId"] = HEROIC_EFFORT_TRAIT_ID
        out["bonusAtWillTraitId"] = BONUS_AT_WILL_TRAIT_ID
    spec = row.get("specific") or {}
    option_ids = _parse_comma_internal_ids(spec.get("_PARSED_SUB_FEATURES"))
    if len(option_ids) >= 2:
        selects = (row.get("rules") or {}).get("select") or []
        is_sibling_bundle = False
        for item in selects:
            if not isinstance(item, dict):
                continue
            attrs = item.get("attrs") or {}
            if str(attrs.get("type") or "") != "Racial Trait":
                continue
            cat_attr = str(attrs.get("Category") or "")
            if re.search(r"subrace", cat_attr, re.I):
                is_sibling_bundle = True
                break
            if re.search(r"power selection$", cat_attr, re.I):
                is_sibling_bundle = True
                break
        if is_sibling_bundle and any(
            _racial_trait_has_dilettante_select(traits_by_id[oid])
            for oid in option_ids
            if oid in traits_by_id
        ):
            out["powerBundleMode"] = "subtraitFirst"
    return out


def _extract_class_feature_mechanical_effects(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    fid = str(row.get("internal_id") or "")
    if fid == ARCHER_WARLORD_CLASS_FEATURE_ID:
        return [
            {
                "type": "removeArmorProficiencyPhrases",
                "phrases": ["chainmail", "light shields"],
            },
            {"type": "weaponKeyAbility", "weaponGroup": "bow", "ability": "STR"},
        ]
    return []


def _feat_append_heritage_internal_key(feat_grants: Dict[str, Any], feat_name: str) -> Dict[str, Any]:
    keys = list(feat_grants.get("internalGrantKeys") or [])
    if (feat_name.endswith(" Heritage") or feat_name.endswith(" Bloodline")) and "HERITAGE" not in keys:
        keys.append("HERITAGE")
    return {**feat_grants, "internalGrantKeys": keys}


def _parsed_class_feature_names_for_class(cls: Dict[str, Any]) -> Set[str]:
    """Feature display names listed on a class/hybrid `specific._PARSED_CLASS_FEATURE`."""
    raw = (cls.get("specific") or {}).get("_PARSED_CLASS_FEATURE")
    if not raw or not isinstance(raw, str):
        return set()
    return {n.strip() for n in raw.split(",") if n.strip()}


def _parse_subclass_ids(raw: Any) -> Set[str]:
    """Split compendium `_Subclasses` into full internal ids (avoid substring false positives)."""
    if not raw or not isinstance(raw, str):
        return set()
    return {p.strip() for p in raw.split(",") if p.strip().startswith("ID_")}


def _feature_name_matches_parsed_list(name: str, allowed: Set[str]) -> bool:
    if not name or not allowed:
        return False
    if name in allowed:
        return True
    # e.g. "Archer Warlord Optional Choice" for parsed "Archer Warlord"
    return any(name.startswith(f"{a} ") or name.startswith(a) for a in allowed if a)


def _class_feature_applies_to_support_class(
    cf: Dict[str, Any],
    support_class_id: str,
    support_by_id: Dict[str, Dict[str, Any]],
) -> bool:
    """
    True when a class feature grant belongs on this class (not a sibling subclass).

    Essentials subclasses (e.g. Warpriest ID_FMP_CLASS_705) share a Grants bundle prefix
    with PHB classes (Warlock ID_FMP_CLASS_7); filter by parsed feature list and Class.
    """
    spec = cf.get("specific") or {}
    cf_class = spec.get("Class")
    if cf_class == support_class_id:
        return True
    if support_class_id in _parse_subclass_ids(spec.get("_Subclasses")):
        return True
    cls = support_by_id.get(support_class_id)
    if not cls:
        return False
    name = str(cf.get("name") or "").strip()
    allowed = _parsed_class_feature_names_for_class(cls)
    if _feature_name_matches_parsed_list(name, allowed):
        return True
    parent = (cls.get("specific") or {}).get("_ParentClass")
    if cf_class and parent and cf_class == parent and _feature_name_matches_parsed_list(name, allowed):
        return True
    return False


def _power_selectable_ids_from_class_feature(cf: Dict[str, Any]) -> Set[str]:
    """Power internal_ids the player picks from lists on this class feature (if any)."""
    out: Set[str] = set()
    rules = cf.get("rules") or {}
    for sel in rules.get("select") or []:
        attrs = sel.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        cat = _select_category(attrs)
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
    grants_raw: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    support_by_id: Dict[str, Dict[str, Any]],
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
            if not _class_feature_applies_to_support_class(cf, class_id, support_by_id):
                continue
            bucket |= _granted_power_ids_from_class_feature(cf, class_id)
    return {cid: sorted(ids) for cid, ids in by_class.items() if ids}


def build_granted_class_feature_names_by_support(
    grants_raw: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    support_by_id: Dict[str, Dict[str, Any]],
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
            if not _class_feature_applies_to_support_class(row, support_id, support_by_id):
                continue
            nm = str(row.get("name") or "").strip()
            if nm:
                bucket.add(nm)
    by_name = {
        str(r.get("name") or "").strip(): r for r in features_by_id.values() if r.get("name")
    }

    def sort_key(nm: str) -> tuple:
        row = by_name.get(nm)
        lvl = None
        if row:
            lvl = parse_int_from_text((row.get("specific") or {}).get("Level"))
            if lvl is None:
                m = re.match(r"^Level\s+(\d+)\b", str(row.get("name") or ""), re.I)
                if m:
                    lvl = int(m.group(1))
        return (lvl if lvl is not None else 0, nm.lower())

    return {sid: sorted(names, key=sort_key) for sid, names in out.items() if names}


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


def _power_ids_from_build_row(build: Dict[str, Any]) -> List[str]:
    """Suggested powers on Essentials `Build` rows (specific + rules.suggest)."""
    out: Set[str] = set()
    spec = build.get("specific") or {}
    for pid in _parse_internal_id_list(spec.get("_SUGGESTED_POWERS")):
        if pid.startswith("ID_FMP_POWER"):
            out.add(pid)
    for sug in (build.get("rules") or {}).get("suggest") or []:
        attrs = sug.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        pid = attrs.get("name")
        if isinstance(pid, str) and pid.startswith("ID_FMP_POWER"):
            out.add(pid)
    return sorted(out)


def _class_has_build_select(cls: Dict[str, Any]) -> bool:
    rules = cls.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") == "Build":
            return True
    return False


def build_essentials_class_build_options_by_class(
    classes_raw: List[Dict[str, Any]],
    builds_raw: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Essentials-style class builds from compendium `Build` rows (Battle Cleric, Ardent Paladin, …).
    PHB-style talent picks (Fighter Talents sub-features) stay in `build_class_build_options_by_class`.
    """
    builds_by_name: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in builds_raw:
        name = row.get("name")
        if isinstance(name, str) and name.strip():
            builds_by_name[name.strip()].append(row)

    out: Dict[str, List[Dict[str, Any]]] = {}
    for cls in classes_raw:
        class_id = cls.get("internal_id")
        if not isinstance(class_id, str) or not class_id.startswith("ID_FMP_CLASS_"):
            continue
        if not _class_has_build_select(cls):
            continue
        bo_text = str((cls.get("specific") or {}).get("Build Options") or "").strip()
        if not bo_text:
            continue

        options: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        for opt_name in [p.strip() for p in bo_text.split(",") if p.strip()]:
            candidates = builds_by_name.get(opt_name) or []
            build: Optional[Dict[str, Any]] = None
            for cand in candidates:
                cid = (cand.get("specific") or {}).get("Class")
                if cid == class_id:
                    build = cand
                    break
            if build is None and len(candidates) == 1:
                build = candidates[0]
            if not build:
                continue
            bid = build.get("internal_id")
            if not isinstance(bid, str) or bid in seen:
                continue
            seen.add(bid)
            spec = build.get("specific") or {}
            short = _clean_text(str(spec.get("Key Abilities") or "")) or None
            options.append(
                {
                    "id": bid,
                    "name": build.get("name"),
                    "parentFeatureId": "",
                    "parentFeatureName": "Build Options",
                    "shortDescription": short,
                    "body": build.get("body"),
                    "powerIds": _power_ids_from_build_row(build),
                }
            )
        if options:
            out[class_id] = sorted(options, key=lambda r: str(r.get("name") or "").lower())
    return out


_PHB_BUILD_LABEL_ALIASES: Dict[tuple[str, str], int] = {
    ("two-handed weapon talent", "great weapon fighter"): 100,
    ("one-handed weapon talent", "guardian fighter"): 100,
    ("brawler style", "brawling fighter"): 100,
}


def _normalize_build_label_token(value: str) -> str:
    s = value.lower()
    for suffix in (
        " fighter",
        " warlord",
        " ranger",
        " wizard",
        " rogue",
        " cleric",
        " paladin",
    ):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    return re.sub(r"[^a-z0-9]", "", s)


def _score_phb_feature_to_build_label(feature_name: str, build_label: str) -> int:
    pair = (feature_name.lower(), build_label.lower())
    if pair in _PHB_BUILD_LABEL_ALIASES:
        return _PHB_BUILD_LABEL_ALIASES[pair]
    fn_words = re.findall(r"[a-z]+", feature_name.lower())
    bl_words = re.findall(r"[a-z]+", build_label.lower())
    skip = {
        "the",
        "a",
        "of",
        "style",
        "technique",
        "talent",
        "vigor",
        "training",
        "weapon",
        "handed",
        "one",
        "two",
    }
    score = len(set(fn_words) & set(bl_words) - skip) * 5
    nfn = _normalize_build_label_token(feature_name)
    nbl = _normalize_build_label_token(build_label)
    prefix = 0
    for i in range(min(len(nfn), len(nbl))):
        if nfn[i] == nbl[i]:
            prefix += 1
        else:
            break
    score += prefix * 2
    if nfn in nbl or nbl in nfn:
        score = max(score, min(len(nfn), len(nbl)))
    return score


def enrich_phb_class_build_display_names(
    options_by_class: Dict[str, List[Dict[str, Any]]],
    classes_by_id: Dict[str, Dict[str, Any]],
    *,
    min_score: int = 4,
) -> None:
    """
    PHB talent sub-features use compendium feature names (Arena Training); class text lists
    player-facing build labels (Arena Fighter). Attach `displayName` when we can match confidently.
    """
    for class_id, options in options_by_class.items():
        cls = classes_by_id.get(class_id)
        if not cls:
            continue
        bo_text = str((cls.get("specific") or {}).get("Build Options") or "").strip()
        if not bo_text:
            continue
        labels = [p.strip() for p in bo_text.split(",") if p.strip()]
        if not labels:
            continue
        grant_opts = [
            o
            for o in options
            if o.get("parentFeatureId") and o.get("parentFeatureName") != "Build Options"
        ]
        if not grant_opts:
            continue
        pair_scores: List[tuple[int, str, str]] = []
        for opt in grant_opts:
            fname = str(opt.get("name") or "")
            oid = str(opt.get("id") or "")
            if not fname or not oid:
                continue
            for label in labels:
                pair_scores.append(
                    (_score_phb_feature_to_build_label(fname, label), oid, label)
                )
        pair_scores.sort(key=lambda t: t[0], reverse=True)
        assigned_opts: Set[str] = set()
        assigned_labels: Set[str] = set()
        opt_by_id = {str(o.get("id")): o for o in grant_opts if o.get("id")}
        for score, oid, label in pair_scores:
            if score < min_score or oid in assigned_opts or label in assigned_labels:
                continue
            opt = opt_by_id.get(oid)
            if not opt:
                continue
            opt["displayName"] = label
            assigned_opts.add(oid)
            assigned_labels.add(label)


def merge_class_build_options_by_class(
    _from_grants: Dict[str, List[Dict[str, Any]]],
    from_builds: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Essentials `Build` rows only (PHB feature picks live in `classFeatureChoiceGroupsByClassId`)."""
    return dict(from_builds)


def _level_gated_class_feature_selects(
    feature: Dict[str, Any],
) -> List[Tuple[int, int]]:
    """(min_level, pick_count) rows from `rules.select` type Class Feature."""
    out: List[Tuple[int, int]] = []
    rules = feature.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Class Feature":
            continue
        min_level = parse_int_from_text(attrs.get("Level")) or 1
        pick_count = parse_int_from_text(attrs.get("number")) or 1
        out.append((min_level, pick_count))
    return out


def _supplement_mapped_optional_class_feature_groups(
    class_id: str,
    groups: List[Dict[str, Any]],
    features_by_name: Dict[str, Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    mapped = OPTIONAL_CLASS_FEATURE_NAMES_BY_CLASS_ID.get(class_id)
    if not mapped:
        return groups
    existing_keys = {str(g.get("key") or "") for g in groups}
    out = list(groups)
    for feature_name in mapped:
        feature = features_by_name.get(feature_name)
        if not feature:
            continue
        fid = str(feature.get("internal_id") or "")
        if not fid:
            continue
        feat_name = str(feature.get("name") or fid)
        opt_key = f"classFeatureOptional:{fid}"
        if opt_key not in existing_keys:
            out.append(
                {
                    "key": opt_key,
                    "kind": "classFeature",
                    "parentFeatureId": fid,
                    "parentFeatureName": feat_name,
                    "pickCount": 1,
                    "optional": True,
                    "options": [
                        {
                            "id": "__none__",
                            "name": f"No {feat_name}",
                            "parentFeatureId": fid,
                            "parentFeatureName": feat_name,
                            "shortDescription": None,
                            "body": None,
                            "powerIds": [],
                        },
                        _class_feature_child_option_row(feature, fid, feat_name),
                    ],
                }
            )
            existing_keys.add(opt_key)
        nested = _options_from_class_feature_select(feature, features_by_id)
        if len(nested) < 2:
            continue
        for min_level, pick_count in _level_gated_class_feature_selects(feature):
            pick_key = f"classFeature:{fid}" if min_level <= 1 else f"classFeature:{fid}:{min_level}"
            if pick_key in existing_keys:
                continue
            out.append(
                {
                    "key": pick_key,
                    "kind": "classFeature",
                    "parentFeatureId": fid,
                    "parentFeatureName": feat_name if min_level <= 1 else f"{feat_name} (level {min_level})",
                    "pickCount": pick_count,
                    "minLevel": min_level,
                    "visibleWhen": {"groupKey": opt_key, "optionId": fid},
                    "options": sorted(
                        nested,
                        key=lambda r: str(r.get("name") or "").lower(),
                    ),
                }
            )
            existing_keys.add(pick_key)
    return out


def _select_category(attrs: Dict[str, Any]) -> str:
    """Compendium uses both `Category` and `category` on select attrs."""
    return str(attrs.get("Category") or attrs.get("category") or "").strip()


def _parse_trait_package_names(cls: Dict[str, Any]) -> List[str]:
    raw = str((cls.get("specific") or {}).get("Trait Package") or "").strip()
    if not raw:
        return []
    return [n.strip() for n in raw.split(",") if n.strip()]


def _resolve_trait_package_feature(
    package_name: str,
    features_by_name: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Map Essentials trait package label (Storm Domain, Enchantment School, …) to a class feature row."""
    candidates = [
        package_name,
        f"{package_name} Features and Powers",
        f"{package_name} Features",
        package_name.replace(" School", "") + " Apprentice",
    ]
    if "(Binder)" in package_name:
        candidates.insert(0, package_name.replace(" Pact (Binder)", " Pact Boon (Binder)"))
    if package_name.startswith("Vice of "):
        vice = package_name.replace("Vice of ", "")
        candidates.extend([f"Spirit of Vice ({vice})", f"Spirit of Vice ({vice.title()})"])
    for name in candidates:
        row = features_by_name.get(name)
        if row:
            return row
    return None


def _wilderness_knack_features(
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows = [
        cf
        for cf in features_by_id.values()
        if str(cf.get("internal_id") or "").startswith("ID_WOG_SHARED_CLASS_FEATURE_KNACK_")
    ]
    return sorted(rows, key=lambda r: str(r.get("name") or "").lower())


def _category_references_parent(cat: str, parent_id: str) -> bool:
    if not cat or not parent_id:
        return False
    return parent_id in {t.strip() for t in cat.split(",") if t.strip()}


def _child_features_for_parent_category(
    parent_id: str,
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Features whose compendium `category` field lists `parent_id` (Apprentice Mage schools, Spirit of Vice, …)."""
    children: List[Dict[str, Any]] = []
    for cf in features_by_id.values():
        cat = str(cf.get("category") or "").strip()
        if _category_references_parent(cat, parent_id):
            children.append(cf)
    return sorted(children, key=lambda r: str(r.get("name") or "").lower())


def _domain_package_names_from_grants(features_by_name: Dict[str, Dict[str, Any]]) -> List[str]:
    """All warpriest domain labels from level-3 domain encounter grant `requires` attrs."""
    feat = features_by_name.get("Level 3 Domain Encounter Power")
    if not feat:
        return []
    names: List[str] = []
    for gr in (feat.get("rules") or {}).get("grant") or []:
        req = (gr.get("attrs") or {}).get("requires")
        if req:
            label = str(req).strip()
            if label and label not in names:
                names.append(label)
    return names


def _trait_package_names_for_class(
    cls: Dict[str, Any],
    parent: Dict[str, Any],
    features_by_name: Dict[str, Dict[str, Any]],
) -> List[str]:
    names = _parse_trait_package_names(cls)
    if str(parent.get("name") or "") == "Domain Features":
        for label in _domain_package_names_from_grants(features_by_name):
            if label not in names:
                names.append(label)
    return names


HUNTER_SCOUT_ASPECT_L7_POWER_NAMES: Tuple[str, ...] = (
    "Aspect of the Charging Ram",
    "Aspect of the Hungry Shark",
    "Aspect of the Soaring Hawk",
)


def _supplement_level_gated_aspect_power_ids(
    parent: Dict[str, Any],
    powers_by_name: Optional[Dict[str, Dict[str, Any]]],
) -> List[str]:
    name = str(parent.get("name") or "")
    if "Level 7 Aspect of the Wild" not in name and "Level 17 Aspect of the Wild" not in name:
        return []
    if not powers_by_name:
        return []
    ids: List[str] = []
    for pname in HUNTER_SCOUT_ASPECT_L7_POWER_NAMES:
        row = powers_by_name.get(pname)
        if row and row.get("internal_id"):
            ids.append(str(row["internal_id"]))
    return ids


def _supplement_class_feature_select_options(
    parent: Dict[str, Any],
    cls: Dict[str, Any],
    options: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    features_by_name: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Fill Essentials self-referential or incomplete compendium select lists."""
    parent_id = str(parent.get("internal_id") or "")
    parent_name = str(parent.get("name") or parent_id)
    feat_name = str(parent.get("name") or "")
    if feat_name == "Level 4 Apprentice Mage":
        return sorted(
            _apprentice_mage_school_option_rows(parent_id, parent_name, features_by_id),
            key=lambda r: str(r.get("name") or "").lower(),
        )

    filtered = [o for o in options if str(o.get("id") or "") != parent_id]
    if len(filtered) >= 2:
        return filtered

    out = list(filtered)
    seen = {str(o.get("id") or "") for o in out}

    def add_child(child: Optional[Dict[str, Any]]) -> None:
        if not child:
            return
        cid = str(child.get("internal_id") or "")
        if not cid or cid in seen:
            return
        out.append(_class_feature_child_option_row(child, parent_id, parent_name))
        seen.add(cid)

    for child in _child_features_for_parent_category(parent_id, features_by_id):
        add_child(child)
    if len(out) >= 2:
        return out

    if feat_name == "Archery Style":
        for name in ("Bow Hunter", "Crossbow Hunter"):
            add_child(features_by_name.get(name))
    elif "Wilderness Knacks" in feat_name:
        for child in _wilderness_knack_features(features_by_id):
            add_child(child)
    elif feat_name in (
        "Level 1 Apprentice Mage",
        "Level 4 Apprentice Mage",
        "Domain Features",
        "Spirit of Vice",
        "Virtue Choice",
        "Season Choice",
        "Pact Boon (Binder)",
        "Pact Boon",
    ):
        if feat_name in ("Level 1 Apprentice Mage", "Level 4 Apprentice Mage"):
            for row in _apprentice_mage_school_option_rows(parent_id, parent_name, features_by_id):
                cid = str(row.get("id") or "")
                if cid and cid not in seen:
                    out.append(row)
                    seen.add(cid)
        for pkg in _trait_package_names_for_class(cls, parent, features_by_name):
            add_child(_resolve_trait_package_feature(pkg, features_by_name))

    return out


def _options_from_trait_package_select(
    parent: Dict[str, Any],
    cls: Dict[str, Any],
    features_by_name: Dict[str, Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    parent_id = str(parent.get("internal_id") or "")
    parent_name = str(parent.get("name") or parent_id)
    options: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for child in _child_features_for_parent_category(parent_id, features_by_id):
        cid = str(child.get("internal_id") or "")
        if not cid or cid in seen:
            continue
        options.append(_class_feature_child_option_row(child, parent_id, parent_name))
        seen.add(cid)
    for pkg in _trait_package_names_for_class(cls, parent, features_by_name):
        child = _resolve_trait_package_feature(pkg, features_by_name)
        if not child:
            continue
        cid = str(child.get("internal_id") or "")
        if not cid or cid in seen:
            continue
        options.append(_class_feature_child_option_row(child, parent_id, parent_name))
        seen.add(cid)
    return options


def _class_feature_has_select(
    feature: Dict[str, Any], select_type: str
) -> tuple[bool, int]:
    rules = feature.get("rules") or {}
    picks: List[int] = []
    requires_keys: List[str] = []
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != select_type:
            continue
        n = parse_int_from_text(attrs.get("number"))
        picks.append(n if n is not None and n > 0 else 1)
        requires_keys.append(str(attrs.get("requires") or "").strip())
    if not picks:
        return False, 0
    # Mutually exclusive branches (e.g. standard mage schools vs. renegade) — one pick total.
    if select_type == "Class Feature" and len(picks) > 1 and len(set(requires_keys)) > 1:
        return True, max(picks)
    return True, sum(picks)


MAGE_APPRENTICE_SCHOOL_PARENT_ID = "ID_FMP_CLASS_FEATURE_2867"


def _class_feature_select_requires_default_branch(attrs: Dict[str, Any]) -> bool:
    """Include only default compendium branches (empty or negated `requires`)."""
    requires = str(attrs.get("requires") or "").strip()
    return not requires or requires.startswith("!")


def _apprentice_mage_school_option_rows(
    parent_id: str,
    parent_name: str,
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Enchantment / Evocation / Illusion / Pyromancy apprentices under Level 1 Apprentice Mage."""
    rows: List[Dict[str, Any]] = []
    for child in _child_features_for_parent_category(MAGE_APPRENTICE_SCHOOL_PARENT_ID, features_by_id):
        rows.append(_class_feature_child_option_row(child, parent_id, parent_name))
    return rows


def _options_from_select_category_feature_id(
    tid: str,
    parent_id: str,
    parent_name: str,
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Expand a Category class-feature id to leaf picks (schools), not container features."""
    child = features_by_id.get(tid)
    if not child:
        return []
    school_children = _child_features_for_parent_category(tid, features_by_id)
    if school_children:
        return [
            _class_feature_child_option_row(sc, parent_id, parent_name) for sc in school_children
        ]
    return [_class_feature_child_option_row(child, parent_id, parent_name)]


def _class_feature_child_option_row(
    child: Dict[str, Any],
    parent_id: str,
    parent_name: str,
) -> Dict[str, Any]:
    cs = child.get("specific") or {}
    return {
        "id": child.get("internal_id"),
        "name": child.get("name"),
        "parentFeatureId": parent_id,
        "parentFeatureName": parent_name,
        "shortDescription": cs.get("Short Description"),
        "body": child.get("body"),
        "powerIds": _granted_power_ids_from_feature_any(child),
    }


def _options_from_class_feature_select(
    parent: Dict[str, Any],
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Resolve `select` type Class Feature options from Category ids or sub-feature list."""
    parent_id = str(parent.get("internal_id") or "")
    parent_name = str(parent.get("name") or parent_id)
    spec = parent.get("specific") or {}
    sub_ids = _parse_internal_id_list(spec.get("_PARSED_SUB_FEATURES"))
    if sub_ids:
        options: List[Dict[str, Any]] = []
        for sid in sub_ids:
            child = features_by_id.get(sid)
            if child:
                options.append(_class_feature_child_option_row(child, parent_id, parent_name))
        return options
    options: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    rules = parent.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Class Feature":
            continue
        if not _class_feature_select_requires_default_branch(attrs):
            continue
        cat = _select_category(attrs)
        for token in cat.split("|"):
            tid = token.strip()
            if not tid.startswith("ID_") or tid == parent_id:
                continue
            if re.match(r"^ID_(?:FMP|DBB)_CLASS_\d+$", tid):
                continue
            for row in _options_from_select_category_feature_id(
                tid, parent_id, parent_name, features_by_id
            ):
                cid = str(row.get("id") or "")
                if not cid or cid in seen_ids:
                    continue
                seen_ids.add(cid)
                options.append(row)
    return options


WIZARD_MAGE_CANTRIP_POWER_NAMES: Tuple[str, ...] = (
    "Chameleon's Mask",
    "Disrupt Undead",
    "Ghost Sound",
    "Light",
    "Mage Hand",
    "Prestidigitation",
    "Spook",
    "Suggestion",
    "Water Stride",
    "Whispering Wind",
)

MAGE_CANTRIPS_FEATURE_IDS: frozenset = frozenset(
    {"ID_FMP_CLASS_FEATURE_2870", "ID_FMP_CLASS_FEATURE_130"}
)

# Optional class features not listed on `_PARSED_CLASS_FEATURE` (HotF Signs of Influence on bard).
OPTIONAL_CLASS_FEATURE_NAMES_BY_CLASS_ID: Dict[str, List[str]] = {
    "ID_FMP_CLASS_104": ["Signs of Influence"],
}


def _wizard_mage_cantrip_power_ids(powers_by_name: Dict[str, Dict[str, Any]]) -> Set[str]:
    out: Set[str] = set()
    for name in WIZARD_MAGE_CANTRIP_POWER_NAMES:
        row = powers_by_name.get(name)
        if row and row.get("internal_id"):
            out.add(str(row["internal_id"]))
    return out


def _power_ids_from_class_feature_row(
    cf: Dict[str, Any],
    *,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Set[str]:
    """Power internal_ids listed on a class feature (`specific.Powers` / `_DisplayPowers`)."""
    spec = cf.get("specific") or {}
    out: Set[str] = set()
    for field in ("Powers", "_DisplayPowers"):
        for pid in _parse_internal_id_list(spec.get(field)):
            if pid.startswith("ID_FMP_POWER") or pid.startswith("ID_WOG_"):
                out.add(pid)
    for sid in _parse_internal_id_list(spec.get("_PARSED_SUB_FEATURES")):
        if sid.startswith("ID_FMP_POWER") or (sid.startswith("ID_WOG_") and "POWER" in sid.upper()):
            out.add(sid)
    cf_id = str(cf.get("internal_id") or "")
    if powers_by_name and (
        cf_id in MAGE_CANTRIPS_FEATURE_IDS or str(cf.get("name") or "") in ("Mage Cantrips", "Arcanist Cantrips")
    ):
        out |= _wizard_mage_cantrip_power_ids(powers_by_name)
    return out


def _feat_granted_power_ids_excluded_from_class_feature_picks(
    feats_raw: List[Dict[str, Any]],
) -> Set[str]:
    """
    Powers granted by feats that do not count as Channel Divinity (e.g. Divine Fate).
    Omit from class feature power pick lists such as Channel Divinity.
    """
    out: Set[str] = set()
    for feat in feats_raw:
        rules = feat.get("rules") or {}
        counts_as_cd = False
        for gr in rules.get("grant") or []:
            attrs = gr.get("attrs") or {}
            if attrs.get("type") != "CountsAsFeature":
                continue
            name = str(attrs.get("name") or "")
            if "CHANNEL_DIVINITY" in name:
                counts_as_cd = True
                break
        if counts_as_cd:
            continue
        for gr in rules.get("grant") or []:
            attrs = gr.get("attrs") or {}
            if attrs.get("type") != "Power":
                continue
            pid = attrs.get("name")
            if isinstance(pid, str) and pid.startswith("ID_FMP_POWER"):
                out.add(pid)
        for pid in feat.get("grantedPowerIds") or []:
            if isinstance(pid, str) and pid.startswith("ID_FMP_POWER"):
                out.add(pid)
    return out


def _paragon_path_class_feature_power_ids(
    paragon_paths_raw: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
) -> Set[str]:
    """Powers tied to paragon-path class features (not level-1 class picks like Channel Divinity)."""
    paragon_cf_ids: Set[str] = set()
    for path in paragon_paths_raw:
        sp = path.get("specific") or {}
        for cf_id in _parse_internal_id_list(sp.get("Class Features")):
            paragon_cf_ids.add(cf_id)
    out: Set[str] = set()
    for cf_id in paragon_cf_ids:
        cf = features_by_id.get(cf_id)
        if cf:
            out |= _power_ids_from_class_feature_row(cf)
    return out


def _build_powers_by_class_id(
    powers_raw: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for power in powers_raw:
        spec = power.get("specific") or {}
        cid = spec.get("Class")
        if isinstance(cid, str) and cid.startswith("ID_FMP_CLASS_"):
            out[cid].append(power)
    return dict(out)


def _parent_class_id_from_class(cls: Dict[str, Any]) -> Optional[str]:
    raw = (cls.get("specific") or {}).get("_ParentClass")
    if isinstance(raw, str) and raw.startswith("ID_FMP_CLASS_"):
        return raw
    return None


def _power_owner_class_ids_for_pool(class_id: str, cls: Dict[str, Any]) -> List[str]:
    ids = [class_id]
    parent = _parent_class_id_from_class(cls)
    if parent and parent not in ids:
        ids.append(parent)
    return ids


def _usage_and_level_from_explicit_class_category(
    category: str,
) -> Optional[tuple[str, str, int]]:
    """Parse `ID_FMP_CLASS_104,daily,1` → (ownerClassId, usage, level)."""
    parts = [p.strip() for p in category.split(",")]
    if len(parts) < 3:
        return None
    owner_id = parts[0]
    if not owner_id.startswith("ID_FMP_CLASS_") or "_CLASS_FEATURE_" in owner_id:
        return None
    usage_token = parts[1].lower()
    level = parse_int_from_text(parts[2])
    if level is None or level < 1:
        return None
    if usage_token in ("encounter", "daily", "utility", "at-will", "at_will", "atwill"):
        usage = "at-will" if usage_token.startswith("at") else usage_token
        return (owner_id, usage, level)
    upper = parts[1].upper()
    if "ENCOUNTER" in upper:
        return (owner_id, "encounter", level)
    if "DAILY" in upper:
        return (owner_id, "daily", level)
    if "UTILITY" in upper:
        return (owner_id, "utility", level)
    return None


def _power_ids_for_explicit_class_usage_pool(
    owner_class_id: str,
    usage: str,
    level: int,
    powers_by_class_id: Dict[str, List[Dict[str, Any]]],
    *,
    exclude_power_ids: Optional[Set[str]] = None,
    own_select: Optional[Set[str]] = None,
) -> List[str]:
    ids: Set[str] = set()
    for power in powers_by_class_id.get(owner_class_id, []):
        if _power_row_matches_usage_pool(power, usage, level):
            iid = power.get("internal_id")
            if isinstance(iid, str) and (
                iid.startswith("ID_FMP_POWER") or iid.startswith("ID_WOG_")
            ):
                ids.add(iid)
    filtered = sorted(ids)
    if exclude_power_ids:
        filtered = [
            pid
            for pid in filtered
            if pid not in exclude_power_ids or (own_select and pid in own_select)
        ]
    return filtered


def _usage_and_level_from_dynamic_class_category(
    category: str,
) -> Optional[tuple[str, int]]:
    """Parse `$$CLASS,<usage-or-internal>,<level>` → (usage, level)."""
    cat = category.strip()
    if not cat.startswith("$$"):
        return None
    parts = [p.strip() for p in cat[2:].split(",")]
    if len(parts) < 2 or parts[0].lower() != "class":
        return None
    if len(parts) == 2:
        lower = parts[1].lower()
        if lower in ("at-will", "at_will", "atwill"):
            return ("at-will", 1)
        return None
    if len(parts) < 3:
        return None
    token = parts[1]
    level = parse_int_from_text(parts[2])
    if level is None or level < 1:
        return None
    lower = token.lower()
    if lower in ("at-will", "at_will", "atwill"):
        return ("at-will", level)
    if lower in ("encounter", "daily", "utility"):
        return (lower, level)
    upper = token.upper()
    if "ENCOUNTER" in upper:
        return ("encounter", level)
    if "DAILY" in upper:
        return ("daily", level)
    if "UTILITY" in upper:
        return ("utility", level)
    if "AT_WILL" in upper or "AT-WILL" in upper:
        return ("at-will", level)
    return None


def _power_row_matches_usage_pool(
    power: Dict[str, Any],
    usage: str,
    level: int,
) -> bool:
    spec = power.get("specific") or {}
    lv = parse_int_from_text(spec.get("Level"))
    if lv != level:
        return False
    u = str(spec.get("Power Usage") or "").lower()
    pt = str(spec.get("Power Type") or "").lower()
    if usage == "utility":
        return "utility" in pt
    if usage == "at-will":
        return "at-will" in u and "attack" in pt
    if usage == "encounter":
        return "encounter" in u and "attack" in pt
    if usage == "daily":
        return "daily" in u and "attack" in pt
    return False


def _power_ids_for_dynamic_class_category(
    category: str,
    class_id: str,
    cls: Dict[str, Any],
    powers_by_class_id: Dict[str, List[Dict[str, Any]]],
    *,
    exclude_power_ids: Optional[Set[str]] = None,
    own_select: Optional[Set[str]] = None,
) -> List[str]:
    parsed = _usage_and_level_from_dynamic_class_category(category)
    if not parsed:
        return []
    usage, level = parsed
    ids: Set[str] = set()
    for owner_id in _power_owner_class_ids_for_pool(class_id, cls):
        for power in powers_by_class_id.get(owner_id, []):
            if _power_row_matches_usage_pool(power, usage, level):
                iid = power.get("internal_id")
                if isinstance(iid, str) and iid.startswith("ID_FMP_POWER"):
                    ids.add(iid)
    filtered = sorted(ids)
    if exclude_power_ids:
        filtered = [
            pid
            for pid in filtered
            if pid not in exclude_power_ids or (own_select and pid in own_select)
        ]
    return filtered


def _is_class_feature_category_ref(cat: str) -> bool:
    if cat.startswith("ID_WOG_") and "CLASS_FEATURE" in cat.upper():
        return True
    return cat.startswith("ID_") and "_CLASS_FEATURE_" in cat


def _power_select_category_ids_from_class_feature(
    feature: Dict[str, Any],
    features_by_id: Dict[str, Dict[str, Any]],
    *,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Set[str]:
    """Power internal_ids offered by this feature's power picks (select + row + supplements)."""
    out: Set[str] = set()
    out |= _power_ids_from_class_feature_row(feature, powers_by_name=powers_by_name)
    rules = feature.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        cat = _select_category(attrs)
        if _is_class_feature_category_ref(cat):
            ref = features_by_id.get(cat)
            if ref:
                out |= _power_ids_from_class_feature_row(ref, powers_by_name=powers_by_name)
        elif cat.startswith("ID_FMP_POWER"):
            for part in cat.split("|"):
                pid = part.strip()
                if pid.startswith("ID_FMP_POWER"):
                    out.add(pid)
    return out


def _append_nested_child_power_choice_groups(
    class_id: str,
    cls: Dict[str, Any],
    groups: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    *,
    exclude_power_ids: Optional[Set[str]] = None,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    powers_by_class_id: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> List[Dict[str, Any]]:
    """
    When a class-feature pick option (e.g. Infernal Pact) has its own Power `select`, expose a
    dependent power choice group visible after that option is selected.
    """
    existing_keys = {str(g.get("key") or "") for g in groups}
    out = list(groups)
    for g in groups:
        if g.get("kind") != "classFeature":
            continue
        parent_key = str(g.get("key") or "")
        for opt in g.get("options") or []:
            opt_id = str(opt.get("id") or "")
            if not opt_id.startswith("ID_"):
                continue
            child = features_by_id.get(opt_id)
            if not child:
                continue
            has_pow, pick_n = _class_feature_has_select(child, "Power")
            if not has_pow:
                continue
            pick_key = f"classPower:{opt_id}"
            if pick_key in existing_keys:
                continue
            power_ids = _power_ids_from_class_feature_power_select(
                child,
                features_by_id,
                class_id=class_id,
                cls=cls,
                exclude_power_ids=exclude_power_ids,
                powers_by_name=powers_by_name,
                powers_by_class_id=powers_by_class_id,
            )
            if not power_ids:
                continue
            if len(power_ids) == 1 and pick_n <= 1:
                continue
            child_name = str(child.get("name") or opt_id)
            out.append(
                {
                    "key": pick_key,
                    "kind": "power",
                    "parentFeatureId": opt_id,
                    "parentFeatureName": child_name,
                    "pickCount": pick_n or 1,
                    "powerIds": power_ids,
                    "options": [],
                    "visibleWhen": {"groupKey": parent_key, "optionId": opt_id},
                }
            )
            existing_keys.add(pick_key)
    return out


def _l1_nested_class_feature_select_options(
    child: Dict[str, Any],
    features_by_id: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], int, str]:
    """
    Dependent class-feature options on a selected option (e.g. Air Elementalist → Howling Zephyr).
    Skips features with `_PARSED_SUB_FEATURES` (indexed as their own parent groups).
    """
    spec = child.get("specific") or {}
    if _parse_internal_id_list(spec.get("_PARSED_SUB_FEATURES")):
        return [], 1, ""
    parent_id = str(child.get("internal_id") or "")
    parent_name = str(child.get("name") or parent_id)
    options: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    pick_n = 1
    pick_label = parent_name
    rules = child.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Class Feature":
            continue
        if not _class_feature_select_requires_default_branch(attrs):
            continue
        level = parse_int_from_text(attrs.get("Level")) or 1
        if level > 1:
            continue
        pick_n = max(pick_n, parse_int_from_text(attrs.get("number")) or 1)
        name = str(attrs.get("name") or "").strip()
        if name:
            pick_label = name
        cat = _select_category(attrs)
        for token in cat.split("|"):
            tid = token.strip()
            if not tid.startswith("ID_") or tid == parent_id:
                continue
            if re.match(r"^ID_(?:FMP|DBB)_CLASS_\d+$", tid):
                continue
            for row in _options_from_select_category_feature_id(
                tid, parent_id, parent_name, features_by_id
            ):
                cid = str(row.get("id") or "")
                if not cid or cid in seen_ids:
                    continue
                seen_ids.add(cid)
                options.append(row)
    return options, pick_n, pick_label


def _append_nested_child_class_feature_choice_groups(
    groups: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    When a class-feature pick option (e.g. Air Elementalist) has its own Class Feature `select`,
    expose a dependent pick visible after that option is selected.
    """
    existing_keys = {str(g.get("key") or "") for g in groups}
    out = list(groups)
    for g in groups:
        if g.get("kind") != "classFeature":
            continue
        parent_key = str(g.get("key") or "")
        for opt in g.get("options") or []:
            opt_id = str(opt.get("id") or "")
            if not opt_id.startswith("ID_"):
                continue
            child = features_by_id.get(opt_id)
            if not child:
                continue
            pick_key = f"classFeature:{opt_id}"
            if pick_key in existing_keys:
                continue
            nested_options, pick_n, pick_label = _l1_nested_class_feature_select_options(
                child, features_by_id
            )
            if len(nested_options) < 2:
                continue
            out.append(
                {
                    "key": pick_key,
                    "kind": "classFeature",
                    "parentFeatureId": opt_id,
                    "parentFeatureName": pick_label,
                    "pickCount": pick_n or 1,
                    "options": sorted(
                        nested_options,
                        key=lambda r: str(r.get("name") or "").lower(),
                    ),
                    "visibleWhen": {"groupKey": parent_key, "optionId": opt_id},
                }
            )
            existing_keys.add(pick_key)
    return out


def _append_ungranted_power_choice_groups(
    class_id: str,
    cls: Dict[str, Any],
    ungranted: List[Dict[str, Any]],
    groups: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    *,
    exclude_power_ids: Optional[Set[str]] = None,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    powers_by_class_id: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> List[Dict[str, Any]]:
    """Level-1 parsed features with Power select that are not in compendium Grants (Hexblade, Skald, …)."""
    indexed_parents = {
        str(g.get("parentFeatureId") or "")
        for g in groups
        if g.get("kind") == "power"
    }
    for feat in ungranted:
        ps = feat.get("specific") or {}
        level = parse_int_from_text(ps.get("Level"))
        if level not in (None, 1):
            continue
        fid = str(feat.get("internal_id") or "")
        if not fid or fid in indexed_parents:
            continue
        has_pow, pick_pow = _class_feature_has_select(feat, "Power")
        if not has_pow or pick_pow <= 0:
            continue
        parent_name = str(feat.get("name") or fid)
        power_pools = _class_power_select_pools_for_class(
            feat,
            class_id,
            cls,
            features_by_id,
            exclude_power_ids=exclude_power_ids,
            powers_by_name=powers_by_name,
            powers_by_class_id=powers_by_class_id,
        )
        if power_pools:
            if len(power_pools) == 1:
                groups.append(
                    {
                        "key": f"classPower:{fid}",
                        "kind": "power",
                        "parentFeatureId": fid,
                        "parentFeatureName": parent_name,
                        "pickCount": pick_pow,
                        "powerIds": power_pools[0],
                        "options": [],
                    }
                )
            else:
                rules = feat.get("rules") or {}
                selects = [
                    (item.get("attrs") or {})
                    for item in (rules.get("select") or [])
                    if (item.get("attrs") or {}).get("type") == "Power"
                ]
                for pool_index, pool_ids in enumerate(power_pools):
                    attrs = selects[pool_index] if pool_index < len(selects) else {}
                    pool_pick = pick_pow
                    if attrs.get("spellbook"):
                        pool_pick = 2
                    min_level = parse_int_from_text(attrs.get("Level")) or 1
                    groups.append(
                        {
                            "key": f"classPower:{fid}:{pool_index}",
                            "kind": "power",
                            "parentFeatureId": fid,
                            "parentFeatureName": parent_name,
                            "pickCount": pool_pick,
                            "minLevel": min_level,
                            "powerIds": pool_ids,
                            "options": [],
                        }
                    )
            indexed_parents.add(fid)
            continue
        power_ids = _power_ids_from_class_feature_power_select(
            feat,
            features_by_id,
            class_id=class_id,
            cls=cls,
            exclude_power_ids=exclude_power_ids,
            powers_by_name=powers_by_name,
            powers_by_class_id=powers_by_class_id,
        )
        if power_ids:
            groups.append(
                {
                    "key": f"classPower:{fid}",
                    "kind": "power",
                    "parentFeatureId": fid,
                    "parentFeatureName": parent_name,
                    "pickCount": pick_pow,
                    "powerIds": power_ids,
                    "options": [],
                }
            )
            indexed_parents.add(fid)
    return groups


def _class_power_select_pools_for_class(
    feature: Dict[str, Any],
    class_id: str,
    cls: Dict[str, Any],
    features_by_id: Dict[str, Dict[str, Any]],
    *,
    exclude_power_ids: Optional[Set[str]] = None,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    powers_by_class_id: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> List[List[str]]:
    """
    Per-class power select pools from `rules.select` (e.g. cleric Channel Divinity: two pick-1 lists).
    Only includes entries whose `requires` matches `class_id` when present.
    """
    pools: List[List[str]] = []
    own_select = _power_select_category_ids_from_class_feature(
        feature, features_by_id, powers_by_name=powers_by_name
    )
    rules = feature.get("rules") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        req = attrs.get("requires")
        if req and req != class_id:
            continue
        cat = _select_category(attrs)
        pool: Set[str] = set()
        if _is_class_feature_category_ref(cat):
            ref = features_by_id.get(cat)
            if ref:
                pool |= _power_ids_from_class_feature_row(ref, powers_by_name=powers_by_name)
        elif cat.startswith("ID_FMP_POWER"):
            for part in cat.split("|"):
                pid = part.strip()
                if pid.startswith("ID_FMP_POWER"):
                    pool.add(pid)
        elif powers_by_class_id is not None:
            parsed_explicit = _usage_and_level_from_explicit_class_category(cat)
            if parsed_explicit:
                owner_id, usage, level = parsed_explicit
                pool |= set(
                    _power_ids_for_explicit_class_usage_pool(
                        owner_id,
                        usage,
                        level,
                        powers_by_class_id,
                        exclude_power_ids=exclude_power_ids,
                        own_select=own_select,
                    )
                )
            elif cat.startswith("$$"):
                pool |= set(
                    _power_ids_for_dynamic_class_category(
                        cat,
                        class_id,
                        cls,
                        powers_by_class_id,
                        exclude_power_ids=exclude_power_ids,
                        own_select=own_select,
                    )
                )
        if pool:
            filtered = sorted(pool)
            if exclude_power_ids:
                filtered = [
                    pid
                    for pid in filtered
                    if pid not in exclude_power_ids or pid in own_select
                ]
            if filtered:
                pools.append(filtered)
    return pools


def _power_ids_from_class_feature_power_select(
    feature: Dict[str, Any],
    features_by_id: Dict[str, Dict[str, Any]],
    *,
    class_id: Optional[str] = None,
    cls: Optional[Dict[str, Any]] = None,
    exclude_power_ids: Optional[Set[str]] = None,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    powers_by_class_id: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> List[str]:
    rules = feature.get("rules") or {}
    ids: Set[str] = set()
    own_select = _power_select_category_ids_from_class_feature(
        feature, features_by_id, powers_by_name=powers_by_name
    )
    spec = feature.get("specific") or {}
    for item in rules.get("select") or []:
        attrs = item.get("attrs") or {}
        if attrs.get("type") != "Power":
            continue
        cat = _select_category(attrs)
        if _is_class_feature_category_ref(cat):
            ref = features_by_id.get(cat)
            if ref:
                ids |= _power_ids_from_class_feature_row(ref, powers_by_name=powers_by_name)
        elif cat.startswith("ID_FMP_POWER"):
            for part in cat.split("|"):
                pid = part.strip()
                if pid.startswith("ID_FMP_POWER"):
                    ids.add(pid)
        elif powers_by_class_id is not None:
            parsed_explicit = _usage_and_level_from_explicit_class_category(cat)
            if parsed_explicit:
                owner_id, usage, level = parsed_explicit
                ids |= set(
                    _power_ids_for_explicit_class_usage_pool(
                        owner_id,
                        usage,
                        level,
                        powers_by_class_id,
                        exclude_power_ids=exclude_power_ids,
                        own_select=own_select,
                    )
                )
            elif (
                cat.startswith("$$")
                and class_id
                and cls is not None
            ):
                ids |= set(
                    _power_ids_for_dynamic_class_category(
                        cat,
                        class_id,
                        cls,
                        powers_by_class_id,
                        exclude_power_ids=exclude_power_ids,
                        own_select=own_select,
                    )
                )
    for pid in _parse_internal_id_list(spec.get("Powers")):
        if pid.startswith("ID_FMP_POWER") or pid.startswith("ID_WOG_"):
            ids.add(pid)
    if exclude_power_ids:
        ids -= exclude_power_ids - own_select
    return sorted(ids)


def _granted_level1_class_feature_ids(
    grants_raw: List[Dict[str, Any]],
    class_id: str,
    features_by_id: Dict[str, Dict[str, Any]],
    support_by_id: Dict[str, Dict[str, Any]],
) -> Set[str]:
    granted: Set[str] = set()
    for g in grants_raw:
        sp = g.get("specific") or {}
        if sp.get("_SupportsID") != class_id:
            continue
        for gr in (g.get("rules") or {}).get("grant") or []:
            attrs = gr.get("attrs") or {}
            if attrs.get("type") != "Class Feature":
                continue
            parent_id = attrs.get("name")
            if not isinstance(parent_id, str):
                continue
            parent = features_by_id.get(parent_id)
            if not parent:
                continue
            if not _class_feature_applies_to_support_class(parent, class_id, support_by_id):
                continue
            granted.add(parent_id)
            ps = parent.get("specific") or {}
            for sid in _parse_internal_id_list(ps.get("_PARSED_SUB_FEATURES")):
                granted.add(sid)
    return granted


def _append_missing_trait_package_parent_groups(
    class_id: str,
    cls: Dict[str, Any],
    groups: List[Dict[str, Any]],
    features_by_name: Dict[str, Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    classes_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Trait-package picks whose parent feature is not listed in grants/parsed features (e.g. Season Choice)."""
    if not _parse_trait_package_names(cls):
        return groups
    existing_parents = {str(g.get("parentFeatureName") or "") for g in groups}
    for parent_name in ("Season Choice", "Virtue Choice"):
        if parent_name in existing_parents:
            continue
        parent = features_by_name.get(parent_name)
        if not parent:
            continue
        tp = _parse_trait_package_names(cls)
        applies = _class_feature_applies_to_support_class(parent, class_id, classes_by_id)
        if not applies:
            if parent_name == "Season Choice" and not any("Druid of" in t for t in tp):
                continue
            if parent_name == "Virtue Choice" and not any("Virtue of" in t for t in tp):
                continue
        parent_id = str(parent.get("internal_id") or "")
        if not parent_id:
            continue
        opts = _options_from_trait_package_select(parent, cls, features_by_name, features_by_id)
        if len(opts) < 2:
            opts = _supplement_class_feature_select_options(
                parent, cls, opts, features_by_id, features_by_name
            )
        if len(opts) < 2:
            continue
        _, pick_n = _class_feature_has_select(parent, "Trait Package")
        groups.append(
            {
                "key": f"classFeature:{parent_id}",
                "kind": "classFeature",
                "parentFeatureId": parent_id,
                "parentFeatureName": parent_name,
                "pickCount": pick_n or 1,
                "options": sorted(opts, key=lambda r: str(r.get("name") or "").lower()),
            }
        )
        existing_parents.add(parent_name)
    return groups


def build_class_feature_choice_groups_by_class(
    grants_raw: List[Dict[str, Any]],
    features_by_id: Dict[str, Dict[str, Any]],
    classes_by_id: Dict[str, Dict[str, Any]],
    paragon_paths_raw: Optional[List[Dict[str, Any]]] = None,
    feats_raw: Optional[List[Dict[str, Any]]] = None,
    powers_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    powers_by_class_id: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Level-1 class feature choice groups (Rogue Tactics, Fighter Talents, Implement Mastery, cantrips, …).
    Separate from Essentials `Build` rows in `classBuildOptionsByClassId`.
    """
    features_by_name: Dict[str, Dict[str, Any]] = {}
    for row in features_by_id.values():
        name = str(row.get("name") or "").strip()
        if name:
            features_by_name[name] = row

    out: Dict[str, List[Dict[str, Any]]] = {}
    paragon_feature_powers = _paragon_path_class_feature_power_ids(
        paragon_paths_raw or [], features_by_id
    )
    feat_only_class_picks = _feat_granted_power_ids_excluded_from_class_feature_picks(
        feats_raw or []
    )
    class_feature_pick_exclusions = paragon_feature_powers | feat_only_class_picks

    for class_id, cls in classes_by_id.items():
        if not class_id.startswith("ID_FMP_CLASS_"):
            continue
        groups: List[Dict[str, Any]] = []
        granted_l1 = _granted_level1_class_feature_ids(
            grants_raw, class_id, features_by_id, classes_by_id
        )

        for g in grants_raw:
            sp = g.get("specific") or {}
            if sp.get("_SupportsID") != class_id:
                continue
            for gr in (g.get("rules") or {}).get("grant") or []:
                attrs = gr.get("attrs") or {}
                if attrs.get("type") != "Class Feature":
                    continue
                parent_id = attrs.get("name")
                if not isinstance(parent_id, str):
                    continue
                parent = features_by_id.get(parent_id)
                if not parent:
                    continue
                if not _class_feature_applies_to_support_class(parent, class_id, classes_by_id):
                    continue
                ps = parent.get("specific") or {}
                level = parse_int_from_text(ps.get("Level"))
                if level not in (None, 1):
                    continue
                parent_name = str(parent.get("name") or parent_id)

                has_cf, pick_n = _class_feature_has_select(parent, "Class Feature")
                options = (
                    _supplement_class_feature_select_options(
                        parent,
                        cls,
                        _options_from_class_feature_select(parent, features_by_id),
                        features_by_id,
                        features_by_name,
                    )
                    if has_cf
                    else []
                )
                if len(options) >= 2:
                    groups.append(
                        {
                            "key": f"classFeature:{parent_id}",
                            "kind": "classFeature",
                            "parentFeatureId": parent_id,
                            "parentFeatureName": parent_name,
                            "pickCount": pick_n or 1,
                            "options": sorted(
                                options,
                                key=lambda r: str(r.get("name") or "").lower(),
                            ),
                        }
                    )
                    continue

                has_tp, pick_tp = _class_feature_has_select(parent, "Trait Package")
                tp_options = (
                    _options_from_trait_package_select(
                        parent, cls, features_by_name, features_by_id
                    )
                    if has_tp
                    else []
                )
                if len(tp_options) >= 2:
                    groups.append(
                        {
                            "key": f"classFeature:{parent_id}",
                            "kind": "classFeature",
                            "parentFeatureId": parent_id,
                            "parentFeatureName": parent_name,
                            "pickCount": pick_tp or 1,
                            "options": sorted(
                                tp_options,
                                key=lambda r: str(r.get("name") or "").lower(),
                            ),
                        }
                    )
                    continue

                has_pow, pick_pow = _class_feature_has_select(parent, "Power")
                power_pools = _class_power_select_pools_for_class(
                    parent,
                    class_id,
                    cls,
                    features_by_id,
                    exclude_power_ids=class_feature_pick_exclusions,
                    powers_by_name=powers_by_name,
                    powers_by_class_id=powers_by_class_id,
                )
                if has_pow and power_pools:
                    if len(power_pools) == 1:
                        groups.append(
                            {
                                "key": f"classPower:{parent_id}",
                                "kind": "power",
                                "parentFeatureId": parent_id,
                                "parentFeatureName": parent_name,
                                "pickCount": pick_pow,
                                "powerIds": power_pools[0],
                                "options": [],
                            }
                        )
                    else:
                        rules = parent.get("rules") or {}
                        selects = [
                            (item.get("attrs") or {})
                            for item in (rules.get("select") or [])
                            if (item.get("attrs") or {}).get("type") == "Power"
                        ]
                        for pool_index, pool_ids in enumerate(power_pools):
                            attrs = selects[pool_index] if pool_index < len(selects) else {}
                            pool_pick = pick_pow
                            if attrs.get("spellbook"):
                                pool_pick = 2
                            min_level = parse_int_from_text(attrs.get("Level")) or 1
                            groups.append(
                                {
                                    "key": f"classPower:{parent_id}:{pool_index}",
                                    "kind": "power",
                                    "parentFeatureId": parent_id,
                                    "parentFeatureName": parent_name,
                                    "pickCount": pool_pick,
                                    "minLevel": min_level,
                                    "powerIds": pool_ids,
                                    "options": [],
                                }
                            )
                    continue
                elif has_pow and pick_pow > 0:
                    power_ids = _power_ids_from_class_feature_power_select(
                        parent,
                        features_by_id,
                        class_id=class_id,
                        cls=cls,
                        exclude_power_ids=class_feature_pick_exclusions,
                        powers_by_name=powers_by_name,
                        powers_by_class_id=powers_by_class_id,
                    )
                    if power_ids:
                        groups.append(
                            {
                                "key": f"classPower:{parent_id}",
                                "kind": "power",
                                "parentFeatureId": parent_id,
                                "parentFeatureName": parent_name,
                                "pickCount": pick_pow,
                                "powerIds": power_ids,
                                "options": [],
                            }
                        )
                        continue

                sub_ids = _parse_internal_id_list(ps.get("_PARSED_SUB_FEATURES"))
                if len(sub_ids) >= 2:
                    sub_opts = [
                        _class_feature_child_option_row(features_by_id[sid], parent_id, parent_name)
                        for sid in sub_ids
                        if sid in features_by_id
                    ]
                    if len(sub_opts) >= 2:
                        groups.append(
                            {
                                "key": f"classFeature:{parent_id}",
                                "kind": "classFeature",
                                "parentFeatureId": parent_id,
                                "parentFeatureName": parent_name,
                                "pickCount": 1,
                                "options": sorted(
                                    sub_opts,
                                    key=lambda r: str(r.get("name") or "").lower(),
                                ),
                            }
                        )

        for g in grants_raw:
            sp = g.get("specific") or {}
            if sp.get("_SupportsID") != class_id:
                continue
            for gr in (g.get("rules") or {}).get("grant") or []:
                attrs = gr.get("attrs") or {}
                if attrs.get("type") != "Class Feature":
                    continue
                parent_id = attrs.get("name")
                if not isinstance(parent_id, str):
                    continue
                parent = features_by_id.get(parent_id)
                if not parent:
                    continue
                if not _class_feature_applies_to_support_class(parent, class_id, classes_by_id):
                    continue
                ps = parent.get("specific") or {}
                level = parse_int_from_text(ps.get("Level"))
                if level is None or level <= 1:
                    continue
                parent_name = str(parent.get("name") or parent_id)
                group_key = f"classPower:{parent_id}:{level}"

                aspect_ids = _supplement_level_gated_aspect_power_ids(parent, powers_by_name)
                if aspect_ids:
                    _, pick_pow = _class_feature_has_select(parent, "Power")
                    groups.append(
                        {
                            "key": group_key,
                            "kind": "power",
                            "parentFeatureId": parent_id,
                            "parentFeatureName": parent_name,
                            "pickCount": pick_pow or 1,
                            "minLevel": level,
                            "powerIds": aspect_ids,
                            "options": [],
                        }
                    )
                    continue

                has_cf, pick_n = _class_feature_has_select(parent, "Class Feature")
                options = (
                    _supplement_class_feature_select_options(
                        parent,
                        cls,
                        _options_from_class_feature_select(parent, features_by_id),
                        features_by_id,
                        features_by_name,
                    )
                    if has_cf
                    else []
                )
                if len(options) >= 2:
                    groups.append(
                        {
                            "key": f"classFeature:{parent_id}:{level}",
                            "kind": "classFeature",
                            "parentFeatureId": parent_id,
                            "parentFeatureName": parent_name,
                            "pickCount": pick_n or 1,
                            "minLevel": level,
                            "options": sorted(
                                options,
                                key=lambda r: str(r.get("name") or "").lower(),
                            ),
                        }
                    )
                    continue

                has_tp, pick_tp = _class_feature_has_select(parent, "Trait Package")
                tp_options = (
                    _options_from_trait_package_select(
                        parent, cls, features_by_name, features_by_id
                    )
                    if has_tp
                    else []
                )
                if len(tp_options) >= 2:
                    groups.append(
                        {
                            "key": f"classFeature:{parent_id}:{level}",
                            "kind": "classFeature",
                            "parentFeatureId": parent_id,
                            "parentFeatureName": parent_name,
                            "pickCount": pick_tp or 1,
                            "minLevel": level,
                            "options": sorted(
                                tp_options,
                                key=lambda r: str(r.get("name") or "").lower(),
                            ),
                        }
                    )
                    continue

                has_pow, pick_pow = _class_feature_has_select(parent, "Power")
                if has_pow and pick_pow > 0:
                    power_ids = _power_ids_from_class_feature_power_select(
                        parent,
                        features_by_id,
                        class_id=class_id,
                        cls=cls,
                        exclude_power_ids=class_feature_pick_exclusions,
                        powers_by_name=powers_by_name,
                        powers_by_class_id=powers_by_class_id,
                    )
                    if power_ids:
                        groups.append(
                            {
                                "key": group_key,
                                "kind": "power",
                                "parentFeatureId": parent_id,
                                "parentFeatureName": parent_name,
                                "pickCount": pick_pow,
                                "minLevel": level,
                                "powerIds": power_ids,
                                "options": [],
                            }
                        )

        parsed_names = [
            p.strip()
            for p in str((cls.get("specific") or {}).get("_PARSED_CLASS_FEATURE") or "").split(",")
            if p.strip()
        ]
        ungranted: List[Dict[str, Any]] = []
        for name in parsed_names:
            feat = features_by_name.get(name)
            if not feat:
                continue
            fid = str(feat.get("internal_id") or "")
            if fid in granted_l1:
                continue
            lvl = parse_int_from_text((feat.get("specific") or {}).get("Level"))
            if lvl not in (None, 1):
                continue
            ungranted.append(feat)

        def _is_leader_pick_feature(cf: Dict[str, Any]) -> bool:
            return str(cf.get("name") or "").strip().endswith(" Leader")

        groups = _append_ungranted_power_choice_groups(
            class_id,
            cls,
            ungranted,
            groups,
            features_by_id,
            exclude_power_ids=class_feature_pick_exclusions,
            powers_by_name=powers_by_name,
            powers_by_class_id=powers_by_class_id,
        )

        leader_feats = [f for f in ungranted if _is_leader_pick_feature(f)]
        remaining_ungranted = [f for f in ungranted if f not in leader_feats]

        if len(leader_feats) >= 2:
            leader_opts = [
                _class_feature_child_option_row(f, "", "Leader") for f in leader_feats
            ]
            leader_ids = sorted(str(f.get("internal_id") or "") for f in leader_feats)
            groups.append(
                {
                    "key": f"classFeaturePair:{':'.join(leader_ids)}",
                    "kind": "classFeature",
                    "parentFeatureId": "",
                    "parentFeatureName": "Leader",
                    "pickCount": 1,
                    "options": sorted(
                        leader_opts,
                        key=lambda r: str(r.get("name") or "").lower(),
                    ),
                }
            )

        if len(remaining_ungranted) == 1:
            feat = remaining_ungranted[0]
            fid = str(feat.get("internal_id") or "")
            feat_name = str(feat.get("name") or fid)
            groups.append(
                {
                    "key": f"classFeatureOptional:{fid}",
                    "kind": "classFeature",
                    "parentFeatureId": fid,
                    "parentFeatureName": feat_name,
                    "pickCount": 1,
                    "optional": True,
                    "options": [
                        {
                            "id": "__none__",
                            "name": "Standard (default class proficiencies)",
                            "parentFeatureId": fid,
                            "parentFeatureName": feat_name,
                            "shortDescription": None,
                            "body": None,
                            "powerIds": [],
                        },
                        _class_feature_child_option_row(feat, fid, feat_name),
                    ],
                }
            )
            remaining_ungranted = []

        pair_key: Optional[str] = None
        if len(remaining_ungranted) == 2:
            opts = [
                _class_feature_child_option_row(f, "", "Class feature")
                for f in remaining_ungranted
            ]
            ids = sorted(str(f.get("internal_id") or "") for f in remaining_ungranted)
            pair_key = f"classFeaturePair:{':'.join(ids)}"
            groups.append(
                {
                    "key": pair_key,
                    "kind": "classFeature",
                    "parentFeatureId": "",
                    "parentFeatureName": "Class feature",
                    "pickCount": 1,
                    "options": sorted(opts, key=lambda r: str(r.get("name") or "").lower()),
                }
            )

        for feat in remaining_ungranted:
            has_cf, pick_n = _class_feature_has_select(feat, "Class Feature")
            nested = _options_from_class_feature_select(feat, features_by_id)
            if has_cf or len(nested) < 2:
                nested = _supplement_class_feature_select_options(
                    feat,
                    cls,
                    nested,
                    features_by_id,
                    features_by_name,
                )
            has_tp, pick_tp = _class_feature_has_select(feat, "Trait Package")
            if len(nested) < 2 and has_tp:
                nested = _options_from_trait_package_select(
                    feat, cls, features_by_name, features_by_id
                )
                pick_n = pick_tp
            if len(nested) >= 2:
                fid = str(feat.get("internal_id") or "")
                row: Dict[str, Any] = {
                    "key": f"classFeature:{fid}",
                    "kind": "classFeature",
                    "parentFeatureId": fid,
                    "parentFeatureName": str(feat.get("name") or fid),
                    "pickCount": pick_n or 1,
                    "options": sorted(
                        nested,
                        key=lambda r: str(r.get("name") or "").lower(),
                    ),
                }
                if pair_key:
                    row["visibleWhen"] = {"groupKey": pair_key, "optionId": fid}
                groups.append(row)

        groups = _supplement_mapped_optional_class_feature_groups(
            class_id, groups, features_by_name, features_by_id
        )
        groups = _append_missing_trait_package_parent_groups(
            class_id, cls, groups, features_by_name, features_by_id, classes_by_id
        )
        groups = _append_nested_child_power_choice_groups(
            class_id,
            cls,
            groups,
            features_by_id,
            exclude_power_ids=class_feature_pick_exclusions,
            powers_by_name=powers_by_name,
            powers_by_class_id=powers_by_class_id,
        )
        groups = _append_nested_child_class_feature_choice_groups(
            groups,
            features_by_id,
        )
        if groups:
            out[class_id] = sorted(
                groups,
                key=lambda g: (
                    int(g.get("minLevel") or 1),
                    str(g.get("parentFeatureName") or "").lower(),
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


def _normalize_power_match_key(name: str) -> str:
    """Collapse punctuation/spacing for fuzzy power name match (wolfpack → Wolf Pack)."""
    s = name.strip().lower()
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    return re.sub(r"[^a-z0-9]", "", s)


# Known compendium typos / shorthand in feat Associated Powers or modify rows.
_FEAT_POWER_NAME_ALIASES: Dict[str, str] = {
    "command's strike": "commander's strike",
    "predator's strike": "predator strike",
    "overhwleming strike": "overwhelming strike",
    "haunting sounds": "ghost sound",
    "ghost sounds": "ghost sound",
    # Hand of Fury feat: modify name is wrong in Dragon 387; targets Hand of Radiance.
    "hand of fury": "hand of radiance",
}


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


def _build_power_normalized_name_to_id(powers_raw: List[Dict[str, Any]]) -> Dict[str, str]:
    """Normalized display names (alphanumeric only) → first compendium power id."""
    lookup: Dict[str, str] = {}
    for power in powers_raw:
        pid = power.get("internal_id")
        pname = power.get("name")
        if not isinstance(pid, str) or not isinstance(pname, str):
            continue
        key = _normalize_power_match_key(pname)
        if key and key not in lookup:
            lookup[key] = pid
    return lookup


def _resolve_power_id(
    name_or_id: str,
    power_name_to_id: Dict[str, str],
    power_normalized_to_id: Dict[str, str],
    power_id_to_name: Dict[str, str],
) -> Optional[str]:
    """Resolve feat power modification target from compendium id or display name."""
    raw = name_or_id.strip()
    if not raw:
        return None
    if raw.startswith("ID_") and raw in power_id_to_name:
        return raw

    lower = _FEAT_POWER_NAME_ALIASES.get(raw.lower(), raw.lower())
    exact = power_name_to_id.get(lower)
    if exact:
        return exact

    norm = _normalize_power_match_key(lower)
    by_norm = power_normalized_to_id.get(norm)
    if by_norm:
        return by_norm

    if raw.startswith("ID_"):
        return raw
    return None


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


def _resolve_class_feature_id(name_or_id: str, class_feature_id_by_name: Dict[str, str]) -> Optional[str]:
    raw = name_or_id.strip()
    if not raw:
        return None
    if raw.startswith("ID_") and raw in class_feature_id_by_name.values():
        return raw
    lower = raw.lower()
    if lower in class_feature_id_by_name:
        return class_feature_id_by_name[lower]
    norm = _normalize_power_match_key(lower)
    for key, fid in class_feature_id_by_name.items():
        if _normalize_power_match_key(key) == norm:
            return fid
    if raw.startswith("ID_"):
        return raw
    return None


def extract_feat_power_modifications(
    feat: Dict[str, Any],
    power_name_to_id: Dict[str, str],
    power_normalized_to_id: Dict[str, str],
    power_id_to_name: Dict[str, str],
    class_feature_id_by_name: Optional[Dict[str, str]] = None,
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
        if not value and field == "Keywords":
            value = str(attrs.get("list-addition") or "").strip()
        pid = _resolve_power_id(pname, power_name_to_id, power_normalized_to_id, power_id_to_name)
        cfid = None
        if not pid and class_feature_id_by_name:
            cfid = _resolve_class_feature_id(pname, class_feature_id_by_name)
        entries.append(
            {
                "powerName": pname,
                "powerId": pid,
                "classFeatureId": cfid,
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
        apid = _resolve_power_id(pname, power_name_to_id, power_normalized_to_id, power_id_to_name)
        acfid = (
            _resolve_class_feature_id(pname, class_feature_id_by_name)
            if not apid and class_feature_id_by_name
            else None
        )
        entry = {
            "powerName": pname,
            "powerId": apid,
            "classFeatureId": acfid,
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


_POWER_REPLACE_SPEC_RE = re.compile(r"^(.+):([^,]+),(\d+)\+?$")


def _normalize_power_replace_bucket(raw: str) -> Optional[str]:
    """Map compendium power-replace usage token to builder slot bucket."""
    token = raw.strip().lower()
    if token == "utility":
        return "utility"
    if token == "encounter":
        return "encounter"
    if token == "daily":
        return "daily"
    if token in ("at-will", "atwill", "at will"):
        return "atWill"
    if token == "attack":
        return "encounter"
    return None


def _parse_power_replace_spec(value: str) -> Optional[tuple[str, str, int]]:
    """Parse 'Gythka Parry:utility,6+' -> (powerNameOrId, bucket, minSlotGainLevel)."""
    m = _POWER_REPLACE_SPEC_RE.match(value.strip())
    if not m:
        return None
    name = m.group(1).strip()
    bucket = _normalize_power_replace_bucket(m.group(2))
    if not bucket or not name:
        return None
    try:
        min_level = int(m.group(3))
    except ValueError:
        return None
    return name, bucket, min_level


def _build_power_id_to_name(powers_raw: List[Dict[str, Any]]) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for power in powers_raw:
        pid = power.get("internal_id")
        pname = power.get("name")
        if isinstance(pid, str) and isinstance(pname, str) and pname.strip():
            lookup[pid] = pname.strip()
    return lookup


def extract_feat_power_replace_offers(
    feat: Dict[str, Any],
    power_name_to_id: Dict[str, str],
    power_id_to_name: Dict[str, str],
) -> Dict[str, Any]:
    """
    Named `rules.replace` rows with `power-replace` (weapon mastery, gythka chain, etc.).
    Skips multiclass `encounter swap` style rows (no power-replace attribute).
    """
    rules = feat.get("rules") if isinstance(feat.get("rules"), dict) else {}
    spec = feat.get("specific") if isinstance(feat.get("specific"), dict) else {}
    display_raw = str(spec.get("_DisplayPowers") or "").strip()
    display_ids = [x.strip() for x in display_raw.split(",") if x.strip()] if display_raw else []

    offers: List[Dict[str, Any]] = []
    for idx, rep in enumerate(rules.get("replace") or []):
        if not isinstance(rep, dict):
            continue
        attrs = rep.get("attrs") or {}
        pr = attrs.get("power-replace")
        if not isinstance(pr, str) or not pr.strip():
            continue
        parsed = _parse_power_replace_spec(pr)
        if not parsed:
            continue
        name_or_id, bucket, min_level = parsed
        repl_id: Optional[str] = None
        if name_or_id.startswith("ID_FMP_POWER_"):
            repl_id = name_or_id
        elif idx < len(display_ids):
            repl_id = display_ids[idx]
        else:
            repl_id = power_name_to_id.get(name_or_id.lower())
        if not repl_id:
            continue
        repl_name = power_id_to_name.get(repl_id) or name_or_id
        optional = str(attrs.get("optional", "")).strip().lower() == "true"
        offers.append(
            {
                "replacementPowerId": repl_id,
                "replacementPowerName": repl_name,
                "usageBucket": bucket,
                "minSlotGainLevel": min_level,
                "optional": optional,
            }
        )

    return {"powerReplaceOffers": offers}


_MULTICLASS_SLOT_BUCKET: Dict[str, str] = {
    "encounter": "encounter",
    "utility": "utility",
    "daily": "daily",
    "augmentable at-will": "atWill",
}


def _multiclass_token_bucket(token: str) -> Optional[str]:
    return _MULTICLASS_SLOT_BUCKET.get(token.strip().lower())


def _feat_has_power_usage_encounter_modify(rules: Dict[str, Any]) -> bool:
    for mod in rules.get("modify") or []:
        if not isinstance(mod, dict):
            continue
        attrs = mod.get("attrs") or {}
        if str(attrs.get("Field", "")).strip() == "Power Usage" and str(attrs.get("value", "")).strip().lower() == "encounter":
            return True
    return False


# PHB3 psionic swap feats share `encounter|Augmentable At-Will` in data; direction is feat-specific.
_PSIONIC_MULTICLASS_SWAP_BY_FEAT: Dict[str, Dict[str, Any]] = {
    "psionic complement": {
        "usageBucket": "atWill",
        "replacementUsageBucket": "atWill",
        "requireAugmentableSlot": True,
        "requireAugmentableReplacement": True,
    },
    "psionic dabbler": {
        "usageBucket": "encounter",
        "replacementUsageBucket": "atWill",
        "requireAugmentableReplacement": True,
        "replacementUsedAsEncounter": True,
        "powerPointSwapChange": "gain",
    },
    "psionic conventionalist": {
        "usageBucket": "atWill",
        "replacementUsageBucket": "encounter",
        "requireAugmentableSlot": True,
        "powerPointSwapChange": "lose",
    },
}


def extract_feat_multiclass_slot_swap_offers(feat: Dict[str, Any]) -> Dict[str, Any]:
    """
    PHB multiclass slot swaps (Novice / Acolyte / Adept) and PHB3 psionic variants.
    `rules.replace` with `multiclass` + `Level`, no `power-replace`. Collapses level rows into one offer.
    """
    rules = feat.get("rules") if isinstance(feat.get("rules"), dict) else {}
    feat_name = str(feat.get("name") or "").strip().lower()
    psionic_spec = _PSIONIC_MULTICLASS_SWAP_BY_FEAT.get(feat_name)

    slot_buckets: set[str] = set()
    repl_buckets: set[str] = set()
    max_slot_gain_level = 0
    optional = True
    require_augmentable_slot = False
    require_augmentable_replacement = False

    for rep in rules.get("replace") or []:
        if not isinstance(rep, dict):
            continue
        attrs = rep.get("attrs") or {}
        if attrs.get("power-replace"):
            continue
        mc_raw = attrs.get("multiclass")
        if not isinstance(mc_raw, str) or not mc_raw.strip():
            continue
        level_raw = attrs.get("Level")
        try:
            level = int(str(level_raw).strip())
        except (TypeError, ValueError):
            continue

        tokens = [t.strip() for t in mc_raw.split("|") if t.strip()]
        if len(tokens) == 1:
            bucket = _multiclass_token_bucket(tokens[0])
            if not bucket:
                continue
            slot_buckets.add(bucket)
            repl_buckets.add(bucket)
            if "augmentable" in tokens[0].lower():
                require_augmentable_slot = True
                require_augmentable_replacement = True
        elif len(tokens) == 2:
            b0 = _multiclass_token_bucket(tokens[0])
            b1 = _multiclass_token_bucket(tokens[1])
            if not b0 or not b1:
                continue
            if psionic_spec:
                slot_buckets.add(psionic_spec["usageBucket"])
                repl_buckets.add(psionic_spec.get("replacementUsageBucket", psionic_spec["usageBucket"]))
            else:
                slot_buckets.add(b0)
                repl_buckets.add(b1)
            if "augmentable" in tokens[0].lower():
                require_augmentable_slot = True
            if "augmentable" in tokens[1].lower():
                require_augmentable_replacement = True
        else:
            continue

        max_slot_gain_level = max(max_slot_gain_level, level)
        if str(attrs.get("optional", "")).strip().lower() != "true":
            optional = False

    if psionic_spec:
        slot_buckets = {psionic_spec["usageBucket"]}
        repl_buckets = {psionic_spec.get("replacementUsageBucket", psionic_spec["usageBucket"])}
        require_augmentable_slot = bool(psionic_spec.get("requireAugmentableSlot"))
        require_augmentable_replacement = bool(psionic_spec.get("requireAugmentableReplacement"))

    if len(slot_buckets) != 1 or max_slot_gain_level < 1:
        return {}

    slot_bucket = next(iter(slot_buckets))
    repl_bucket = next(iter(repl_buckets)) if repl_buckets else slot_bucket
    if psionic_spec and psionic_spec.get("replacementUsedAsEncounter"):
        replacement_used_as_encounter = True
    else:
        replacement_used_as_encounter = _feat_has_power_usage_encounter_modify(rules)

    offer: Dict[str, Any] = {
        "usageBucket": slot_bucket,
        "maxSlotGainLevel": max_slot_gain_level,
        "optional": optional,
    }
    if repl_bucket != slot_bucket:
        offer["replacementUsageBucket"] = repl_bucket
    if require_augmentable_slot:
        offer["requireAugmentableSlot"] = True
    if require_augmentable_replacement:
        offer["requireAugmentableReplacement"] = True
    if replacement_used_as_encounter:
        offer["replacementUsedAsEncounter"] = True
    if psionic_spec and psionic_spec.get("powerPointSwapChange"):
        offer["powerPointSwapChange"] = psionic_spec["powerPointSwapChange"]

    return {"multiclassSlotSwapOffers": [offer]}


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


def _gear_price_gp(spec: Dict[str, Any]) -> Optional[float]:
    gp = parse_int_from_text(spec.get("Gold")) or 0
    sp = parse_int_from_text(spec.get("Silver")) or 0
    cp = parse_int_from_text(spec.get("Copper")) or 0
    total = gp + sp / 10.0 + cp / 100.0
    return total if total > 0 else None


def _gear_index_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    spec = row.get("specific") or {}
    name = row.get("name") or ""
    weight_raw = spec.get("Weight")
    weight_lb: Optional[float] = None
    if weight_raw is not None and str(weight_raw).strip():
        try:
            weight_lb = float(str(weight_raw).strip())
        except ValueError:
            weight_lb = None
    entry: Dict[str, Any] = {
        "id": row.get("internal_id"),
        "name": name,
        "slug": normalize_name(name),
        "source": row.get("source"),
        "category": spec.get("Category"),
        "priceGp": _gear_price_gp(spec),
        "weightLb": weight_lb,
        "count": parse_int_from_text(spec.get("count")),
        "body": row.get("body"),
        "raw": row,
    }
    if entry["priceGp"] is None:
        entry.pop("priceGp", None)
    if entry["weightLb"] is None:
        entry.pop("weightLb", None)
    if entry["count"] is None:
        entry.pop("count", None)
    if not entry.get("body"):
        entry.pop("body", None)
    return entry


def _ritual_index_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    spec = row.get("specific") or {}
    name = row.get("name") or ""
    entry: Dict[str, Any] = {
        "id": row.get("internal_id"),
        "name": name,
        "slug": normalize_name(name),
        "source": row.get("source"),
        "flavor": row.get("flavor"),
        "category": spec.get("Category"),
        "keySkill": spec.get("Key Skill"),
        "level": parse_int_from_text(spec.get("Level")),
        "marketPriceGp": parse_int_from_text(spec.get("Market Price")),
        "componentCost": spec.get("Component Cost"),
        "time": spec.get("Time"),
        "duration": spec.get("Duration"),
        "body": row.get("body"),
        "raw": row,
    }
    for key in ("flavor", "category", "keySkill", "level", "marketPriceGp", "componentCost", "time", "duration", "body"):
        if entry.get(key) in (None, ""):
            entry.pop(key, None)
    return entry


def _is_martial_practice_ritual_row(row: Dict[str, Any]) -> bool:
    cat = str((row.get("specific") or {}).get("Category") or "").lower()
    return "martial practice" in cat


def _alchemy_magic_item(row: Dict[str, Any]) -> bool:
    spec = row.get("specific") or {}
    mit = spec.get("Magic Item Type")
    if isinstance(mit, list):
        mit = mit[0] if mit else None
    if not mit:
        return False
    return str(mit) in {
        "Alchemical",
        "Elixir",
        "Potion",
        "Consumable",
        "Other Consumable",
    }


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
        "Gear",
        "Ritual",
        "Build",
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
        "Gear": read_json("Gear.json"),
        "Ritual": read_json("Ritual.json"),
        "Build": read_json("Build.json"),
    }


def _write_consumables_catalogs(
    output_dir: Path,
    gear: List[Dict[str, Any]],
    rituals: List[Dict[str, Any]],
    martial_practices: List[Dict[str, Any]],
    alchemy_items: List[Dict[str, Any]],
) -> None:
    """Smaller JSON slices for consumable tabs (lazy-loaded when rules_index predates gear/ritual ETL)."""
    catalog_dir = output_dir / "catalogs"
    catalog_dir.mkdir(parents=True, exist_ok=True)
    adventuring_gear = [
        g for g in gear if (g.get("category") or "") in {"Gear", "Ammunition"}
    ]
    payloads = {
        "adventuring_gear.json": adventuring_gear,
        "rituals.json": rituals,
        "martial_practices.json": martial_practices,
        "alchemy_items.json": alchemy_items,
    }
    for name, rows in payloads.items():
        (catalog_dir / name).write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


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
    gear_raw = collections.get("Gear") or []
    rituals_raw = collections.get("Ritual") or []
    features_by_id: Dict[str, Dict[str, Any]] = {
        str(row.get("internal_id")): row for row in class_features_raw if row.get("internal_id")
    }
    class_feature_by_name: Dict[str, Dict[str, Any]] = {}
    for row in class_features_raw:
        n = row.get("name")
        if isinstance(n, str) and n.strip():
            class_feature_by_name[n.strip()] = row

    grants_raw = collections["Grants"]
    classes_by_id = {
        str(c["internal_id"]): c for c in classes_raw if c.get("internal_id")
    }
    support_by_id = dict(classes_by_id)
    for hyb in hybrid_classes_raw:
        hid = hyb.get("internal_id")
        if hid:
            support_by_id[str(hid)] = hyb
    auto_granted_power_ids_by_class = build_auto_granted_power_ids_by_class(
        grants_raw, features_by_id, support_by_id
    )
    skill_training_by_id: Dict[str, Dict[str, Any]] = {
        str(row.get("internal_id")): row
        for row in skill_training_raw
        if row.get("internal_id")
    }
    auto_granted_skill_training_names_by_support = build_auto_granted_skill_training_names_by_support(
        grants_raw, skill_training_by_id
    )
    granted_class_feature_names_by_support_id = build_granted_class_feature_names_by_support(
        grants_raw, features_by_id, support_by_id
    )
    builds_raw = collections.get("Build") or []
    class_build_options_by_class = merge_class_build_options_by_class(
        {},
        build_essentials_class_build_options_by_class(classes_raw, builds_raw),
    )
    powers_by_name: Dict[str, Dict[str, Any]] = {}
    for row in powers_raw:
        name = row.get("name")
        if isinstance(name, str) and name.strip():
            powers_by_name[name.strip()] = row

    powers_by_class_id = _build_powers_by_class_id(powers_raw)
    class_feature_choice_groups_by_class = build_class_feature_choice_groups_by_class(
        grants_raw,
        features_by_id,
        classes_by_id,
        paragon_raw,
        feats_raw,
        powers_by_name,
        powers_by_class_id,
    )
    paragon_path_class_feature_power_ids = sorted(
        _paragon_path_class_feature_power_ids(paragon_raw, features_by_id)
    )
    feat_granted_power_ids_excluded_from_class_feature_picks = sorted(
        _feat_granted_power_ids_excluded_from_class_feature_picks(feats_raw)
    )

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

    racial_traits_by_id: Dict[str, Dict[str, Any]] = {
        str(row.get("internal_id")): row for row in racial_traits_raw if row.get("internal_id")
    }

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
                **_extract_racial_trait_index_fields(row, racial_traits_by_id),
            }
        )

    class_features: List[Dict[str, Any]] = []
    for row in class_features_raw:
        spec = row.get("specific") or {}
        mechanical = _extract_class_feature_mechanical_effects(row)
        class_features.append(
            {
                "id": row.get("internal_id"),
                "name": row.get("name"),
                "slug": normalize_name(row.get("name", "")),
                "source": row.get("source"),
                "shortDescription": spec.get("Short Description"),
                "body": row.get("body"),
                "raw": row,
                **({"mechanicalEffects": mechanical} if mechanical else {}),
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
    power_normalized_to_id = _build_power_normalized_name_to_id(powers_raw)
    power_id_to_name = _build_power_id_to_name(powers_raw)

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
        feat_power_mods = extract_feat_power_modifications(
            feat,
            power_name_to_id,
            power_normalized_to_id,
            power_id_to_name,
            class_feature_id_by_name,
        )
        feat_power_replace = extract_feat_power_replace_offers(
            feat, power_name_to_id, power_id_to_name
        )
        feat_multiclass_slot_swap = extract_feat_multiclass_slot_swap_offers(feat)
        feat_grants = _feat_append_heritage_internal_key(feat_grants, str(feat.get("name") or ""))
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
                **feat_power_replace,
                **feat_multiclass_slot_swap,
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
        path_grants = extract_grants_from_rules(
            row.get("rules"),
            class_name_to_id,
            skill_training_by_id,
            skill_name_to_id,
            class_feature_name_lookup,
            class_feature_id_by_name,
        )
        granted_cf = path_grants.get("grantedClassFeatureIds") or []
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
                **path_grants,
                "grantsParagonPowerPoints": PARAGON_POWER_POINTS_CLASS_FEATURE_ID in granted_cf,
            }
        )

    proficiencies: List[Dict[str, Any]] = []
    for row in proficiencies_raw:
        proficiencies.append(_proficiency_index_entry(row))

    backgrounds: List[Dict[str, Any]] = []
    for row in backgrounds_raw:
        backgrounds.append(_background_index_entry(row, known_races, known_classes, anomalies))

    magic_items: List[Dict[str, Any]] = []
    alchemy_items: List[Dict[str, Any]] = []
    for row in magic_items_raw:
        entry = _magic_item_index_entry(row)
        magic_items.append(entry)
        if _alchemy_magic_item(row):
            alchemy_items.append(entry)

    gear: List[Dict[str, Any]] = []
    for row in gear_raw:
        gear.append(_gear_index_entry(row))

    rituals: List[Dict[str, Any]] = []
    martial_practices: List[Dict[str, Any]] = []
    for row in rituals_raw:
        entry = _ritual_index_entry(row)
        if _is_martial_practice_ritual_row(row):
            martial_practices.append(entry)
        else:
            rituals.append(entry)

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
                "gear": len(gear),
                "rituals": len(rituals),
                "martialPractices": len(martial_practices),
                "alchemyItems": len(alchemy_items),
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
        "gear": gear,
        "rituals": rituals,
        "martialPractices": martial_practices,
        "alchemyItems": alchemy_items,
        "autoGrantedPowerIdsByClassId": auto_granted_power_ids_by_class,
        "autoGrantedSkillTrainingNamesBySupportId": auto_granted_skill_training_names_by_support,
        "grantedClassFeatureNamesBySupportId": granted_class_feature_names_by_support_id,
        "classBuildOptionsByClassId": class_build_options_by_class,
        "classFeatureChoiceGroupsByClassId": class_feature_choice_groups_by_class,
        "paragonPathClassFeaturePowerIds": paragon_path_class_feature_power_ids,
        "featGrantedPowerIdsExcludedFromClassFeaturePicks": (
            feat_granted_power_ids_excluded_from_class_feature_picks
        ),
        "featPowerNameAliases": dict(_FEAT_POWER_NAME_ALIASES),
        "psionicPowerPointsByLevel": dict(PSIONIC_POWER_POINTS_BY_LEVEL),
        "hybridPsionicAugmentationBreakpoints": list(HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS),
        "paragonMulticlassNonPsionicToPsionicAtWillPenalty": (
            PARAGON_MC_NON_PSIONIC_TO_PSIONIC_AT_WILL_PENALTY
        ),
    }

    (output_dir / "rules_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    _write_consumables_catalogs(output_dir, gear, rituals, martial_practices, alchemy_items)

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


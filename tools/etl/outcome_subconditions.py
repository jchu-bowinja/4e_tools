"""
Split 4e monster outcome prose into structured aftereffects / sustains / failedSavingThrows.

Used by build_monster_index.py and extract_monster_templates_from_pdfs.py.
Keep regex alternatives in sync with src/features/monsterEditor/monsterOutcomeSubconditions.ts.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

# Longer phrases must precede shorter shared prefixes (e.g. First Failed … before Failed …).
_MARKER_SPLIT_RE = re.compile(
    r"\s*\b("
    r"First Failed Saving Throw|Second Failed Saving Throw|Third Failed Saving Throw|"
    r"Each Failed Saving Throw|Failed Saving Throw|"
    r"Aftereffect|Additional Effect|"
    r"Sustain Standard|Sustain Minor|Sustain Move|Sustain Free"
    r")\s*:\s*",
    re.IGNORECASE,
)


def split_subconditions_from_description(description: str) -> Tuple[str, Dict[str, List[Dict[str, Any]]]]:
    """Split one outcome description into primary text plus structured subcondition lists."""
    text = (description or "").strip()
    if not text:
        return "", {}

    parts = _MARKER_SPLIT_RE.split(text)
    if len(parts) < 3:
        return text, {}

    primary = parts[0].strip()
    buckets: Dict[str, List[Dict[str, Any]]] = {
        "aftereffects": [],
        "sustains": [],
        "failedSavingThrows": [],
    }

    i = 1
    while i + 1 < len(parts):
        label_raw = parts[i].strip()
        body = parts[i + 1].strip()
        label_norm = label_raw.lower()

        entry: Dict[str, Any] = {
            "kind": "MonsterAttackEntry",
            "name": label_raw,
            "description": body,
        }

        if "failed saving throw" in label_norm:
            buckets["failedSavingThrows"].append(entry)
        elif label_norm.startswith("aftereffect") or label_norm.startswith("additional effect"):
            buckets["aftereffects"].append(entry)
        elif label_norm.startswith("sustain"):
            buckets["sustains"].append(entry)
        i += 2

    out = {k: v for k, v in buckets.items() if v}
    return primary, out


def _has_structured_subconditions(outcome: Dict[str, Any]) -> bool:
    return bool(
        outcome.get("aftereffects") or outcome.get("sustains") or outcome.get("failedSavingThrows")
    )


def enrich_outcome_subconditions(outcome: Dict[str, Any]) -> None:
    """Mutates one Hit/Miss/Effect outcome dict."""
    if not outcome:
        return

    desc = str(outcome.get("description") or "").strip()
    if desc and not _has_structured_subconditions(outcome):
        primary, buckets = split_subconditions_from_description(desc)
        if buckets:
            outcome["description"] = primary
            for key, lst in buckets.items():
                outcome[key] = lst

    nad = outcome.get("nestedAttackDescriptions")
    if isinstance(nad, list):
        new_list: List[Any] = []
        for item in nad:
            if isinstance(item, dict):
                enrich_outcome_subconditions(item)
                new_list.append(item)
                continue
            if not isinstance(item, str):
                new_list.append(item)
                continue
            primary, buckets = split_subconditions_from_description(item)
            if buckets:
                obj: Dict[str, Any] = {"description": primary}
                for key, lst in buckets.items():
                    obj[key] = lst
                enrich_outcome_subconditions(obj)
                new_list.append(obj)
            else:
                new_list.append(item)
        outcome["nestedAttackDescriptions"] = new_list

    for key in ("aftereffects", "sustains", "failedSavingThrows"):
        arr = outcome.get(key)
        if isinstance(arr, list):
            for entry in arr:
                if isinstance(entry, dict):
                    enrich_outcome_subconditions(entry)


def _enrich_attack_outcomes(attack: Dict[str, Any]) -> None:
    for oc_key in ("hit", "miss", "effect"):
        oc = attack.get(oc_key)
        if isinstance(oc, dict):
            enrich_outcome_subconditions(oc)


def _is_redundant_attack_stub(entry: Dict[str, Any]) -> bool:
    """Drop duplicate MonsterAttackEntry rows that only mirror nested failed-save titles."""
    if str(entry.get("kind") or "") != "MonsterAttackEntry":
        return False
    keys_with_values = [k for k, v in entry.items() if v not in (None, "", [], {})]
    if len(keys_with_values) > 3:
        return False
    name = str(entry.get("name") or "").strip().lower()
    if not name:
        return False
    allowed_duplicates = {
        "each failed saving throw",
        "failed saving throw",
        "first failed saving throw",
        "second failed saving throw",
        "third failed saving throw",
    }
    if name not in allowed_duplicates:
        return False
    if entry.get("range") or entry.get("targets") or entry.get("attackBonuses"):
        return False
    if entry.get("hit") or entry.get("miss") or entry.get("effect"):
        return False
    if entry.get("description"):
        return False
    return True


def enrich_powers_subconditions(powers: List[Dict[str, Any]]) -> None:
    """Mutates monster/template power dicts in-place."""
    for power in powers:
        attacks = power.get("attacks")
        if not isinstance(attacks, list):
            continue
        filtered: List[Dict[str, Any]] = []
        for atk in attacks:
            if not isinstance(atk, dict):
                continue
            if _is_redundant_attack_stub(atk):
                continue
            _enrich_attack_outcomes(atk)
            filtered.append(atk)
        power["attacks"] = filtered


if __name__ == "__main__":
    sample = (
        "Area burst 2 within 10; level + 3 vs. Fortitude; 3d6 necrotic damage, and ongoing 5 necrotic damage "
        "(save ends). Failed Saving Throw: Make an attack vs. AC; 2d6 damage."
    )
    primary, buckets = split_subconditions_from_description(sample)
    assert "Make an attack" in buckets["failedSavingThrows"][0]["description"]
    assert "ongoing 5" in primary
    nested = (
        "Ranged 10; +5 vs Will; slowed (save ends). First Failed Saving Throw: unconscious (save ends)."
    )
    p2, b2 = split_subconditions_from_description(nested)
    assert "slowed" in p2
    assert "unconscious" in b2["failedSavingThrows"][0]["description"]
    print("outcome_subconditions smoke OK")

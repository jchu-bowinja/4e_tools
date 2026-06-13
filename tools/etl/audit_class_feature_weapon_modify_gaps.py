"""
Report class features with `rules.modify type=Weapon` not reflected in indexed mechanicalEffects.

Class-mapped Damage overrides (Rogue Weapon Talent, Druid of Summer, …) should appear in
`mechanicalEffects`. Internal weapon rows (Arena Training group definitions, implement
equivalence, property tweaks) are informational only.

Usage (from repo root):
  python tools/etl/audit_class_feature_weapon_modify_gaps.py
  python tools/etl/audit_class_feature_weapon_modify_gaps.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _weapon_modify_rows(feature: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = feature.get("raw")
    if not isinstance(raw, dict):
        return []
    rules = raw.get("rules")
    if not isinstance(rules, dict):
        return []
    out: List[Dict[str, Any]] = []
    for mod in rules.get("modify") or []:
        if not isinstance(mod, dict):
            continue
        attrs = mod.get("attrs") or {}
        if str(attrs.get("type") or "").strip().lower() != "weapon":
            continue
        out.append(attrs)
    return out


def _damage_weapon_names(feature: Dict[str, Any]) -> List[str]:
    names: List[str] = []
    for attrs in _weapon_modify_rows(feature):
        field = str(attrs.get("Field") or attrs.get("field") or "").strip()
        if field != "Damage":
            continue
        name = str(attrs.get("name") or "").strip()
        if name:
            names.append(name)
    return names


def _mechanical_weapon_names(feature: Dict[str, Any]) -> List[str]:
    names: List[str] = []
    for effect in feature.get("mechanicalEffects") or []:
        if not isinstance(effect, dict):
            continue
        if effect.get("type") not in ("weaponDamageOverride", "weaponDamageDieIncrease"):
            continue
        name = str(effect.get("weaponName") or "").strip()
        if name:
            names.append(name)
    return names


def audit_class_feature_weapon_modify_gaps(
    class_features: List[Dict[str, Any]],
) -> Dict[str, Any]:
    features_with_weapon_modify = 0
    field_counts: Counter[str] = Counter()
    damage_gaps: List[Dict[str, Any]] = []
    internal_only: List[Dict[str, str]] = []

    for feature in class_features:
        rows = _weapon_modify_rows(feature)
        if not rows:
            continue
        features_with_weapon_modify += 1
        for attrs in rows:
            field = str(attrs.get("Field") or attrs.get("field") or "").strip() or "(empty)"
            field_counts[field] += 1

        damage_names = _damage_weapon_names(feature)
        mech_names = set(_mechanical_weapon_names(feature))
        if damage_names:
            missing = [n for n in damage_names if n not in mech_names]
            if missing:
                damage_gaps.append(
                    {
                        "id": feature.get("id"),
                        "name": feature.get("name"),
                        "missingWeaponNames": missing,
                        "damageModifyCount": len(damage_names),
                        "mechanicalEffectCount": len(mech_names),
                    }
                )
        elif not feature.get("mechanicalEffects"):
            internal_only.append(
                {
                    "id": str(feature.get("id") or ""),
                    "name": str(feature.get("name") or ""),
                }
            )

    return {
        "featuresWithWeaponModify": features_with_weapon_modify,
        "fieldCounts": dict(sorted(field_counts.items())),
        "damageIndexingGaps": damage_gaps,
        "internalWeaponOnlyFeatures": len(internal_only),
        "damageGapCount": len(damage_gaps),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text summary")
    args = parser.parse_args()

    index_path = _repo_root() / "generated" / "rules_index.json"
    if not index_path.is_file():
        print(f"error: missing {index_path}", file=sys.stderr)
        return 1

    data = json.loads(index_path.read_text(encoding="utf-8"))
    features = data.get("classFeatures") or []
    if not isinstance(features, list):
        print("error: rules_index.json classFeatures is not a list", file=sys.stderr)
        return 1

    report = audit_class_feature_weapon_modify_gaps(features)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    print(f"Class features with weapon modify: {report['featuresWithWeaponModify']}")
    print(f"Damage indexing gaps: {report['damageGapCount']}")
    print(f"Internal weapon-only features (no Damage modify): {report['internalWeaponOnlyFeatures']}")
    print("Modify Field counts:")
    for field, count in report["fieldCounts"].items():
        print(f"  {field}: {count}")
    if report["damageIndexingGaps"]:
        print("\nDamage modify not indexed to mechanicalEffects:")
        for gap in report["damageIndexingGaps"][:20]:
            print(
                f"  {gap['name']} ({gap['id']}): missing {', '.join(gap['missingWeaponNames'])}"
            )
        if len(report["damageIndexingGaps"]) > 20:
            print(f"  ... and {len(report['damageIndexingGaps']) - 20} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

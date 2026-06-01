"""
Audit classFeatureChoiceGroupsByClassId power pools (SC-034 follow-up).

Flags:
  - power groups with pickCount > 0 but empty powerIds
  - level-1 class features with Power rules.select that have no indexed power group

Usage (from repo root):
  python tools/etl/audit_class_feature_choice_power_ids.py
  python tools/etl/audit_class_feature_choice_power_ids.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Set


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _parse_comma_ids(raw: Any) -> List[str]:
    return [s.strip() for s in str(raw or "").split(",") if s.strip()]


def _class_feature_is_level_one(cf: Dict[str, Any]) -> bool:
    raw = cf.get("raw") or {}
    spec = raw.get("specific") if isinstance(raw, dict) else {}
    if not isinstance(spec, dict):
        return True
    lvl = spec.get("Level")
    return lvl in (None, "", "1", 1)


def _class_feature_has_power_select(cf: Dict[str, Any]) -> bool:
    raw = cf.get("raw") or {}
    rules = raw.get("rules") if isinstance(raw, dict) else None
    if not isinstance(rules, dict):
        return False
    for item in rules.get("select") or []:
        if not isinstance(item, dict):
            continue
        attrs = item.get("attrs") or {}
        if str(attrs.get("type") or "") == "Power":
            return True
    return False


def _level_one_parsed_feature_ids(cls: Dict[str, Any], features_by_name: Dict[str, Dict[str, Any]]) -> Set[str]:
    raw = cls.get("raw") or {}
    spec = raw.get("specific") if isinstance(raw, dict) else {}
    names = _parse_comma_ids(spec.get("_PARSED_CLASS_FEATURE") if isinstance(spec, dict) else "")
    out: Set[str] = set()
    for name in names:
        feat = features_by_name.get(name.strip())
        if not feat:
            continue
        lvl_raw = (feat.get("specific") or {}).get("Level")
        if lvl_raw not in (None, "", "1", 1):
            continue
        fid = feat.get("id") or feat.get("internal_id")
        if fid:
            out.add(str(fid))
    return out


def audit(
    classes: List[Dict[str, Any]],
    class_features: List[Dict[str, Any]],
    choice_groups_by_class: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    features_by_id = {str(cf.get("id")): cf for cf in class_features if cf.get("id")}
    features_by_name = {
        str(cf.get("name") or "").strip(): cf for cf in class_features if cf.get("name")
    }

    empty_power_groups: List[Dict[str, Any]] = []
    missing_power_groups: List[Dict[str, Any]] = []

    indexed_power_parents: Dict[str, Set[str]] = {}
    for class_id, groups in choice_groups_by_class.items():
        parents: Set[str] = set()
        for g in groups:
            if g.get("kind") != "power":
                continue
            pid = str(g.get("parentFeatureId") or "")
            if pid:
                parents.add(pid)
            power_ids = g.get("powerIds") or []
            pick = int(g.get("pickCount") or 0)
            if pick > 0 and not power_ids:
                empty_power_groups.append(
                    {
                        "classId": class_id,
                        "key": g.get("key"),
                        "parentFeatureId": pid,
                        "parentFeatureName": g.get("parentFeatureName"),
                        "pickCount": pick,
                    }
                )
        indexed_power_parents[class_id] = parents

    for cls in classes:
        class_id = str(cls.get("id") or "")
        if not class_id:
            continue
        parents = indexed_power_parents.get(class_id, set())
        for fid in _level_one_parsed_feature_ids(cls, features_by_name):
            cf = features_by_id.get(fid)
            if not cf or not _class_feature_is_level_one(cf) or not _class_feature_has_power_select(cf):
                continue
            if fid not in parents:
                missing_power_groups.append(
                    {
                        "classId": class_id,
                        "className": cls.get("name"),
                        "featureId": fid,
                        "featureName": cf.get("name"),
                    }
                )

    return {
        "emptyPowerGroups": empty_power_groups,
        "level1PowerSelectWithoutIndexedGroup": missing_power_groups,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "rules_index",
        nargs="?",
        default=str(_repo_root() / "generated" / "rules_index.json"),
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    path = Path(args.rules_index)
    if not path.is_file():
        print(f"rules index not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    report = audit(
        data.get("classes") or [],
        data.get("classFeatures") or [],
        data.get("classFeatureChoiceGroupsByClassId") or {},
    )

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    empty = report["emptyPowerGroups"]
    missing = report["level1PowerSelectWithoutIndexedGroup"]
    print("=== Empty powerIds in classFeatureChoiceGroupsByClassId ===")
    print(f"count: {len(empty)}")
    for row in empty[:20]:
        print(
            f"  {row.get('parentFeatureName')} ({row.get('classId')}): key={row.get('key')}"
        )

    print("\n=== Level-1 parsed features with Power select but no indexed power group ===")
    print(f"count: {len(missing)}")
    for row in missing[:25]:
        print(f"  {row.get('className')}: {row.get('featureName')} ({row.get('featureId')})")
    if len(missing) > 25:
        print(f"  … and {len(missing) - 25} more")

    return 1 if empty else 0


if __name__ == "__main__":
    raise SystemExit(main())

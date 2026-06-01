"""
Audit racial trait `rules.select` and class build-option coverage in rules_index.json.

Usage (from repo root):
  python tools/etl/list_race_class_selection_gaps.py
  python tools/etl/list_race_class_selection_gaps.py --json
  python tools/etl/list_race_class_selection_gaps.py path/to/rules_index.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _racial_power_select_index_summary(
    racial_traits: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Traits with ETL power-select metadata (SC-030 / SC-031)."""
    rows: List[Dict[str, Any]] = []
    for trait in racial_traits:
        cat = trait.get("powerSelectCategory")
        if not cat and not trait.get("grantsBonusClassAtWillByDefault"):
            continue
        rows.append(
            {
                "id": trait.get("id"),
                "name": trait.get("name"),
                "powerSelectCategory": cat,
                "grantsBonusClassAtWill": trait.get("grantsBonusClassAtWill"),
                "grantsBonusClassAtWillByDefault": trait.get("grantsBonusClassAtWillByDefault"),
                "powerUsageOverride": trait.get("powerUsageOverride"),
                "powerBundleMode": trait.get("powerBundleMode"),
            }
        )
    return rows


def _racial_trait_select_gaps(racial_traits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    gaps: List[Dict[str, Any]] = []
    for trait in racial_traits:
        raw = trait.get("raw") or {}
        rules = raw.get("rules") if isinstance(raw, dict) else None
        if not isinstance(rules, dict):
            continue
        selects = rules.get("select") or []
        if not selects:
            continue
        kinds = sorted(
            {
                str((s.get("attrs") or {}).get("type") or "?")
                for s in selects
                if isinstance(s, dict)
            }
        )
        gaps.append(
            {
                "id": trait.get("id"),
                "name": trait.get("name"),
                "selectTypes": kinds,
            }
        )
    return gaps


def _class_build_gaps(
    classes: List[Dict[str, Any]],
    class_build_options_by_class_id: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, List[Dict[str, Any]]]:
    missing_mechanical: List[Dict[str, Any]] = []
    text_only: List[Dict[str, Any]] = []
    for cls in classes:
        cid = cls.get("id")
        if not cid:
            continue
        raw = cls.get("raw") or {}
        spec = raw.get("specific") if isinstance(raw, dict) else {}
        bo = ""
        if isinstance(spec, dict):
            bo = str(spec.get("Build Options") or "").strip()
        opts = class_build_options_by_class_id.get(cid) or []
        rules = raw.get("rules") if isinstance(raw, dict) else {}
        has_build_select = False
        if isinstance(rules, dict):
            for item in rules.get("select") or []:
                if (item.get("attrs") or {}).get("type") == "Build":
                    has_build_select = True
                    break
        if opts:
            continue
        if bo or has_build_select:
            text_only.append(
                {
                    "id": cid,
                    "name": cls.get("name"),
                    "buildOptionsText": bo or None,
                    "hasBuildSelectRule": has_build_select,
                }
            )
        elif cls.get("name"):
            missing_mechanical.append({"id": cid, "name": cls.get("name")})

    return {"buildTextButNoOptions": text_only, "noBuildDataInCompendium": missing_mechanical}


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
    racial_traits = data.get("racialTraits") or []
    racial_select = _racial_trait_select_gaps(racial_traits)
    racial_power_select = _racial_power_select_index_summary(racial_traits)
    class_gaps = _class_build_gaps(
        data.get("classes") or [],
        data.get("classBuildOptionsByClassId") or {},
    )

    report = {
        "racialTraitsWithSelectRules": racial_select,
        "racialPowerSelectIndexFields": racial_power_select,
        "classBuildGaps": class_gaps,
    }

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    print("=== Racial traits with rules.select ===")
    print(f"count: {len(racial_select)}")
    for row in racial_select[:30]:
        print(f"  {row['name']}: {', '.join(row['selectTypes'])}")
    if len(racial_select) > 30:
        print(f"  … and {len(racial_select) - 30} more")

    print("\n=== Racial traits with power-select index metadata ($$CLASS / $$NOT_CLASS, bundles) ===")
    print(f"count: {len(racial_power_select)}")
    for row in racial_power_select[:20]:
        flags = []
        if row.get("grantsBonusClassAtWill"):
            flags.append("bonusAtWill")
        if row.get("grantsBonusClassAtWillByDefault"):
            flags.append("humanDefault")
        if row.get("powerUsageOverride"):
            flags.append(f"usage={row['powerUsageOverride']}")
        if row.get("powerBundleMode"):
            flags.append(row["powerBundleMode"])
        cat = row.get("powerSelectCategory") or ""
        print(f"  {row['name']}: {cat} [{', '.join(flags)}]")
    if len(racial_power_select) > 20:
        print(f"  … and {len(racial_power_select) - 20} more")

    print("\n=== Classes with Build Options text or Build select but no indexed options ===")
    for row in class_gaps["buildTextButNoOptions"]:
        print(f"  {row['name']}: text={row['buildOptionsText']!r} buildSelect={row['hasBuildSelectRule']}")
    if not class_gaps["buildTextButNoOptions"]:
        print("  (none)")

    print("\n=== Sample classes with no build data in compendium (no text, no options) ===")
    for row in class_gaps["noBuildDataInCompendium"][:15]:
        print(f"  {row['name']}")
    rest = len(class_gaps["noBuildDataInCompendium"]) - 15
    if rest > 0:
        print(f"  … and {rest} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
Validate racial-trait Power select categories vs ETL index fields (SC-030, SC-031).

Usage (from repo root):
  python tools/etl/validate_power_select_categories.py
  python tools/etl/validate_power_select_categories.py path/to/rules_index.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _power_select_category_from_raw(trait: Dict[str, Any]) -> str:
    raw = trait.get("raw") or {}
    rules = raw.get("rules") if isinstance(raw, dict) else None
    if not isinstance(rules, dict):
        return ""
    for item in rules.get("select") or []:
        if not isinstance(item, dict):
            continue
        attrs = item.get("attrs") or {}
        if str(attrs.get("type") or "") != "Power":
            continue
        return str(attrs.get("Category") or "").strip()
    return ""


def validate_racial_traits(racial_traits: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    for trait in racial_traits:
        tid = trait.get("id") or "?"
        name = trait.get("name") or tid
        raw_cat = _power_select_category_from_raw(trait)
        indexed_cat = str(trait.get("powerSelectCategory") or "").strip()
        cat = (indexed_cat or raw_cat).lower()

        if raw_cat.startswith("$$") and not indexed_cat:
            warnings.append(f"{name} ({tid}): raw $$ category not copied to powerSelectCategory")

        if not cat:
            continue

        if cat.startswith("$$not_class,at-will,1"):
            if trait.get("powerUsageOverride") != "Encounter":
                errors.append(
                    f"{name} ({tid}): dilettante category requires powerUsageOverride Encounter"
                )
            continue

        if cat.startswith("$$class,at-will,1"):
            if not trait.get("grantsBonusClassAtWill"):
                errors.append(
                    f"{name} ({tid}): bonus at-will category requires grantsBonusClassAtWill"
                )
            continue

        if cat.startswith("$$"):
            warnings.append(f"{name} ({tid}): unhandled dynamic category {raw_cat or indexed_cat!r}")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "rules_index",
        nargs="?",
        default=str(_repo_root() / "generated" / "rules_index.json"),
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON report")
    args = parser.parse_args()

    path = Path(args.rules_index)
    if not path.is_file():
        print(f"rules index not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    errors, warnings = validate_racial_traits(data.get("racialTraits") or [])

    report = {"errors": errors, "warnings": warnings, "ok": not errors}
    if args.json:
        print(json.dumps(report, indent=2))
        return 1 if errors else 0

    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print(f"Errors ({len(errors)}):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("OK: racial power select categories validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
Report feats whose raw `rules.modify` rows are not reflected in indexed modification fields.

Usage (from repo root):
  python tools/etl/audit_feat_modify_gaps.py
  python tools/etl/audit_feat_modify_gaps.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import extract_feat_power_modifications  # noqa: E402


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _raw_modify_rows(feat: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = feat.get("raw")
    if not isinstance(raw, dict):
        return []
    rules = raw.get("rules")
    if not isinstance(rules, dict):
        return []
    return [r for r in rules.get("modify") or [] if isinstance(r, dict)]


def _has_indexed_modifications(feat: Dict[str, Any]) -> bool:
    return bool(
        feat.get("powerModifications")
        or feat.get("modifiedPowerIds")
        or feat.get("weaponModifications")
        or feat.get("modifiedWeaponNames")
        or feat.get("armorModifications")
        or feat.get("modifiedArmorNames")
    )


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
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    feats: List[Dict[str, Any]] = data.get("feats") or []
    powers = data.get("powers") or []
    power_id_to_name = {str(p.get("id")): str(p.get("name")) for p in powers if p.get("id")}
    weapons = data.get("weapons") or []
    weapon_name_to_id = {
        str(w.get("name", "")).strip().lower(): str(w.get("id"))
        for w in weapons
        if w.get("name") and w.get("id")
    }

    gaps: List[Dict[str, Any]] = []
    type_counter: Counter[str] = Counter()

    for feat in feats:
        raw_rows = _raw_modify_rows(feat)
        if not raw_rows:
            continue
        if _has_indexed_modifications(feat):
            continue
        reparsed = extract_feat_power_modifications(
            feat.get("raw") or {},
            {},
            {},
            power_id_to_name,
            {},
            weapon_name_to_id,
            feat.get("grantedPowerIds"),
        )
        if reparsed.get("powerModifications") or reparsed.get("weaponModifications") or reparsed.get("armorModifications"):
            continue
        row = {"id": feat.get("id"), "name": feat.get("name"), "modifyCount": len(raw_rows)}
        gaps.append(row)
        for m in raw_rows:
            attrs = (m or {}).get("attrs") or {}
            gtype = str(attrs.get("type") or "").strip().lower() or "(missing)"
            name = str(attrs.get("name") or "")[:50]
            type_counter[(gtype, name)] += 1

    print(f"Feats with modify rules: {sum(1 for f in feats if _raw_modify_rows(f))}", file=sys.stderr)
    print(f"Modify gaps (no indexed modifications): {len(gaps)}", file=sys.stderr)
    if type_counter:
        print("Unindexed modify row samples:", file=sys.stderr)
        for (t, n), c in type_counter.most_common(15):
            print(f"  {c:3} {t!r} | {n!r}", file=sys.stderr)

    payload = {"gapCount": len(gaps), "gaps": gaps}
    if args.json:
        print(json.dumps(payload, indent=2))
    elif gaps:
        for row in gaps:
            print(f"{row['id']}\t{row['name']}\t{row['modifyCount']} modify rows")

    return 0 if not gaps else 1


if __name__ == "__main__":
    raise SystemExit(main())

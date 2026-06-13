"""
Report feats whose raw `rules.replace` rows are not reflected in indexed replace fields.

Usage (from repo root):
  python tools/etl/audit_feat_replace_gaps.py
  python tools/etl/audit_feat_replace_gaps.py --json
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

from build_rules_index import (  # noqa: E402
    _build_power_id_to_name,
    _build_power_name_to_id,
    _build_power_normalized_name_to_id,
    extract_feat_multiclass_slot_swap_offers,
    extract_feat_power_replace_offers,
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _raw_replace_rows(feat: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = feat.get("raw")
    if not isinstance(raw, dict):
        return []
    rules = raw.get("rules")
    if not isinstance(rules, dict):
        return []
    rows = rules.get("replace") or []
    return [r for r in rows if isinstance(r, dict)]


def _indexed_replace_rows(feat: Dict[str, Any]) -> int:
    offers = feat.get("powerReplaceOffers") or []
    rules = feat.get("powerReplacementRules") or []
    mc = feat.get("multiclassSlotSwapOffers") or []
    return len(offers) + len(rules) + (1 if mc else 0)


def _reparse_replace(
    feat: Dict[str, Any],
    power_name_to_id: Dict[str, str],
    power_normalized_to_id: Dict[str, str],
    power_id_to_name: Dict[str, str],
    powers_raw: List[Dict[str, Any]],
) -> Dict[str, Any]:
    raw = feat.get("raw")
    if not isinstance(raw, dict):
        return {}
    merged: Dict[str, Any] = {}
    merged.update(
        extract_feat_power_replace_offers(
            raw,
            power_name_to_id,
            power_id_to_name,
            power_normalized_to_id,
            powers_raw,
        )
    )
    merged.update(extract_feat_multiclass_slot_swap_offers(raw))
    return merged


def _uncaptured_replace_rows(feat: Dict[str, Any], reparsed: Dict[str, Any]) -> List[Dict[str, str]]:
    raw_rows = _raw_replace_rows(feat)
    if not raw_rows:
        return []
    if _indexed_replace_rows({**feat, **reparsed}) > 0:
        return []
    out: List[Dict[str, str]] = []
    for row in raw_rows:
        attrs = row.get("attrs") or {}
        pr = str(attrs.get("power-replace") or "").strip()
        mc = str(attrs.get("multiclass") or "").strip()
        if pr:
            out.append({"kind": "power-replace", "value": pr})
        elif mc:
            out.append({"kind": "multiclass", "value": mc})
        else:
            out.append({"kind": "replace", "value": str(attrs.get("name") or "")})
    return out


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
    powers_raw = [
        f.get("raw")
        for f in (data.get("powers") or [])
        if isinstance(f.get("raw"), dict)
    ]
    power_name_to_id = _build_power_name_to_id(powers_raw)
    power_normalized_to_id = _build_power_normalized_name_to_id(powers_raw)
    power_id_to_name = _build_power_id_to_name(powers_raw)

    gaps: List[Dict[str, Any]] = []
    kind_counter: Counter[str] = Counter()

    for feat in feats:
        raw_rows = _raw_replace_rows(feat)
        if not raw_rows:
            continue
        if _indexed_replace_rows(feat) > 0:
            continue
        reparsed = _reparse_replace(
            feat, power_name_to_id, power_normalized_to_id, power_id_to_name, powers_raw
        )
        uncaptured = _uncaptured_replace_rows(feat, reparsed)
        if not uncaptured:
            continue
        row = {
            "id": feat.get("id"),
            "name": feat.get("name"),
            "rawReplaceCount": len(raw_rows),
            "unindexedReplaceRows": uncaptured,
        }
        gaps.append(row)
        for item in uncaptured:
            kind_counter[item["kind"]] += 1

    summary = {
        "featsWithReplaceRules": sum(1 for f in feats if _raw_replace_rows(f)),
        "gapFeats": len(gaps),
        "unindexedReplaceRowsByKind": dict(kind_counter),
        "gapFeatRows": gaps,
    }

    print(f"Feats with replace rules: {summary['featsWithReplaceRules']}", file=sys.stderr)
    print(f"Gap feats (0 indexed replace): {summary['gapFeats']}", file=sys.stderr)
    if kind_counter:
        print("Unindexed replace row kinds:", file=sys.stderr)
        for k, n in kind_counter.most_common():
            print(f"  {k}: {n}", file=sys.stderr)

    if args.json:
        print(json.dumps(summary, indent=2))
    elif gaps:
        for row in gaps:
            print(f"{row['id']}\t{row['name']}\t{len(row['unindexedReplaceRows'])} unindexed")

    return 0 if not gaps else 1


if __name__ == "__main__":
    raise SystemExit(main())

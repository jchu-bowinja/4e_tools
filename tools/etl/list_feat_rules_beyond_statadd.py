"""
List feats whose compendium `raw.rules` contains keys other than `statadd`
(replace, modify, grant, textstring, select, etc.).

Usage (from repo root):
  python tools/etl/list_feat_rules_beyond_statadd.py
  python tools/etl/list_feat_rules_beyond_statadd.py path/to/rules_index.json
  python tools/etl/list_feat_rules_beyond_statadd.py --summary-only
  python tools/etl/list_feat_rules_beyond_statadd.py --json
  python tools/etl/list_feat_rules_beyond_statadd.py --json -o generated/feat_heavy_rules.json
  python tools/etl/list_feat_rules_beyond_statadd.py --key-combo-top 15

See tools/etl/FEAT_RULES_COVERAGE.md for how this fits ETL and app coverage.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _rules_extra_keys(rules: Any) -> Tuple[Set[str], bool]:
    """Return (keys other than statadd, had_rules_dict)."""
    if not isinstance(rules, dict):
        return set(), False
    extra = {k for k in rules.keys() if k != "statadd"}
    return extra, True


def _feat_rules_snapshot(feats: List[Dict[str, Any]]) -> Dict[str, int]:
    """Counts for stderr summary (all feats with usable raw)."""
    total = len(feats)
    raw_missing = 0
    rules_missing_or_bad = 0
    rules_only_statadd = 0
    rules_empty_dict = 0
    for feat in feats:
        raw = feat.get("raw")
        if not isinstance(raw, dict):
            raw_missing += 1
            continue
        rules = raw.get("rules")
        if not isinstance(rules, dict):
            rules_missing_or_bad += 1
            continue
        keys = set(rules.keys())
        if not keys:
            rules_empty_dict += 1
            continue
        if keys <= {"statadd"}:
            rules_only_statadd += 1
    return {
        "total": total,
        "raw_missing": raw_missing,
        "rules_missing_or_bad": rules_missing_or_bad,
        "rules_empty_dict": rules_empty_dict,
        "rules_only_statadd": rules_only_statadd,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "rules_index",
        nargs="?",
        default=str(_repo_root() / "generated" / "rules_index.json"),
        help="Path to rules_index.json (default: generated/rules_index.json from repo root)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print a JSON array of {id, name, slug, source, extraRuleKeys, hasStatadd} instead of a table",
    )
    parser.add_argument(
        "-o",
        "--output",
        metavar="FILE",
        help="Write JSON output to FILE (implies --json body); still prints summary to stderr",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="Print only the summary block to stderr (no TSV / JSON body on stdout)",
    )
    parser.add_argument(
        "--key-combo-top",
        type=int,
        metavar="N",
        default=0,
        help="After per-key counts, print the N most common extra-key combinations (comma-sorted)",
    )
    args = parser.parse_args()

    path = Path(args.rules_index)
    if not path.is_file():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    feats: List[Dict[str, Any]] = data.get("feats") or []

    snap = _feat_rules_snapshot(feats)
    print("Feat raw.rules snapshot (all feats):", file=sys.stderr)
    print(f"  total feats: {snap['total']}", file=sys.stderr)
    print(f"  raw not an object: {snap['raw_missing']}", file=sys.stderr)
    print(f"  rules missing or non-object: {snap['rules_missing_or_bad']}", file=sys.stderr)
    print(f"  rules {{}} (empty): {snap['rules_empty_dict']}", file=sys.stderr)
    print(f"  rules keys are only statadd (no grant/modify/...): {snap['rules_only_statadd']}", file=sys.stderr)
    print("", file=sys.stderr)

    rows: List[Dict[str, Any]] = []
    key_counter: Counter[str] = Counter()
    combo_counter: Counter[str] = Counter()
    with_statadd = 0
    without_statadd = 0

    for feat in feats:
        raw = feat.get("raw")
        if not isinstance(raw, dict):
            continue
        rules = raw.get("rules")
        extra, had_dict = _rules_extra_keys(rules)
        if not had_dict or not extra:
            continue
        statadd = rules.get("statadd") if isinstance(rules, dict) else None
        has_statadd = bool(statadd)
        if has_statadd:
            with_statadd += 1
        else:
            without_statadd += 1
        for k in sorted(extra):
            key_counter[k] += 1
        combo_counter[",".join(sorted(extra))] += 1
        rows.append(
            {
                "id": feat.get("id"),
                "name": feat.get("name"),
                "slug": feat.get("slug"),
                "source": feat.get("source"),
                "extraRuleKeys": sorted(extra),
                "hasStatadd": has_statadd,
            }
        )

    rows.sort(key=lambda r: (r.get("name") or ""))

    print(
        f"Feats with raw.rules keys beyond 'statadd': {len(rows)} / {len(feats)}",
        file=sys.stderr,
    )
    if rows:
        print(
            f"  Of those, also have statadd: {with_statadd}; extra keys only (no statadd): {without_statadd}",
            file=sys.stderr,
        )
    if key_counter:
        print("Per-key feat counts (non-statadd keys):", file=sys.stderr)
        for k, n in key_counter.most_common():
            print(f"  {k}: {n}", file=sys.stderr)
    else:
        print("  (none)", file=sys.stderr)

    n_top = int(args.key_combo_top or 0)
    if n_top > 0 and combo_counter:
        print(f"Top {n_top} extra-key combinations (feat count):", file=sys.stderr)
        for combo, n in combo_counter.most_common(n_top):
            print(f"  [{combo}]: {n}", file=sys.stderr)

    out_payload = rows
    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out_payload, indent=2), encoding="utf-8")
        print(f"Wrote {len(rows)} rows to {out_path}", file=sys.stderr)

    if args.summary_only:
        return 0

    if args.json or args.output:
        print(json.dumps(out_payload, indent=2))
    else:
        for r in rows:
            keys = ", ".join(r["extraRuleKeys"])
            stat = "statadd+" if r["hasStatadd"] else "no statadd"
            print(f"{r['id']}\t{keys}\t{stat}\t{r.get('name')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

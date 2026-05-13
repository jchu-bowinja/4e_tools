"""
List feats whose compendium `raw.rules` contains keys other than `statadd`
(replace, modify, grant, textstring, select, etc.).

Usage (from repo root):
  python tools/etl/list_feat_rules_beyond_statadd.py
  python tools/etl/list_feat_rules_beyond_statadd.py path/to/rules_index.json
  python tools/etl/list_feat_rules_beyond_statadd.py --json
  python tools/etl/list_feat_rules_beyond_statadd.py --json -o generated/feat_heavy_rules.json
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
    args = parser.parse_args()

    path = Path(args.rules_index)
    if not path.is_file():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    feats: List[Dict[str, Any]] = data.get("feats") or []

    rows: List[Dict[str, Any]] = []
    key_counter: Counter[str] = Counter()

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
        for k in sorted(extra):
            key_counter[k] += 1
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
    if key_counter:
        print("Per-key feat counts (non-statadd keys):", file=sys.stderr)
        for k, n in key_counter.most_common():
            print(f"  {k}: {n}", file=sys.stderr)
    else:
        print("  (none)", file=sys.stderr)

    out_payload = rows
    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out_payload, indent=2), encoding="utf-8")
        print(f"Wrote {len(rows)} rows to {out_path}", file=sys.stderr)

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

#!/usr/bin/env python3
"""Copy keywords and sourceBooks from entry JSON into monsters/index.json for list filters."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    monsters_dir = repo_root / "generated" / "monsters"
    index_path = monsters_dir / "index.json"
    entries_dir = monsters_dir / "entries"

    if not index_path.is_file():
        print(f"Missing {index_path}", file=sys.stderr)
        return 1

    index = json.loads(index_path.read_text(encoding="utf-8"))
    rows = index.get("monsters")
    if not isinstance(rows, list):
        print("Invalid index format: monsters[]", file=sys.stderr)
        return 1

    missing = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        monster_id = str(row.get("id") or "").strip()
        entry_path = entries_dir / f"{monster_id}.json"
        if not entry_path.is_file():
            missing += 1
            row["keywords"] = []
            row["sourceBooks"] = []
            continue
        entry = json.loads(entry_path.read_text(encoding="utf-8"))
        keywords = entry.get("keywords")
        source_books = entry.get("sourceBooks")
        row["keywords"] = keywords if isinstance(keywords, list) else []
        row["sourceBooks"] = source_books if isinstance(source_books, list) else []

    meta = index.setdefault("meta", {})
    if isinstance(meta, dict):
        meta["version"] = 5

    index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Enriched {len(rows)} index rows ({missing} without entry files).")
    print(f"Wrote {index_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

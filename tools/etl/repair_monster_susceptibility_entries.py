"""
Repair split resistance/weakness names in generated monster entry JSON.

Usage (from repo root):
  python tools/etl/repair_monster_susceptibility_entries.py
  python tools/etl/repair_monster_susceptibility_entries.py generated/monsters/entries
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_monster_index import _repair_susceptibility_row  # noqa: E402


def _repair_list(rows: list) -> tuple[list, bool]:
    out = []
    changed = False
    for row in rows:
        if not isinstance(row, dict):
            out.append(row)
            continue
        fixed = _repair_susceptibility_row(row)
        if fixed != row:
            changed = True
        out.append(fixed)
    return out, changed


def repair_entry(entry: dict) -> bool:
    changed = False
    for key in ("resistances", "weaknesses"):
        rows = entry.get(key)
        if not isinstance(rows, list):
            continue
        fixed, key_changed = _repair_list(rows)
        if key_changed:
            entry[key] = fixed
            changed = True
    return changed


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("generated/monsters/entries")
    if not root.is_dir():
        print(f"error: directory not found: {root}", file=sys.stderr)
        return 1

    changed_files = 0
    for path in sorted(root.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if repair_entry(data):
            path.write_text(
                json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            changed_files += 1

    print(f"Repaired susceptibility rows in {changed_files} monster entries under {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

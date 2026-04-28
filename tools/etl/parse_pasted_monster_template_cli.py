#!/usr/bin/env python3
"""CLI: read pasted template text from stdin; optional template name hint as argv[1]. Prints JSON."""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ETL_DIR = Path(__file__).resolve().parent
if str(_ETL_DIR) not in sys.path:
    sys.path.insert(0, str(_ETL_DIR))

from extract_monster_templates_from_pdfs import parse_pasted_monster_template  # noqa: E402


def main() -> None:
    hint = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1].strip() else None
    raw = sys.stdin.read()
    out = parse_pasted_monster_template(raw, hint)
    sys.stdout.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()

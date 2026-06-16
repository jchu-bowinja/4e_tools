"""Declarative data overlay for the rules index.

Loads JSON files from ``tools/etl/overrides/*.json`` and merges authored
behavior onto parsed compendium rows and global config tables, so that
entity-specific behavior lives in *data* rather than in Python/TS code.

Overlay file shape::

    {
      "<collection>": { "<entityId>": { ...fields to merge onto the row... } },
      "global": { "<key>": <value> }
    }

``<collection>`` matches a top-level ``rules_index.json`` array
(e.g. ``"racialTraits"``, ``"classFeatures"``, ``"themes"``). The ``"global"``
section holds cross-entity config tables (psionic power points, name aliases,
etc.). Multiple files are deep-merged together in filename order.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


# Top-level entity arrays in rules_index.json that overlays may target by id.
ENTITY_COLLECTIONS = frozenset(
    {
        "races",
        "classes",
        "feats",
        "powers",
        "skills",
        "languages",
        "racialTraits",
        "classFeatures",
        "armors",
        "weapons",
        "implements",
        "abilityScores",
        "themes",
        "paragonPaths",
        "epicDestinies",
        "hybridClasses",
        "proficiencies",
        "backgrounds",
        "magicItems",
        "gear",
        "rituals",
        "martialPractices",
        "alchemyItems",
    }
)


def _deep_merge(base: Any, overlay: Any) -> Any:
    """Recursively merge ``overlay`` onto ``base`` (dicts merge; else replace)."""
    if isinstance(base, dict) and isinstance(overlay, dict):
        out: Dict[str, Any] = dict(base)
        for key, value in overlay.items():
            out[key] = _deep_merge(out[key], value) if key in out else value
        return out
    return overlay


class Overlay:
    """Loaded, deep-merged overlay data with entity- and global-level access."""

    def __init__(
        self,
        entities: Dict[str, Dict[str, Dict[str, Any]]],
        globals_: Dict[str, Any],
        sources: List[str],
    ) -> None:
        self.entities = entities
        self.globals = globals_
        self.sources = sources

    # --- global config ---------------------------------------------------
    def global_value(self, key: str, default: Any = None) -> Any:
        return self.globals.get(key, default)

    # --- entity merges ---------------------------------------------------
    def entity_overrides(self, collection: str) -> Dict[str, Dict[str, Any]]:
        return self.entities.get(collection, {})

    def apply_to_rows(self, collection: str, rows: Iterable[Dict[str, Any]]) -> int:
        """Deep-merge overlay fields onto already-built index rows by ``id``.

        Returns the number of rows that received an override.
        """
        by_id = self.entities.get(collection)
        if not by_id:
            return 0
        applied = 0
        for row in rows:
            rid = str(row.get("id") or "")
            if rid and rid in by_id:
                merged = _deep_merge(row, by_id[rid])
                row.clear()
                row.update(merged)
                applied += 1
        return applied

    def validate(
        self,
        known_ids_by_collection: Dict[str, Iterable[str]],
        anomalies: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """Report overlay entity ids that do not exist in the parsed index.

        Appends ``{"kind": "overlay_unknown_id", ...}`` rows to ``anomalies``
        (if provided) and returns the list of issues found.
        """
        issues: List[Dict[str, Any]] = []
        for collection, by_id in self.entities.items():
            known = known_ids_by_collection.get(collection)
            if known is None:
                continue
            known_set = set(known)
            for rid in by_id:
                if rid not in known_set:
                    issue = {
                        "kind": "overlay_unknown_id",
                        "collection": collection,
                        "id": rid,
                    }
                    issues.append(issue)
                    if anomalies is not None:
                        anomalies.append(issue)
        return issues


def load_overlay(overrides_dir: Path) -> Overlay:
    """Load and deep-merge every ``*.json`` under ``overrides_dir``."""
    entities: Dict[str, Dict[str, Dict[str, Any]]] = {}
    globals_: Dict[str, Any] = {}
    sources: List[str] = []
    if not overrides_dir.exists():
        return Overlay(entities, globals_, sources)
    for path in sorted(overrides_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:  # pragma: no cover - surfaced loudly
            raise ValueError(f"Invalid overlay JSON in {path}: {exc}") from exc
        if not isinstance(data, dict):
            raise ValueError(f"Overlay file {path} must contain a JSON object")
        sources.append(path.name)
        for key, value in data.items():
            if key == "global":
                globals_ = _deep_merge(globals_, value or {})
            elif key in ENTITY_COLLECTIONS:
                existing = entities.get(key, {})
                entities[key] = _deep_merge(existing, value or {})
            else:
                raise ValueError(
                    f"Overlay file {path} has unknown top-level key '{key}'. "
                    f"Expected 'global' or one of: {sorted(ENTITY_COLLECTIONS)}"
                )
    return Overlay(entities, globals_, sources)

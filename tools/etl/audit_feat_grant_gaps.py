"""
Report feats whose raw `rules.grant` rows are not reflected in indexed grant fields.

Usage (from repo root):
  python tools/etl/audit_feat_grant_gaps.py
  python tools/etl/audit_feat_grant_gaps.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import extract_grants_from_rules  # noqa: E402


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _indexed_snapshot(feat: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "grantedPowerIds": list(feat.get("grantedPowerIds") or []),
        "grantedClassFeatureIds": list(feat.get("grantedClassFeatureIds") or []),
        "grantedRacialTraitIds": list(feat.get("grantedRacialTraitIds") or []),
        "proficiencyGrants": list(feat.get("proficiencyGrants") or []),
        "hasMulticlassGrant": bool(feat.get("hasMulticlassGrant")),
        "countsAsClassNames": list(feat.get("countsAsClassNames") or []),
        "countsAsClassIds": list(feat.get("countsAsClassIds") or []),
        "internalGrantKeys": list(feat.get("internalGrantKeys") or []),
        "grantedSkillTrainingNames": list(feat.get("grantedSkillTrainingNames") or []),
        "grantedSkillTrainingIds": list(feat.get("grantedSkillTrainingIds") or []),
        "countsAsFeatureNames": list(feat.get("countsAsFeatureNames") or []),
        "countsAsFeatureIds": list(feat.get("countsAsFeatureIds") or []),
        "grantedLanguageNames": list(feat.get("grantedLanguageNames") or []),
        "grantedLanguageIds": list(feat.get("grantedLanguageIds") or []),
    }


def _has_any_indexed_grant(snapshot: Dict[str, Any]) -> bool:
    return any(
        [
            snapshot["grantedPowerIds"],
            snapshot["grantedClassFeatureIds"],
            snapshot["grantedRacialTraitIds"],
            snapshot["proficiencyGrants"],
            snapshot["hasMulticlassGrant"],
            snapshot["countsAsClassNames"],
            snapshot["internalGrantKeys"],
            snapshot["grantedSkillTrainingNames"],
            snapshot["countsAsFeatureNames"],
            snapshot["grantedLanguageIds"],
        ]
    )


def _raw_grant_rows(feat: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = feat.get("raw")
    if not isinstance(raw, dict):
        return []
    rules = raw.get("rules")
    if not isinstance(rules, dict):
        return []
    rows = rules.get("grant") or []
    return [r for r in rows if isinstance(r, dict)]


def _reparse_grants(feat: Dict[str, Any], language_id_to_name: Dict[str, str]) -> Dict[str, Any]:
    raw = feat.get("raw")
    rules = raw.get("rules") if isinstance(raw, dict) else None
    return extract_grants_from_rules(rules, language_id_to_name=language_id_to_name)


def _diff_unindexed_rows(
    raw_rows: List[Dict[str, Any]],
    indexed: Dict[str, Any],
) -> List[Dict[str, str]]:
    """Return raw grant rows not represented in indexed fields (best-effort)."""
    unindexed: List[Dict[str, str]] = []
    power_ids = set(indexed.get("grantedPowerIds") or [])
    feature_ids = set(indexed.get("grantedClassFeatureIds") or [])
    trait_ids = set(indexed.get("grantedRacialTraitIds") or [])
    internal = set(indexed.get("internalGrantKeys") or [])
    skill_names = set(indexed.get("grantedSkillTrainingNames") or [])
    counts_class = set(indexed.get("countsAsClassNames") or [])
    counts_feat = set(indexed.get("countsAsFeatureNames") or [])
    language_ids = set(indexed.get("grantedLanguageIds") or [])
    prof_keys = {
        f"{p.get('kind')}:{p.get('value')}"
        for p in (indexed.get("proficiencyGrants") or [])
        if isinstance(p, dict)
    }
    has_mc = bool(indexed.get("hasMulticlassGrant"))

    for gr in raw_rows:
        attrs = gr.get("attrs") or {}
        name = str(attrs.get("name") or "")
        gtype = str(attrs.get("type") or "").strip().lower()
        if not gtype and name.startswith("ID_") and "_POWER_" in name.upper():
            gtype = "power"
        captured = False
        if gtype == "proficiency" and name.startswith("ID_INTERNAL_PROFICIENCY_"):
            captured = bool(prof_keys)
        elif gtype == "multiclass" or name == "ID_INTERNAL_MULTICLASS_MULTICLASS":
            captured = has_mc
        elif gtype == "countsasclass":
            captured = bool(counts_class)
        elif gtype in {"internal", "vision", "grants"}:
            captured = bool(internal)
        elif gtype == "skill training":
            captured = bool(skill_names)
        elif gtype == "countsasfeature":
            captured = bool(counts_feat)
        elif gtype == "language":
            captured = name in language_ids
        elif gtype == "power" and name in power_ids:
            captured = True
        elif gtype == "class feature" and name in feature_ids:
            captured = True
        elif gtype == "racial trait" and name in trait_ids:
            captured = True
        if not captured:
            unindexed.append({"type": gtype or "(missing)", "name": name})
    return unindexed


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
    languages = data.get("languages") or []
    language_id_to_name = {
        str(lang.get("id")): str(lang.get("name"))
        for lang in languages
        if lang.get("id") and lang.get("name")
    }

    full_gaps: List[Dict[str, Any]] = []
    partial_gaps: List[Dict[str, Any]] = []
    type_counter: Counter[str] = Counter()

    for feat in feats:
        raw_rows = _raw_grant_rows(feat)
        if not raw_rows:
            continue
        indexed = _indexed_snapshot(feat)
        unindexed = _diff_unindexed_rows(raw_rows, indexed)
        if not unindexed:
            continue
        reparsed = _reparse_grants(feat, language_id_to_name)
        still_unindexed = _diff_unindexed_rows(raw_rows, reparsed)
        row = {
            "id": feat.get("id"),
            "name": feat.get("name"),
            "rawGrantCount": len(raw_rows),
            "indexedGrantCount": sum(
                [
                    len(indexed["grantedPowerIds"]),
                    len(indexed["grantedClassFeatureIds"]),
                    len(indexed["grantedRacialTraitIds"]),
                    len(indexed["proficiencyGrants"]),
                    len(indexed["internalGrantKeys"]),
                    len(indexed["grantedSkillTrainingNames"]),
                    len(indexed["countsAsFeatureNames"]),
                    len(indexed["grantedLanguageIds"]),
                    1 if indexed["hasMulticlassGrant"] else 0,
                    len(indexed["countsAsClassNames"]),
                ]
            ),
            "unindexedGrants": still_unindexed,
        }
        for item in still_unindexed:
            type_counter[item["type"]] += 1
        if not _has_any_indexed_grant(indexed):
            full_gaps.append(row)
        else:
            partial_gaps.append(row)

    summary = {
        "featsWithGrantRules": sum(1 for f in feats if _raw_grant_rows(f)),
        "fullGaps": len(full_gaps),
        "partialGaps": len(partial_gaps),
        "unindexedGrantRowsByType": dict(type_counter),
        "fullGapFeats": full_gaps,
        "partialGapFeats": partial_gaps,
    }

    print(f"Feats with grant rules: {summary['featsWithGrantRules']}", file=sys.stderr)
    print(f"Full gaps (0 indexed grants): {summary['fullGaps']}", file=sys.stderr)
    print(f"Partial gaps (some unindexed rows): {summary['partialGaps']}", file=sys.stderr)
    if type_counter:
        print("Unindexed grant row types:", file=sys.stderr)
        for k, n in type_counter.most_common():
            print(f"  {k}: {n}", file=sys.stderr)

    if args.json:
        print(json.dumps(summary, indent=2))
    elif full_gaps or partial_gaps:
        for row in full_gaps + partial_gaps:
            print(f"{row['id']}\t{row['name']}\t{len(row['unindexedGrants'])} unindexed")

    return 0 if not (full_gaps or partial_gaps) else 1


if __name__ == "__main__":
    raise SystemExit(main())

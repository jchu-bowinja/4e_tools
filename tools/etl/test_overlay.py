import json
import tempfile
import unittest
from pathlib import Path

from overlay import Overlay, load_overlay
from build_rules_index import (
    _OVERLAY,
    _role_progression_from_name,
    _ritual_casting_feature_names,
    _ritual_caster_feat_names,
    _tag_school_progression_choice_groups,
)


class OverlayLoadMergeTest(unittest.TestCase):
    def _write(self, dir_path: Path, name: str, data: dict) -> None:
        (dir_path / name).write_text(json.dumps(data), encoding="utf-8")

    def test_deep_merges_entities_and_globals_across_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            self._write(
                d,
                "a.json",
                {
                    "classFeatures": {"ID_X": {"spellbookKind": "wizard"}},
                    "global": {"table": {"1": 1}},
                },
            )
            self._write(
                d,
                "b.json",
                {
                    "classFeatures": {"ID_X": {"spellbookPowerPicksPerPool": 2}},
                    "global": {"table": {"2": 2}},
                },
            )
            ovl = load_overlay(d)
            merged = ovl.entity_overrides("classFeatures")["ID_X"]
            self.assertEqual(merged["spellbookKind"], "wizard")
            self.assertEqual(merged["spellbookPowerPicksPerPool"], 2)
            self.assertEqual(ovl.global_value("table"), {"1": 1, "2": 2})

    def test_apply_to_rows_merges_by_id(self):
        ovl = Overlay({"classFeatures": {"ID_X": {"spellbookKind": "mage"}}}, {}, [])
        rows = [{"id": "ID_X", "name": "Spellbook"}, {"id": "ID_Y"}]
        applied = ovl.apply_to_rows("classFeatures", rows)
        self.assertEqual(applied, 1)
        self.assertEqual(rows[0]["spellbookKind"], "mage")
        self.assertNotIn("spellbookKind", rows[1])

    def test_validate_reports_unknown_ids(self):
        ovl = Overlay({"classFeatures": {"ID_MISSING": {"x": 1}}}, {}, [])
        anomalies: list = []
        issues = ovl.validate({"classFeatures": {"ID_REAL"}}, anomalies)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["kind"], "overlay_unknown_id")
        self.assertEqual(issues[0]["id"], "ID_MISSING")
        self.assertEqual(anomalies, issues)

    def test_unknown_top_level_key_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            self._write(d, "bad.json", {"notACollection": {}})
            with self.assertRaises(ValueError):
                load_overlay(d)


class OverlayDerivedFlagsTest(unittest.TestCase):
    def test_ritual_casting_names_come_from_overlay(self):
        self.assertIn("ritual casting", _ritual_casting_feature_names())
        self.assertIn("Ritual Caster", _ritual_caster_feat_names())

    def test_role_progression_parsed_from_name(self):
        self.assertEqual(
            _role_progression_from_name("Level 3 Defender Encounter Power"),
            {"role": "defender", "kind": "encounter"},
        )
        self.assertIsNone(_role_progression_from_name("Weapon Talent"))

    def test_school_progression_tagging_uses_overlay(self):
        filters = _OVERLAY.global_value("classFeatureChoiceGroupSchoolFilters") or {}
        self.assertTrue(filters, "overlay should define school progression filters")
        key = next(iter(filters))
        groups_by_class = {"ID_FMP_CLASS_722": [{"key": key}, {"key": "other"}]}
        _tag_school_progression_choice_groups(groups_by_class)
        tagged = groups_by_class["ID_FMP_CLASS_722"]
        self.assertEqual(tagged[0]["schoolFilter"], filters[key])
        self.assertNotIn("schoolFilter", tagged[1])


if __name__ == "__main__":
    unittest.main()

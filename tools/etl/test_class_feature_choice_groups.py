import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import (  # noqa: E402
    build_class_feature_choice_groups_by_class,
    build_essentials_class_build_options_by_class,
    load_raw_collections,
    merge_class_build_options_by_class,
)

XML = Path(__file__).resolve().parents[2] / "combined.dnd40.merged.xml"


@unittest.skipUnless(XML.is_file(), "combined.dnd40.merged.xml not present")
class TestClassFeatureChoiceGroups(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        collections = load_raw_collections(XML)
        features_by_id = {
            str(r["internal_id"]): r
            for r in collections["Class Feature"]
            if r.get("internal_id")
        }
        classes_by_id = {
            str(c["internal_id"]): c
            for c in collections["Class"]
            if c.get("internal_id")
        }
        cls.groups = build_class_feature_choice_groups_by_class(
            collections["Grants"], features_by_id, classes_by_id
        )
        cls.builds = merge_class_build_options_by_class(
            {},
            build_essentials_class_build_options_by_class(
                collections["Class"], collections.get("Build") or []
            ),
        )

    def test_rogue_tactics_and_weapon_talent_pair(self) -> None:
        groups = self.groups["ID_FMP_CLASS_6"]
        names = {g["parentFeatureName"] for g in groups}
        self.assertIn("Rogue Tactics", names)
        self.assertIn("Class feature", names)
        tactics = next(g for g in groups if g["parentFeatureName"] == "Rogue Tactics")
        self.assertEqual(len(tactics["options"]), 4)
        pair = next(g for g in groups if g["parentFeatureName"] == "Class feature")
        opt_names = {o["name"] for o in pair["options"]}
        self.assertEqual(opt_names, {"Rogue Weapon Talent", "Sharpshooter Talent"})
        sharp = next(g for g in groups if g["parentFeatureName"] == "Sharpshooter Talent")
        self.assertEqual(
            sharp["visibleWhen"],
            {"groupKey": pair["key"], "optionId": "ID_FMP_CLASS_FEATURE_2238"},
        )

    def test_fighter_talents_and_agility_superiority_pair(self) -> None:
        groups = self.groups["ID_FMP_CLASS_3"]
        talents = next(g for g in groups if g["parentFeatureName"] == "Fighter Talents")
        self.assertGreaterEqual(len(talents["options"]), 4)
        pair = next(g for g in groups if g["parentFeatureName"] == "Class feature")
        self.assertEqual(
            {o["name"] for o in pair["options"]},
            {"Combat Agility", "Combat Superiority"},
        )

    def test_wizard_implement_and_cantrips(self) -> None:
        groups = self.groups["ID_FMP_CLASS_9"]
        self.assertTrue(any(g["parentFeatureName"] == "Arcane Implement Mastery" for g in groups))
        cantrips = next(g for g in groups if g["kind"] == "power")
        self.assertEqual(cantrips["pickCount"], 4)
        self.assertGreaterEqual(len(cantrips["powerIds"]), 4)

    def test_rogue_has_separate_essentials_builds(self) -> None:
        names = {o["name"] for o in self.builds.get("ID_FMP_CLASS_6", [])}
        self.assertIn("Aerialist Rogue", names)


if __name__ == "__main__":
    unittest.main()

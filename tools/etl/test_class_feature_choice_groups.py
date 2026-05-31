import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import (  # noqa: E402
    build_class_feature_choice_groups_by_class,
    build_essentials_class_build_options_by_class,
    build_granted_class_feature_names_by_support,
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
        support_by_id = dict(classes_by_id)
        for hyb in collections["Hybrid Class"]:
            hid = hyb.get("internal_id")
            if hid:
                support_by_id[str(hid)] = hyb
        cls.groups = build_class_feature_choice_groups_by_class(
            collections["Grants"], features_by_id, classes_by_id
        )
        cls.granted_names = build_granted_class_feature_names_by_support(
            collections["Grants"], features_by_id, support_by_id
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

    def test_hybrid_cleric_keeps_hybrid_granted_features(self) -> None:
        names = set(self.granted_names.get("ID_FMP_HYBRID_CLASS_352", []))
        self.assertIn("Healing Word (Hybrid)", names)

    def test_warpriest_excludes_warlock_hexblade_features(self) -> None:
        """Warpriest (705) must not inherit Warlock (7) / Hexblade grants from shared bundle."""
        names = set(self.granted_names.get("ID_FMP_CLASS_705", []))
        self.assertIn("Level 1 Warpriest Daily Power", names)
        self.assertIn("Healing Word", names)
        self.assertNotIn("Eldritch Blast", names)
        self.assertNotIn("Eldritch Pact", names)
        self.assertNotIn("Level 1 Hexblade Daily Power", names)
        self.assertNotIn("Pact Weapon", names)
        groups = self.groups.get("ID_FMP_CLASS_705", [])
        parent_names = {g["parentFeatureName"] for g in groups}
        self.assertIn("Level 1 Warpriest Daily Power", parent_names)
        self.assertNotIn("Level 1 Hexblade Daily Power", parent_names)


if __name__ == "__main__":
    unittest.main()

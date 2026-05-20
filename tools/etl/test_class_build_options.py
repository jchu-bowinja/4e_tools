import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import (  # noqa: E402
    build_class_build_options_by_class,
    build_essentials_class_build_options_by_class,
    enrich_phb_class_build_display_names,
    load_raw_collections,
    merge_class_build_options_by_class,
)

XML = Path(__file__).resolve().parents[2] / "combined.dnd40.merged.xml"


@unittest.skipUnless(XML.is_file(), "combined.dnd40.merged.xml not present")
class TestClassBuildOptions(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        collections = load_raw_collections(XML)
        features_by_id = {
            str(r["internal_id"]): r
            for r in collections["Class Feature"]
            if r.get("internal_id")
        }
        cls.from_grants = build_class_build_options_by_class(collections["Grants"], features_by_id)
        cls.from_builds = build_essentials_class_build_options_by_class(
            collections["Class"], collections.get("Build") or []
        )
        classes_by_id = {
            str(c["internal_id"]): c
            for c in collections["Class"]
            if c.get("internal_id")
        }
        cls.merged = merge_class_build_options_by_class(cls.from_grants, cls.from_builds)
        enrich_phb_class_build_display_names(cls.merged, classes_by_id)

    def test_fighter_uses_talent_subfeatures_not_duplicate_build_rows(self) -> None:
        fighter_id = "ID_FMP_CLASS_3"
        grant_opts = self.from_grants.get(fighter_id) or []
        self.assertGreaterEqual(len(grant_opts), 4)
        self.assertTrue(any(o["name"] == "Arena Training" for o in grant_opts))
        merged = self.merged.get(fighter_id) or []
        self.assertEqual(len(merged), len(grant_opts))

    def test_fighter_talents_get_player_facing_display_names(self) -> None:
        fighter_id = "ID_FMP_CLASS_3"
        opts = {o["name"]: o for o in (self.merged.get(fighter_id) or [])}
        self.assertEqual(opts["Arena Training"].get("displayName"), "Arena Fighter")
        self.assertEqual(opts["Battlerager Vigor"].get("displayName"), "Battlerager Fighter")
        self.assertEqual(opts["Brawler Style"].get("displayName"), "Brawling Fighter")
        self.assertEqual(opts["Two-handed Weapon Talent"].get("displayName"), "Great Weapon Fighter")
        self.assertEqual(opts["One-handed Weapon Talent"].get("displayName"), "Guardian Fighter")
        self.assertEqual(opts["Tempest Technique"].get("displayName"), "Tempest Fighter")

    def test_cleric_has_essentials_build_options(self) -> None:
        cleric_id = "ID_FMP_CLASS_2"
        self.assertEqual(self.from_grants.get(cleric_id), None)
        opts = self.merged.get(cleric_id) or []
        names = {o["name"] for o in opts}
        self.assertEqual(names, {"Battle Cleric", "Devoted Cleric", "Shielding Cleric"})
        battle = next(o for o in opts if o["name"] == "Battle Cleric")
        self.assertEqual(battle["id"], "ID_FMP_BUILD_6")
        self.assertIn("Str", battle.get("shortDescription") or "")
        self.assertTrue(len(battle.get("powerIds") or []) > 0)
        self.assertTrue(isinstance(battle.get("body"), str) and len(battle["body"]) > 20)

    def test_paladin_and_artificer_build_options(self) -> None:
        paladin = self.merged.get("ID_FMP_CLASS_4") or []
        self.assertEqual(
            {o["name"] for o in paladin},
            {"Ardent Paladin", "Avenging Paladin", "Protecting Paladin", "Virtuous Paladin"},
        )
        artificer = self.merged.get("ID_FMP_CLASS_125") or []
        self.assertEqual(
            {o["name"] for o in artificer},
            {"Battlesmith Artificer", "Tinkerer Artificer", "Warrior Forge Artificer"},
        )


if __name__ == "__main__":
    unittest.main()

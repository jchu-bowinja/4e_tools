import unittest

from build_rules_index import (
    ARCHER_WARLORD_CLASS_FEATURE_ID,
    BONUS_AT_WILL_TRAIT_ID,
    HEROIC_EFFORT_TRAIT_ID,
    HUMAN_POWER_SELECTION_TRAIT_ID,
    _extract_class_feature_mechanical_effects,
    _extract_racial_trait_index_fields,
)


class RacialTraitIndexFieldsTest(unittest.TestCase):
    def test_dilettante_trait_exports_category_and_usage_override(self):
        row = {
            "internal_id": "ID_FMP_RACIAL_TRAIT_643",
            "rules": {
                "select": [
                    {
                        "attrs": {
                            "type": "Power",
                            "Category": "$$NOT_CLASS,at-will,1",
                        }
                    }
                ]
            },
        }
        out = _extract_racial_trait_index_fields(row, {"ID_FMP_RACIAL_TRAIT_643": row})
        self.assertEqual(out["powerSelectCategory"], "$$NOT_CLASS,at-will,1")
        self.assertEqual(out["powerUsageOverride"], "Encounter")

    def test_human_power_selection_exports_bundle_ids(self):
        row = {"internal_id": HUMAN_POWER_SELECTION_TRAIT_ID, "rules": {}}
        out = _extract_racial_trait_index_fields(row, {HUMAN_POWER_SELECTION_TRAIT_ID: row})
        self.assertTrue(out["grantsBonusClassAtWillByDefault"])
        self.assertEqual(out["heroicEffortTraitId"], HEROIC_EFFORT_TRAIT_ID)
        self.assertEqual(out["bonusAtWillTraitId"], BONUS_AT_WILL_TRAIT_ID)

    def test_half_elf_parent_bundle_mode(self):
        dilettante = {
            "internal_id": "ID_FMP_RACIAL_TRAIT_643",
            "rules": {
                "select": [
                    {"attrs": {"type": "Power", "Category": "$$NOT_CLASS,at-will,1"}}
                ]
            },
        }
        parent = {
            "internal_id": "ID_FMP_RACIAL_TRAIT_PARENT",
            "specific": {"_PARSED_SUB_FEATURES": "ID_FMP_RACIAL_TRAIT_643, ID_FMP_RACIAL_TRAIT_KNACK"},
            "rules": {
                "select": [
                    {"attrs": {"type": "Racial Trait", "Category": "Half-Elf Power Selection"}}
                ]
            },
        }
        traits = {
            "ID_FMP_RACIAL_TRAIT_643": dilettante,
            "ID_FMP_RACIAL_TRAIT_PARENT": parent,
        }
        out = _extract_racial_trait_index_fields(parent, traits)
        self.assertEqual(out["powerBundleMode"], "subtraitFirst")


class ClassFeatureMechanicalEffectsTest(unittest.TestCase):
    def test_archer_warlord_mechanical_effects(self):
        row = {"internal_id": ARCHER_WARLORD_CLASS_FEATURE_ID}
        effects = _extract_class_feature_mechanical_effects(row)
        self.assertEqual(len(effects), 2)
        self.assertEqual(effects[0]["type"], "removeArmorProficiencyPhrases")


if __name__ == "__main__":
    unittest.main()

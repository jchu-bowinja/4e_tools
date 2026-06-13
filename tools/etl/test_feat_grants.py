import unittest

from build_rules_index import extract_grants_from_rules


class TestFeatGrants(unittest.TestCase):
    def test_multiclass_counts_as_and_internal(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_INTERNAL_COUNTSASCLASS_ROGUE", "type": "CountsAsClass"}},
                {"attrs": {"name": "ID_INTERNAL_MULTICLASS_MULTICLASS", "type": "Multiclass"}},
                {"attrs": {"name": "ID_INTERNAL_INTERNAL_BLOODLINE", "type": "Internal"}},
                {"attrs": {"name": "ID_FMP_POWER_1", "type": "Power"}},
            ]
        }
        out = extract_grants_from_rules(rules, {"rogue": "ID_FMP_CLASS_6"})
        self.assertTrue(out["hasMulticlassGrant"])
        self.assertEqual(out["countsAsClassNames"], ["Rogue"])
        self.assertEqual(out["countsAsClassIds"], ["ID_FMP_CLASS_6"])
        self.assertEqual(out["internalGrantKeys"], ["BLOODLINE"])
        self.assertEqual(out["grantedPowerIds"], ["ID_FMP_POWER_1"])

    def test_bracketed_counts_as_class_label(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_INTERNAL_COUNTSASCLASS_[DILETTANTE]", "type": "CountsAsClass"}},
            ]
        }
        out = extract_grants_from_rules(rules, {})
        self.assertEqual(out["countsAsClassNames"], ["Dilettante"])
        self.assertEqual(out["countsAsClassIds"], [])

    def test_non_standard_internal_id(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_INTERNAL_VAMPIRE_HEALING_SURGES", "type": "Internal"}},
            ]
        }
        out = extract_grants_from_rules(rules, {})
        self.assertEqual(out["internalGrantKeys"], ["VAMPIRE_HEALING_SURGES"])

    def test_skill_training_and_counts_as_feature(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_INTERNAL_SKILL_TRAINING_THIEVERY", "type": "Skill Training"}},
                {
                    "attrs": {
                        "name": "ID_INTERNAL_COUNTSASFEATURE_CHANNEL_DIVINITY",
                        "type": "CountsAsFeature",
                    }
                },
            ]
        }
        out = extract_grants_from_rules(
            rules,
            skill_name_to_id={"thievery": "ID_FMP_SKILL_23"},
        )
        self.assertEqual(out["grantedSkillTrainingNames"], ["Thievery"])
        self.assertEqual(out["grantedSkillTrainingIds"], ["ID_FMP_SKILL_23"])
        self.assertEqual(out["countsAsFeatureNames"], ["Channel Divinity"])
        lookup = {"channel divinity": "Channel Divinity"}
        id_lookup = {"channel divinity": "ID_CF_1"}
        out2 = extract_grants_from_rules(
            rules,
            class_feature_name_lookup=lookup,
            class_feature_id_by_name=id_lookup,
        )
        self.assertEqual(out2["countsAsFeatureIds"], ["ID_CF_1"])

    def test_vision_and_grants_internal_keys(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_INTERNAL_VISION_DARKVISION", "type": "Vision"}},
                {"attrs": {"name": "ID_INTERNAL_GRANTS_WIZARD_IMPLEMENTS", "type": "Grants"}},
            ]
        }
        out = extract_grants_from_rules(rules)
        self.assertEqual(
            sorted(out["internalGrantKeys"]),
            ["GRANTS_WIZARD_IMPLEMENTS", "VISION_DARKVISION"],
        )

    def test_language_grant(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_FMP_LANGUAGE_4", "type": "Language"}},
            ]
        }
        out = extract_grants_from_rules(
            rules,
            language_id_to_name={"ID_FMP_LANGUAGE_4": "Elven"},
        )
        self.assertEqual(out["grantedLanguageIds"], ["ID_FMP_LANGUAGE_4"])
        self.assertEqual(out["grantedLanguageNames"], ["Elven"])

    def test_bracketed_counts_as_class_name(self):
        rules = {
            "grant": [
                {"attrs": {"name": "[Dilettante]", "type": "CountsAsClass"}},
            ]
        }
        out = extract_grants_from_rules(rules)
        self.assertEqual(out["countsAsClassNames"], ["Dilettante"])

    def test_power_grant_without_power_token_in_id(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_WOG_DIVINE_SANCTION_RULES_ITEM", "type": "Power"}},
            ]
        }
        out = extract_grants_from_rules(rules)
        self.assertEqual(out["grantedPowerIds"], ["ID_WOG_DIVINE_SANCTION_RULES_ITEM"])

    def test_power_grant_missing_type(self):
        rules = {
            "grant": [
                {"attrs": {"name": "ID_FMP_POWER_7546"}},
            ]
        }
        out = extract_grants_from_rules(rules)
        self.assertEqual(out["grantedPowerIds"], ["ID_FMP_POWER_7546"])


if __name__ == "__main__":
    unittest.main()

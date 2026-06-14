import unittest

from build_rules_index import (
    _extract_class_feature_mechanical_effects,
    build_domain_label_by_class_feature_id,
    build_trait_package_id_by_class_feature_id,
    extract_class_feature_power_rules,
    extract_feat_power_modifications,
)


class ClassFeaturePowerRulesTest(unittest.TestCase):
    def test_weapon_damage_die_increase(self):
        row = {
            "internal_id": "ID_TEST_ROGUE_WEAPON",
            "name": "Rogue Weapon Talent",
            "rules": {
                "modify": [
                    {
                        "attrs": {
                            "name": "Shuriken",
                            "type": "Weapon",
                            "Field": "Damage",
                            "die-increase": "1",
                        }
                    }
                ]
            },
        }
        effects = _extract_class_feature_mechanical_effects(row)
        self.assertEqual(
            effects,
            [{"type": "weaponDamageDieIncrease", "weaponName": "Shuriken", "steps": 1}],
        )

    def test_power_replacement_rule(self):
        row = {
            "rules": {
                "replace": [
                    {"attrs": {"power-replace": "ID_FMP_POWER_NEW:ID_FMP_POWER_OLD"}}
                ]
            }
        }
        out = extract_class_feature_power_rules(row)
        self.assertEqual(
            out["powerReplacementRules"],
            [{"replacementPowerId": "ID_FMP_POWER_NEW", "originalPowerId": "ID_FMP_POWER_OLD"}],
        )

    def test_powerswap_rule(self):
        row = {
            "specific": {"Powers": "ID_FMP_POWER_A,ID_FMP_POWER_B"},
            "rules": {
                "replace": [{"attrs": {"powerswap": "$$CLASS,daily,15"}}]
            },
        }
        out = extract_class_feature_power_rules(row)
        self.assertEqual(len(out["powerSwapRules"]), 1)
        self.assertEqual(out["powerSwapRules"][0]["usageBucket"], "daily")
        self.assertEqual(out["powerSwapRules"][0]["slotGainLevel"], 15)
        self.assertEqual(out["powerSwapRules"][0]["powerIds"], ["ID_FMP_POWER_A", "ID_FMP_POWER_B"])

    def test_power_modify_extraction(self):
        row = {
            "name": "Healing Word",
            "rules": {
                "modify": [
                    {
                        "attrs": {
                            "name": "ID_FMP_POWER_1455",
                            "type": "Power",
                            "Field": "Display",
                            "value": "Cleric Utility",
                        }
                    },
                    {
                        "attrs": {
                            "name": "ID_FMP_POWER_1455",
                            "type": "Power",
                            "Field": "Power Type",
                            "value": "Utility",
                        }
                    },
                ]
            },
        }
        out = extract_feat_power_modifications(row, {}, {}, {"ID_FMP_POWER_1455": "Healing Word"}, {})
        self.assertEqual(len(out["powerModifications"]), 2)
        fields = {entry["field"] for entry in out["powerModifications"]}
        self.assertEqual(fields, {"Display", "Power Type"})
        self.assertTrue(
            all(entry["powerId"] == "ID_FMP_POWER_1455" for entry in out["powerModifications"])
        )


    def test_powerswap_rule_without_fixed_power_list(self):
        row = {
            "name": "Level 03 Defender Encounter Power",
            "rules": {
                "replace": [
                    {
                        "attrs": {
                            "powerswap": "ID_FMP_CLASS_3|ID_FMP_CLASS_4,encounter,3"
                        }
                    }
                ]
            },
        }
        out = extract_class_feature_power_rules(row)
        self.assertEqual(len(out["powerSwapRules"]), 1)
        self.assertEqual(out["powerSwapRules"][0]["usageBucket"], "encounter")
        self.assertEqual(out["powerSwapRules"][0]["slotGainLevel"], 3)
        self.assertEqual(out["powerSwapRules"][0]["powerIds"], [])
        self.assertEqual(out["powerSwapRules"][0]["roleBucket"], "defender")

    def test_trait_package_map_from_progression_grants(self):
        features_by_id = {
            "ID_FMP_CLASS_FEATURE_3656": {
                "internal_id": "ID_FMP_CLASS_FEATURE_3656",
                "name": "Level 1 Pact Encounter Power",
                "rules": {
                    "grant": [
                        {
                            "attrs": {
                                "name": "ID_FMP_CLASS_FEATURE_3700",
                                "type": "Class Feature",
                                "requires": "ID_FMP_TRAIT_PACKAGE_824",
                            }
                        }
                    ]
                },
            },
            "ID_FMP_CLASS_FEATURE_3700": {
                "internal_id": "ID_FMP_CLASS_FEATURE_3700",
                "name": "Level 1 Star Pact Encounter Power",
            },
            "ID_FMP_CLASS_FEATURE_3699": {
                "internal_id": "ID_FMP_CLASS_FEATURE_3699",
                "name": "Star Pact Boon (Binder)",
            },
        }
        out = build_trait_package_id_by_class_feature_id(features_by_id)
        self.assertEqual(out["ID_FMP_CLASS_FEATURE_3699"], "ID_FMP_TRAIT_PACKAGE_824")

    def test_domain_label_map_from_warpriest_picks(self):
        features_by_id = {
            "ID_FMP_CLASS_FEATURE_3098": {
                "internal_id": "ID_FMP_CLASS_FEATURE_3098",
                "name": "Level 3 Domain Encounter Power",
                "rules": {
                    "grant": [
                        {
                            "attrs": {
                                "name": "ID_FMP_CLASS_FEATURE_2969",
                                "type": "Class Feature",
                                "requires": "Storm Domain",
                            }
                        },
                        {
                            "attrs": {
                                "name": "ID_FMP_CLASS_FEATURE_2983",
                                "type": "Class Feature",
                                "requires": "Sun Domain",
                            }
                        },
                    ]
                },
            },
            "ID_FMP_CLASS_FEATURE_2822": {
                "internal_id": "ID_FMP_CLASS_FEATURE_2822",
                "name": "Storm Domain Features and Powers",
            },
            "ID_FMP_CLASS_FEATURE_2841": {
                "internal_id": "ID_FMP_CLASS_FEATURE_2841",
                "name": "Sun Domain Features",
            },
        }
        features_by_name = {
            "Level 3 Domain Encounter Power": features_by_id["ID_FMP_CLASS_FEATURE_3098"],
            "Storm Domain Features and Powers": features_by_id["ID_FMP_CLASS_FEATURE_2822"],
            "Sun Domain Features": features_by_id["ID_FMP_CLASS_FEATURE_2841"],
        }
        out = build_domain_label_by_class_feature_id(features_by_id, features_by_name)
        self.assertEqual(out["ID_FMP_CLASS_FEATURE_2822"], "Storm Domain")
        self.assertEqual(out["ID_FMP_CLASS_FEATURE_2841"], "Sun Domain")


if __name__ == "__main__":
    unittest.main()

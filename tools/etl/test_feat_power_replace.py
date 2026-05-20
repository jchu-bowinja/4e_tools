import unittest

from build_rules_index import extract_feat_power_replace_offers


class TestFeatPowerReplace(unittest.TestCase):
    def test_gythka_expert_utility_swap(self):
        feat = {
            "name": "Gythka Expert",
            "specific": {"_DisplayPowers": "ID_FMP_POWER_12924"},
            "rules": {
                "replace": [{"attrs": {"power-replace": "Gythka Parry:utility,6+", "optional": "true"}}]
            },
        }
        id_to_name = {"ID_FMP_POWER_12924": "Gythka Parry"}
        out = extract_feat_power_replace_offers(feat, {"gythka parry": "ID_FMP_POWER_12924"}, id_to_name)
        self.assertEqual(len(out["powerReplaceOffers"]), 1)
        offer = out["powerReplaceOffers"][0]
        self.assertEqual(offer["replacementPowerId"], "ID_FMP_POWER_12924")
        self.assertEqual(offer["usageBucket"], "utility")
        self.assertEqual(offer["minSlotGainLevel"], 6)
        self.assertTrue(offer["optional"])

    def test_gythka_novice_attack_maps_to_encounter(self):
        feat = {
            "name": "Gythka Novice",
            "specific": {"_DisplayPowers": "ID_FMP_POWER_12925"},
            "rules": {
                "replace": [{"attrs": {"power-replace": "Gythka Claw Scoop:attack,3+", "optional": "true"}}]
            },
        }
        out = extract_feat_power_replace_offers(
            feat, {"gythka claw scoop": "ID_FMP_POWER_12925"}, {"ID_FMP_POWER_12925": "Gythka Claw Scoop"}
        )
        self.assertEqual(out["powerReplaceOffers"][0]["usageBucket"], "encounter")
        self.assertEqual(out["powerReplaceOffers"][0]["minSlotGainLevel"], 3)

    def test_skips_multiclass_encounter_swap(self):
        feat = {
            "name": "Novice Power",
            "rules": {
                "replace": [{"attrs": {"name": "encounter swap", "Level": "1", "multiclass": "Encounter"}}]
            },
        }
        out = extract_feat_power_replace_offers(feat, {}, {})
        self.assertEqual(out["powerReplaceOffers"], [])

    def test_power_id_in_replace_spec(self):
        feat = {
            "name": "Thirst for Blood",
            "specific": {"_DisplayPowers": "ID_FMP_POWER_13853"},
            "rules": {
                "replace": [{"attrs": {"power-replace": "ID_FMP_POWER_13853:encounter,1+"}}]
            },
        }
        out = extract_feat_power_replace_offers(
            feat, {}, {"ID_FMP_POWER_13853": "Thirst for Blood"}
        )
        self.assertEqual(out["powerReplaceOffers"][0]["replacementPowerId"], "ID_FMP_POWER_13853")


if __name__ == "__main__":
    unittest.main()

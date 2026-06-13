import unittest

from build_rules_index import extract_feat_power_replace_offers


class TestFeatPowerReplace(unittest.TestCase):
    def _powers(self):
        return [
            {
                "internal_id": "ID_FMP_POWER_7356",
                "name": "Uncanny Aim (Blowgun)",
                "specific": {"Power Usage": "Encounter", "Power Type": "Attack", "Level": "6"},
            },
            {
                "internal_id": "ID_FMP_POWER_1628",
                "name": "Infernal Wrath",
                "specific": {"Power Usage": "Encounter", "Power Type": "Attack", "Level": "1"},
            },
            {
                "internal_id": "ID_FMP_POWER_10240",
                "name": "Warlock's Wrath",
                "specific": {"Power Usage": "Encounter", "Power Type": "Attack", "Level": "1"},
            },
        ]

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
        self.assertEqual(out.get("powerReplaceOffers"), None)

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

    def test_heritage_automatic_id_pair(self):
        feat = {
            "name": "Krinth Heritage",
            "specific": {"_DisplayPowers": "ID_FMP_POWER_13470"},
            "rules": {
                "replace": [{"attrs": {"power-replace": "ID_FMP_POWER_13470:ID_FMP_POWER_2482"}}]
            },
        }
        out = extract_feat_power_replace_offers(feat, {}, {"ID_FMP_POWER_13470": "Demonic Aggression"})
        self.assertEqual(
            out["powerReplacementRules"],
            [{"replacementPowerId": "ID_FMP_POWER_13470", "originalPowerId": "ID_FMP_POWER_2482"}],
        )
        self.assertNotIn("powerReplaceOffers", out)

    def test_improved_razor_storm_automatic_name_to_id(self):
        feat = {
            "name": "Improved Razor Storm",
            "specific": {"_DisplayPowers": "ID_FMP_POWER_5600"},
            "rules": {
                "replace": [{"attrs": {"power-replace": "Improved Razor Storm:ID_FMP_POWER_5599"}}]
            },
        }
        out = extract_feat_power_replace_offers(
            feat,
            {"improved razor storm": "ID_FMP_POWER_5600"},
            {"ID_FMP_POWER_5600": "Improved Razor Storm"},
            {},
            [],
        )
        self.assertEqual(out["powerReplacementRules"][0]["replacementPowerId"], "ID_FMP_POWER_5600")
        self.assertEqual(out["powerReplacementRules"][0]["originalPowerId"], "ID_FMP_POWER_5599")

    def test_warlocks_wrath_optional_offer(self):
        feat = {
            "name": "Warlock's Wrath",
            "specific": {"_DisplayPowers": "ID_FMP_POWER_10240"},
            "rules": {
                "replace": [
                    {
                        "attrs": {
                            "power-replace": "warlock's wrath:ID_FMP_POWER_1628",
                            "optional": "true",
                        }
                    }
                ]
            },
        }
        powers = self._powers()
        out = extract_feat_power_replace_offers(
            feat,
            {},
            {"ID_FMP_POWER_10240": "Warlock's Wrath", "ID_FMP_POWER_1628": "Infernal Wrath"},
            {},
            powers,
        )
        offer = out["powerReplaceOffers"][0]
        self.assertEqual(offer["replacementPowerId"], "ID_FMP_POWER_10240")
        self.assertEqual(offer["originalPowerId"], "ID_FMP_POWER_1628")
        self.assertEqual(offer["usageBucket"], "encounter")
        self.assertTrue(offer["optional"])

    def test_blowgun_expert_uncanny_aim(self):
        feat = {
            "name": "Blowgun Expert",
            "rules": {
                "replace": [{"attrs": {"power-replace": "uncanny aim:utility,6+", "optional": "true"}}]
            },
        }
        powers = self._powers()
        out = extract_feat_power_replace_offers(
            feat,
            {"uncanny aim (blowgun)": "ID_FMP_POWER_7356"},
            {"ID_FMP_POWER_7356": "Uncanny Aim (Blowgun)"},
            {"uncannyaimblowgun": "ID_FMP_POWER_7356"},
            powers,
        )
        self.assertEqual(out["powerReplaceOffers"][0]["replacementPowerId"], "ID_FMP_POWER_7356")

    def test_secrets_of_belial_non_class_utility(self):
        feat = {
            "name": "Secrets of Belial",
            "rules": {
                "replace": [{"attrs": {"power-replace": "$$NOT_CLASS:utility", "optional": "true"}}]
            },
        }
        out = extract_feat_power_replace_offers(feat, {}, {}, {}, [])
        offer = out["powerReplaceOffers"][0]
        self.assertTrue(offer["requireNonClassReplacement"])
        self.assertEqual(offer["usageBucket"], "utility")
        self.assertNotIn("replacementPowerId", offer)


if __name__ == "__main__":
    unittest.main()

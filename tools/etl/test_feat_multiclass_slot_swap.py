import unittest

from build_rules_index import extract_feat_multiclass_slot_swap_offers


class TestFeatMulticlassSlotSwap(unittest.TestCase):
    def test_novice_power_encounter_swap(self):
        feat = {
            "name": "Novice Power",
            "rules": {
                "replace": [
                    {"attrs": {"name": "encounter swap", "Level": "1", "multiclass": "Encounter", "optional": "true"}},
                    {"attrs": {"name": "encounter swap", "Level": "30", "multiclass": "Encounter", "optional": "true"}},
                ]
            },
        }
        out = extract_feat_multiclass_slot_swap_offers(feat)
        self.assertEqual(len(out["multiclassSlotSwapOffers"]), 1)
        offer = out["multiclassSlotSwapOffers"][0]
        self.assertEqual(offer["usageBucket"], "encounter")
        self.assertEqual(offer["maxSlotGainLevel"], 30)
        self.assertTrue(offer["optional"])

    def test_acolyte_utility(self):
        feat = {
            "name": "Acolyte Power",
            "rules": {
                "replace": [{"attrs": {"name": "utility swap", "Level": "8", "multiclass": "Utility", "optional": "true"}}]
            },
        }
        out = extract_feat_multiclass_slot_swap_offers(feat)
        self.assertEqual(out["multiclassSlotSwapOffers"][0]["usageBucket"], "utility")

    def test_skips_named_power_replace(self):
        feat = {
            "name": "Gythka Expert",
            "rules": {
                "replace": [{"attrs": {"power-replace": "Gythka Parry:utility,6+", "optional": "true"}}]
            },
        }
        self.assertEqual(extract_feat_multiclass_slot_swap_offers(feat), {})

    def test_psionic_complement_augmentable_at_will(self):
        feat = {
            "name": "Psionic Complement",
            "rules": {
                "replace": [{"attrs": {"Level": "1", "multiclass": "Augmentable At-Will", "optional": "true"}}],
                "modify": [{"attrs": {"Field": "Power Usage", "value": "Encounter"}}],
            },
        }
        out = extract_feat_multiclass_slot_swap_offers(feat)
        offer = out["multiclassSlotSwapOffers"][0]
        self.assertEqual(offer["usageBucket"], "atWill")
        self.assertTrue(offer["requireAugmentableSlot"])
        self.assertTrue(offer["requireAugmentableReplacement"])
        self.assertTrue(offer["replacementUsedAsEncounter"])

    def test_psionic_dabbler_encounter_to_augmentable_at_will(self):
        feat = {
            "name": "Psionic Dabbler",
            "rules": {
                "replace": [{"attrs": {"Level": "4", "multiclass": "encounter|Augmentable At-Will", "optional": "true"}}]
            },
        }
        out = extract_feat_multiclass_slot_swap_offers(feat)
        offer = out["multiclassSlotSwapOffers"][0]
        self.assertEqual(offer["usageBucket"], "encounter")
        self.assertEqual(offer["replacementUsageBucket"], "atWill")
        self.assertTrue(offer["requireAugmentableReplacement"])
        self.assertTrue(offer["replacementUsedAsEncounter"])
        self.assertNotIn("requireAugmentableSlot", offer)
        self.assertEqual(offer["powerPointSwapChange"], "gain")

    def test_psionic_conventionalist_at_will_to_encounter(self):
        feat = {
            "name": "Psionic Conventionalist",
            "rules": {
                "replace": [{"attrs": {"Level": "6", "multiclass": "encounter|Augmentable At-Will", "optional": "true"}}]
            },
        }
        out = extract_feat_multiclass_slot_swap_offers(feat)
        offer = out["multiclassSlotSwapOffers"][0]
        self.assertEqual(offer["usageBucket"], "atWill")
        self.assertEqual(offer["replacementUsageBucket"], "encounter")
        self.assertTrue(offer["requireAugmentableSlot"])
        self.assertNotIn("requireAugmentableReplacement", offer)
        self.assertEqual(offer["powerPointSwapChange"], "lose")


if __name__ == "__main__":
    unittest.main()

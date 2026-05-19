import unittest

from build_rules_index import extract_feat_power_modifications


class TestFeatPowerModifications(unittest.TestCase):
    def test_gulg_hunter_synthesizes_modify_from_associated_powers(self):
        feat = {
            "internal_id": "ID_FMP_FEAT_3210",
            "name": "Gulg Hunter Practice",
            "specific": {
                "Associated Powers": "footwork lure, gloaming cut, intuitive strike, nimble strike"
            },
            "rules": {"statadd": [{"attrs": {"name": "Athletics", "value": "+3", "type": "Feat"}}]},
        }
        power_lookup = {
            "footwork lure": "ID_FMP_POWER_2105",
            "gloaming cut": "ID_FMP_POWER_10733",
            "intuitive strike": "ID_FMP_POWER_10889",
            "nimble strike": "ID_FMP_POWER_919",
        }
        out = extract_feat_power_modifications(feat, power_lookup)
        self.assertEqual(len(out["powerModifications"]), 4)
        self.assertEqual(len(out["modifiedPowerIds"]), 4)
        self.assertEqual(out["modifiedPowerIds"][0], "ID_FMP_POWER_2105")
        modify = feat["rules"]["modify"]
        self.assertEqual(len(modify), 4)
        self.assertEqual(modify[0]["attrs"]["type"], "Power")
        self.assertEqual(modify[0]["attrs"]["Field"], "Gulg Hunter Practice")
        self.assertEqual(modify[0]["attrs"]["name"], "footwork lure")

    def test_corellons_wrath_uses_explicit_modify_rules(self):
        feat = {
            "internal_id": "ID_FMP_FEAT_1298",
            "name": "Corellon's Wrath Style",
            "specific": {},
            "rules": {
                "modify": [
                    {
                        "attrs": {
                            "name": "Command's Strike",
                            "type": "Power",
                            "Field": "Corellon's Wrath Style",
                            "value": "Bonus vs demon, drow, orc, or spider.",
                        }
                    },
                    {
                        "attrs": {
                            "name": "Twin Strike",
                            "type": "Power",
                            "Field": "Corellon's Wrath Style",
                            "value": "Extra damage vs demon, drow, orc, or spider.",
                        }
                    },
                ]
            },
        }
        power_lookup = {
            "command's strike": "ID_CMD",
            "twin strike": "ID_TWIN",
        }
        out = extract_feat_power_modifications(feat, power_lookup)
        self.assertEqual(len(out["powerModifications"]), 2)
        self.assertEqual(out["powerModifications"][0]["value"], "Bonus vs demon, drow, orc, or spider.")
        self.assertEqual(out["modifiedPowerIds"], ["ID_CMD", "ID_TWIN"])
        self.assertEqual(len(feat["rules"]["modify"]), 2)

    def test_associated_powers_not_duplicated_when_modify_exists(self):
        feat = {
            "name": "Power of Creation",
            "specific": {"Associated Powers": "Bolstering Strike, Grasping Shards"},
            "rules": {
                "modify": [
                    {
                        "attrs": {
                            "name": "Bolstering Strike",
                            "type": "Power",
                            "Field": "Power of Creation",
                            "value": "Effect A",
                        }
                    }
                ]
            },
        }
        power_lookup = {"bolstering strike": "P1", "grasping shards": "P2"}
        out = extract_feat_power_modifications(feat, power_lookup)
        self.assertEqual(len(out["powerModifications"]), 2)
        names = [e["powerName"] for e in out["powerModifications"]]
        self.assertEqual(names, ["Bolstering Strike", "Grasping Shards"])
        self.assertEqual(len(feat["rules"]["modify"]), 2)


if __name__ == "__main__":
    unittest.main()

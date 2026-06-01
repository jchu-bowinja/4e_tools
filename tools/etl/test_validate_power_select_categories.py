import unittest

from validate_power_select_categories import validate_racial_traits


class ValidatePowerSelectCategoriesTest(unittest.TestCase):
    def test_ok_dilettante_and_bonus_at_will(self):
        traits = [
            {
                "id": "TR_DIL",
                "name": "Dilettante",
                "powerSelectCategory": "$$NOT_CLASS,at-will,1",
                "powerUsageOverride": "Encounter",
                "raw": {
                    "rules": {
                        "select": [
                            {"attrs": {"type": "Power", "Category": "$$NOT_CLASS,at-will,1"}}
                        ]
                    }
                },
            },
            {
                "id": "TR_BONUS",
                "name": "Bonus At-Will",
                "powerSelectCategory": "$$CLASS,at-will,1",
                "grantsBonusClassAtWill": True,
                "raw": {
                    "rules": {
                        "select": [
                            {"attrs": {"type": "Power", "Category": "$$CLASS,at-will,1"}}
                        ]
                    }
                },
            },
        ]
        errors, warnings = validate_racial_traits(traits)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_errors_on_missing_metadata(self):
        traits = [
            {
                "id": "TR_DIL",
                "name": "Dilettante",
                "powerSelectCategory": "$$NOT_CLASS,at-will,1",
                "raw": {},
            },
            {
                "id": "TR_BONUS",
                "name": "Bonus At-Will",
                "powerSelectCategory": "$$CLASS,at-will,1",
                "raw": {},
            },
        ]
        errors, _warnings = validate_racial_traits(traits)
        self.assertEqual(len(errors), 2)


if __name__ == "__main__":
    unittest.main()

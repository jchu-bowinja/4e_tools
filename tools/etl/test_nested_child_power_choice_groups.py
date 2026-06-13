import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import _append_nested_child_power_choice_groups  # noqa: E402


class NestedChildPowerChoiceGroupsTest(unittest.TestCase):
    def test_infernal_pact_nested_power_group(self) -> None:
        parent_id = "ID_FMP_CLASS_FEATURE_777"
        infernal_id = "ID_FMP_CLASS_FEATURE_773"
        features_by_id = {
            infernal_id: {
                "internal_id": infernal_id,
                "name": "Infernal Pact",
                "rules": {
                    "select": [
                        {
                            "attrs": {
                                "type": "Power",
                                "number": "1",
                                "Category": "ID_FMP_POWER_1458|ID_FMP_POWER_12307",
                            }
                        }
                    ],
                    "grant": [{"attrs": {"type": "Power", "name": "ID_FMP_POWER_2095"}}],
                },
            }
        }
        groups = [
            {
                "key": f"classFeature:{parent_id}",
                "kind": "classFeature",
                "parentFeatureId": parent_id,
                "parentFeatureName": "Eldritch Pact",
                "pickCount": 1,
                "options": [
                    {"id": infernal_id, "name": "Infernal Pact"},
                    {"id": "ID_FMP_CLASS_FEATURE_772", "name": "Fey Pact"},
                ],
            }
        ]
        out = _append_nested_child_power_choice_groups(
            "ID_FMP_CLASS_7",
            {"internal_id": "ID_FMP_CLASS_7"},
            groups,
            features_by_id,
        )
        nested = next(g for g in out if g["key"] == f"classPower:{infernal_id}")
        self.assertEqual(nested["kind"], "power")
        self.assertEqual(
            set(nested["powerIds"]),
            {"ID_FMP_POWER_1458", "ID_FMP_POWER_12307"},
        )
        self.assertEqual(
            nested["visibleWhen"],
            {"groupKey": f"classFeature:{parent_id}", "optionId": infernal_id},
        )


if __name__ == "__main__":
    unittest.main()

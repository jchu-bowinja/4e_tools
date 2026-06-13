import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import _append_nested_child_class_feature_choice_groups  # noqa: E402


class NestedChildClassFeatureChoiceGroupsTest(unittest.TestCase):
    def test_air_elementalist_specialty_group(self) -> None:
        air_id = "ID_FMP_CLASS_FEATURE_4336"
        parent_id = "ID_FMP_CLASS_FEATURE_4335"
        features_by_id = {
            air_id: {
                "internal_id": air_id,
                "name": "Air Elementalist",
                "rules": {
                    "select": [
                        {
                            "attrs": {
                                "name": "Elemental Specialty",
                                "type": "Class Feature",
                                "number": "1",
                                "Category": "ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR|ID_INTERNAL_CLASS_FEATURE_STATIC_CHARGE",
                            }
                        }
                    ]
                },
            },
            "ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR": {
                "internal_id": "ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR",
                "name": "Howling Zephyr",
            },
            "ID_INTERNAL_CLASS_FEATURE_STATIC_CHARGE": {
                "internal_id": "ID_INTERNAL_CLASS_FEATURE_STATIC_CHARGE",
                "name": "Static Charge",
            },
        }
        groups = [
            {
                "key": f"classFeature:{parent_id}",
                "kind": "classFeature",
                "parentFeatureId": parent_id,
                "parentFeatureName": "Elemental Specialty",
                "pickCount": 1,
                "options": [
                    {"id": air_id, "name": "Air Elementalist"},
                    {"id": "ID_FMP_CLASS_FEATURE_4337", "name": "Earth Elementalist"},
                ],
            }
        ]
        out = _append_nested_child_class_feature_choice_groups(groups, features_by_id)
        nested = next(g for g in out if g["key"] == f"classFeature:{air_id}")
        self.assertEqual(nested["parentFeatureName"], "Elemental Specialty")
        self.assertEqual(
            {o["id"] for o in nested["options"]},
            {
                "ID_INTERNAL_CLASS_FEATURE_HOWLING_ZEPHYR",
                "ID_INTERNAL_CLASS_FEATURE_STATIC_CHARGE",
            },
        )
        self.assertEqual(
            nested["visibleWhen"],
            {"groupKey": f"classFeature:{parent_id}", "optionId": air_id},
        )


if __name__ == "__main__":
    unittest.main()

import unittest

from build_rules_index import (
    _background_index_entry,
    _magic_item_index_entry,
    _proficiency_index_entry,
    _rules_element_to_row,
)
import xml.etree.ElementTree as ET


class TestCompendiumIngest(unittest.TestCase):
    def test_proficiency_weapon_category_ids(self):
        xml = """
        <RulesElement internal-id="ID_INTERNAL_PROFICIENCY_WEAPON_PROFICIENCY_(LONGSWORD)"
            name="Weapon Proficiency (Longsword)" type="Proficiency" source="Core">
            <Category>ID_FMP_WEAPON_GROUP_10,ID_INTERNAL_CATEGORY_MILITARY,ID_INTERNAL_CATEGORY_MELEE</Category>
        </RulesElement>
        """
        row = _rules_element_to_row(ET.fromstring(xml))
        out = _proficiency_index_entry(row)
        self.assertEqual(out["id"], "ID_INTERNAL_PROFICIENCY_WEAPON_PROFICIENCY_(LONGSWORD)")
        self.assertEqual(out["grant"]["kind"], "weaponName")
        self.assertEqual(out["grant"]["value"], "longsword")
        self.assertEqual(len(out["categoryIds"]), 3)

    def test_background_benefit_and_skills(self):
        row = {
            "internal_id": "ID_FMP_BACKGROUND_99",
            "name": "Geography - Desert",
            "source": "PHB2",
            "specific": {
                "type": "Geography",
                "Benefit": "You add Endurance to your class skill list.",
                "Associated Skills": "Endurance, Nature",
                "Short Description": "You grew up in the desert.",
            },
        }
        out = _background_index_entry(row, set(), set(), [])
        self.assertEqual(out["backgroundType"], "Geography")
        self.assertEqual(out["associatedSkills"], ["Endurance", "Nature"])
        self.assertIn("Endurance", out["benefit"])

    def test_magic_item_statadds_and_enhancement(self):
        row = {
            "internal_id": "ID_FMP_MAGIC_ITEM_32",
            "name": "Black Iron Armor +2",
            "flavor": "Glows red.",
            "specific": {
                "Level": "9",
                "Gold": "4200",
                "Magic Item Type": "Armor",
                "Enhancement": "+2 AC",
                "Property": "Resist fire.",
                "Rarity": "Common",
            },
            "rules": {
                "statadd": [
                    {"attrs": {"name": "Armor Class", "value": "+2", "type": "Enhancement"}},
                    {"attrs": {"name": "Armor Enhancement Bonus", "value": "+2"}},
                ]
            },
        }
        out = _magic_item_index_entry(row)
        self.assertEqual(out["level"], 9)
        self.assertEqual(out["gold"], 4200)
        self.assertEqual(out["enhancementBonus"], 2)
        self.assertEqual(len(out["statAdds"]), 2)
        self.assertEqual(out["magicItemType"], "Armor")


if __name__ == "__main__":
    unittest.main()

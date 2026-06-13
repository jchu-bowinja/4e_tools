"""Unit tests for prereq_parser (run: python -m unittest tools.etl.test_prereq_parser)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from prereq_parser import build_prereq_lookups_from_raw, parse_prereqs  # noqa: E402


class PrereqParserTests(unittest.TestCase):
    def setUp(self) -> None:
        self.races = {"Dragonborn", "Human", "Elf"}
        self.classes = {"fighter", "wizard", "warlock", "cleric", "swordmage", "warlord"}

    def _kinds(self, text: str) -> list[str]:
        result = parse_prereqs(text, self.races, self.classes)
        return [t["kind"] for t in result.tokens]

    def test_any_martial_class(self) -> None:
        self.assertIn("powerSourceAny", self._kinds("any martial class"))

    def test_class_feature(self) -> None:
        kinds = self._kinds("Channel Divinity class feature")
        self.assertEqual(kinds, ["classFeature"])
        result = parse_prereqs("Channel Divinity class feature", self.races, self.classes)
        self.assertEqual(result.tokens[0]["value"], "Channel Divinity")

    def test_racial_power(self) -> None:
        kinds = self._kinds("dragon breath racial power")
        self.assertEqual(kinds, ["racialPower"])

    def test_feat_prereq(self) -> None:
        kinds = self._kinds("Ritual Caster feat")
        self.assertEqual(kinds, ["feat"])

    def test_multiclass_entry_prereq(self) -> None:
        kinds = self._kinds("Any class-specific multiclass feat, 4th level")
        self.assertIn("multiclassEntry", kinds)
        self.assertIn("levelAtLeast", kinds)

    def test_or_group(self) -> None:
        result = parse_prereqs("Cha 13 or dragonborn race", self.races, self.classes)
        self.assertEqual(result.tokens[0]["kind"], "anyOf")
        opts = result.tokens[0]["options"]
        self.assertEqual(len(opts), 2)
        self.assertEqual(opts[0]["kind"], "abilityAtLeast")
        self.assertEqual(opts[1]["kind"], "race")

    def test_negated_class_id(self) -> None:
        kinds = self._kinds("!ID_FMP_CLASS_6")
        self.assertEqual(kinds, ["negatedClass"])

    def test_heritage(self) -> None:
        kinds = self._kinds("Vistani Heritage")
        self.assertEqual(kinds, ["heritage"])

    def test_deity(self) -> None:
        kinds = self._kinds("must worship the Raven Queen")
        self.assertEqual(kinds, ["deity"])

    def test_warlock_pact(self) -> None:
        kinds = self._kinds("star pact")
        self.assertEqual(kinds, ["classFeature"])

    def test_paragon_path_prereq(self) -> None:
        result = parse_prereqs("Iron Vanguard paragon path", self.races, self.classes)
        self.assertEqual(result.tokens[0]["kind"], "paragonPath")
        self.assertEqual(result.tokens[0]["value"], "Iron Vanguard")

    def test_epic_destiny_prereq(self) -> None:
        result = parse_prereqs("Demigod epic destiny", self.races, self.classes)
        self.assertEqual(result.tokens[0]["kind"], "epicDestiny")
        self.assertEqual(result.tokens[0]["value"], "Demigod")

    def test_bare_feat_name_lookup(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [{"name": "Two-Weapon Fighting", "internal_id": "ID_TEST_FEAT"}],
            [], [], [], [], [], [], [],
        )
        result = parse_prereqs("Two-Weapon Fighting", self.races, self.classes, lookups)
        self.assertEqual(result.tokens, [{"kind": "feat", "value": "Two-Weapon Fighting"}])
        self.assertEqual(result.anomalies, [])

    def test_training_with_armor(self) -> None:
        result = parse_prereqs("training with chainmail", self.races, self.classes)
        self.assertEqual(result.tokens[0]["kind"], "proficiency")
        self.assertEqual(result.tokens[0]["value"], "chainmail")

    def test_hide_armor_proficiency(self) -> None:
        result = parse_prereqs("hide armor", self.races, self.classes)
        self.assertEqual(result.tokens[0], {"kind": "proficiency", "value": "hide"})

    def test_skill_name_lookup(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [], [], [], [{"name": "Religion", "internal_id": "ID_TEST_SKILL"}], [], [], [], [],
        )
        result = parse_prereqs("Religion", self.races, self.classes, lookups)
        self.assertEqual(result.tokens, [{"kind": "trainedSkill", "value": "Religion"}])

    def test_theme_suffix_lookup(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [], [{"name": "Gladiator", "internal_id": "ID_TEST_THEME"}], [], [], [], [], [], [],
        )
        result = parse_prereqs("gladiator theme", self.races, self.classes, lookups)
        self.assertEqual(result.tokens, [{"kind": "theme", "value": "Gladiator"}])

    def test_follower_of_deity(self) -> None:
        result = parse_prereqs("Follower of Bahamut", self.races, self.classes)
        self.assertEqual(result.tokens[0], {"kind": "deity", "value": "Bahamut"})

    def test_psionic_power_source(self) -> None:
        result = parse_prereqs("Psionic", self.races, self.classes)
        self.assertEqual(result.tokens[0], {"kind": "powerSourceAny", "value": "psionic"})

    def test_internal_id_racial_trait(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [], [], [], [], [], [], [{"name": "Dusk Elf Stealth", "internal_id": "ID_FMP_RACIAL_TRAIT_714"}], [],
        )
        result = parse_prereqs("ID_FMP_RACIAL_TRAIT_714", self.races, self.classes, lookups)
        self.assertEqual(result.tokens, [{"kind": "racialTrait", "value": "Dusk Elf Stealth"}])

    def test_multiclass_divine_class(self) -> None:
        kinds = self._kinds("multiclass divine class")
        self.assertEqual(kinds, ["multiclassEntry", "powerSourceAny"])

    def test_training_in_skill(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [], [], [], [{"name": "Arcana", "internal_id": "ID_TEST_SKILL"}], [], [], [], [],
        )
        result = parse_prereqs("Training in Arcana", self.races, self.classes, lookups)
        self.assertEqual(result.tokens, [{"kind": "trainedSkill", "value": "Arcana"}])

    def test_implement_proficiency_compound(self) -> None:
        result = parse_prereqs("Implement Proficiency (Club)", self.races, self.classes)
        self.assertEqual(result.tokens[0], {"kind": "proficiency", "value": "Implement: Club"})

    def test_race_class_or_group(self) -> None:
        result = parse_prereqs("human fighter or human warlord", self.races, self.classes)
        self.assertEqual(result.tokens[0]["kind"], "anyOf")
        opts = result.tokens[0]["options"]
        self.assertEqual(len(opts), 2)
        self.assertEqual(opts[0]["kind"], "allOf")

    def test_class_with_feature(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [], [], [], [], [{"name": "Aegis of Assault", "internal_id": "ID_CF"}], [], [], [],
        )
        result = parse_prereqs(
            "swordmage with aegis of assault", self.races, self.classes, lookups
        )
        self.assertEqual(result.tokens[0]["kind"], "allOf")
        reqs = result.tokens[0]["requirements"]
        self.assertEqual(reqs[0], {"kind": "class", "value": "Swordmage"})
        self.assertEqual(reqs[1], {"kind": "classFeature", "value": "Aegis of Assault"})

    def test_and_stealth_fragment(self) -> None:
        lookups = build_prereq_lookups_from_raw(
            [], [], [], [{"name": "Stealth", "internal_id": "ID_SKILL"}], [], [], [], [],
        )
        result = parse_prereqs("and Stealth", self.races, self.classes, lookups)
        self.assertEqual(result.tokens, [{"kind": "trainedSkill", "value": "Stealth"}])

    def test_power_points_prereq(self) -> None:
        result = parse_prereqs("1 or more power points", self.races, self.classes)
        self.assertEqual(result.tokens, [{"kind": "powerPointsAtLeast", "value": 1}])

    def test_arena_weapon_category_id(self) -> None:
        result = parse_prereqs(
            "ID_INTERNAL_ARENA_WEAPON_CATEGORY_BOW", self.races, self.classes
        )
        self.assertEqual(result.tokens, [{"kind": "proficiency", "value": "Bow"}])
        self.assertEqual(result.anomalies, [])

    def test_power_source_phrase(self) -> None:
        result = parse_prereqs("Arcane power source", self.races, self.classes)
        self.assertEqual(result.tokens, [{"kind": "powerSourceAny", "value": "arcane"}])

    def test_class_and_allof(self) -> None:
        classes = self.classes | {"shaman", "barbarian"}
        result = parse_prereqs("Shaman and swordmage", self.races, classes)
        self.assertEqual(result.tokens[0]["kind"], "allOf")
        reqs = result.tokens[0]["requirements"]
        self.assertEqual(reqs[0]["value"], "Shaman")
        self.assertEqual(reqs[1]["value"], "Swordmage")

    def test_be_a_half_elf(self) -> None:
        races = self.races | {"Half-Elf"}
        race_by = {r.lower(): r for r in races}
        # parse_prereqs builds race_by_lower internally from races set
        result = parse_prereqs("be a half-elf", races, self.classes)
        self.assertEqual(result.tokens, [{"kind": "race", "value": "Half-Elf"}])

    def test_compound_class_feature_label(self) -> None:
        result = parse_prereqs("tome implement mastery", self.races, self.classes)
        self.assertEqual(result.tokens[0]["kind"], "allOf")
        reqs = result.tokens[0]["requirements"]
        self.assertEqual(reqs[0], {"kind": "classFeature", "value": "Arcane Implement Mastery"})
        self.assertEqual(reqs[1]["kind"], "tag")

    def test_fey_origin_and_negated_drow(self) -> None:
        races = self.races | {"Drow", "Eladrin"}
        result = parse_prereqs("fey origin and !drow", races, self.classes)
        self.assertEqual(result.anomalies, [])
        self.assertEqual(result.tokens[0]["kind"], "allOf")
        reqs = result.tokens[0]["requirements"]
        self.assertEqual(reqs[0], {"kind": "tag", "value": "fey origin"})
        self.assertEqual(reqs[1], {"kind": "negatedTag", "value": "drow"})


if __name__ == "__main__":
    unittest.main()

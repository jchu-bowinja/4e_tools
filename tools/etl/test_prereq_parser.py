"""Unit tests for prereq_parser (run: python -m unittest tools.etl.test_prereq_parser)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from prereq_parser import parse_prereqs  # noqa: E402


class PrereqParserTests(unittest.TestCase):
    def setUp(self) -> None:
        self.races = {"Dragonborn", "Human", "Elf"}
        self.classes = {"fighter", "wizard", "warlock", "cleric"}

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


if __name__ == "__main__":
    unittest.main()

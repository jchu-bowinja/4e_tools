"""Unit tests for feat tier resolution in build_rules_index."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_ETL = Path(__file__).resolve().parent
if str(_ETL) not in sys.path:
    sys.path.insert(0, str(_ETL))

from build_rules_index import resolve_feat_tier_and_prereqs  # noqa: E402
from prereq_parser import parse_prereqs  # noqa: E402


class FeatTierResolutionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.races: set[str] = set()
        self.classes: set[str] = set()

    def test_paragon_tier_injects_level_11_when_missing(self) -> None:
        tokens = [{"kind": "tier", "value": "PARAGON"}]
        tier, out = resolve_feat_tier_and_prereqs(None, tokens, "Paragon Tier")
        self.assertEqual(tier, "Paragon")
        self.assertEqual(out[0], {"kind": "levelAtLeast", "value": 11})

    def test_epic_tier_injects_level_21_when_missing(self) -> None:
        tokens = [{"kind": "tier", "value": "EPIC"}]
        tier, out = resolve_feat_tier_and_prereqs("Epic", tokens, "Epic Tier")
        self.assertEqual(tier, "Epic")
        self.assertEqual(out[0], {"kind": "levelAtLeast", "value": 21})

    def test_does_not_duplicate_level_when_already_sufficient(self) -> None:
        tokens = [
            {"kind": "levelAtLeast", "value": 21},
            {"kind": "tier", "value": "EPIC"},
        ]
        tier, out = resolve_feat_tier_and_prereqs("Epic", tokens, "21st level; Epic Tier")
        self.assertEqual(tier, "Epic")
        self.assertEqual(len([t for t in out if t["kind"] == "levelAtLeast"]), 1)

    def test_infers_paragon_from_level_11_prereq(self) -> None:
        parse = parse_prereqs("11th level, fighter", self.races, self.classes)
        tier, out = resolve_feat_tier_and_prereqs(None, parse.tokens, "11th level, fighter")
        self.assertEqual(tier, "Paragon")
        self.assertFalse(any(t["kind"] == "levelAtLeast" and t["value"] == 11 for t in out[1:]))

    def test_infers_epic_from_paragon_path_prereq(self) -> None:
        parse = parse_prereqs("Iron Vanguard paragon path", self.races, self.classes)
        tier, _out = resolve_feat_tier_and_prereqs(None, parse.tokens, "Iron Vanguard paragon path")
        self.assertEqual(tier, "Paragon")
        self.assertEqual(parse.tokens[0]["kind"], "paragonPath")
        self.assertEqual(parse.tokens[0]["value"], "Iron Vanguard")

    def test_infers_epic_from_epic_destiny_prereq(self) -> None:
        parse = parse_prereqs("Demigod epic destiny", self.races, self.classes)
        tier, out = resolve_feat_tier_and_prereqs(None, parse.tokens, "Demigod epic destiny")
        self.assertEqual(tier, "Epic")
        self.assertEqual(out[0], {"kind": "levelAtLeast", "value": 21})

    def test_compendium_tier_wins_over_level_inference(self) -> None:
        parse = parse_prereqs("11th level, ranger", self.races, self.classes)
        tier, _out = resolve_feat_tier_and_prereqs("Heroic", parse.tokens, "11th level, ranger")
        self.assertEqual(tier, "Heroic")


if __name__ == "__main__":
    unittest.main()

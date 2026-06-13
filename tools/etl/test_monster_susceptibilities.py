import unittest

from build_monster_index import (
    _postprocess_immunity_strings,
    _repair_immunity_segments,
    _repair_susceptibility_row,
)


class TestMonsterSusceptibilityRepair(unittest.TestCase):
    def test_swarm_against_weakness(self) -> None:
        out = _repair_susceptibility_row(
            {"name": "against", "amount": 10, "details": "area and close attacks"}
        )
        self.assertEqual(out["name"], "Area and Close")
        self.assertEqual(out["amount"], 10)

    def test_swarm_half_resistance(self) -> None:
        out = _repair_susceptibility_row(
            {
                "name": "half",
                "amount": 0,
                "details": "damage from melee and ranged attacks",
            }
        )
        self.assertEqual(out["name"], "Melee and Ranged")
        self.assertIn("Half", out["details"])

    def test_damage_fragment_weakness(self) -> None:
        out = _repair_susceptibility_row(
            {"name": "damage", "amount": 5, "details": "from close and area attacks"}
        )
        self.assertEqual(out["name"], "Close and Area")

    def test_all_resistance(self) -> None:
        out = _repair_susceptibility_row({"name": "all", "amount": 15})
        self.assertEqual(out["name"], "All damage")

    def test_see_cross_reference(self) -> None:
        out = _repair_susceptibility_row(
            {"name": "see", "amount": 0, "details": "planephase form"}
        )
        self.assertEqual(out["name"], "Planephase Form")
        self.assertEqual(out["details"], "See also planephase form")

    def test_second_wind_style_takes(self) -> None:
        out = _repair_susceptibility_row(
            {
                "name": "takes",
                "amount": 0,
                "details": "half damage from melee and ranged attacks",
            }
        )
        self.assertEqual(out["name"], "Melee and Ranged")

    def test_preserves_necrotic(self) -> None:
        row = {"name": "Necrotic", "amount": 30}
        self.assertEqual(_repair_susceptibility_row(row), row)

    def test_lowercase_continuation_becomes_special(self) -> None:
        out = _repair_susceptibility_row(
            {
                "name": "Xixecal",
                "amount": 0,
                "details": "takes a -4 penalty to all defenses until the end of its next turn)",
            }
        )
        self.assertEqual(out["name"], "Special")
        self.assertTrue(out["details"].startswith("Xixecal"))

    def test_and_ranged_fragment(self) -> None:
        out = _repair_susceptibility_row(
            {"name": "and Ranged", "amount": 5, "details": "and ranged attacks"}
        )
        self.assertEqual(out["name"], "Ranged")

    def test_target_ac_fragment(self) -> None:
        out = _repair_susceptibility_row(
            {"name": "Target Ac", "amount": 5, "details": "effects that target AC"}
        )
        self.assertEqual(out["name"], "Effects Targeting AC")

    def test_truncated_fire_fragment(self) -> None:
        out = _repair_susceptibility_row({"name": "Re", "amount": 15, "details": "re"})
        self.assertEqual(out["name"], "Fire")
        self.assertNotIn("details", out)

    def test_duplicate_long_clause_becomes_special(self) -> None:
        out = _repair_susceptibility_row(
            {
                "name": "Target of That Attack Takes An Extra 5 Cold Damage",
                "amount": 0,
                "details": "target of that attack takes an extra 5 cold damage.",
            }
        )
        self.assertEqual(out["name"], "Special")


class TestMonsterImmunityRepair(unittest.TestCase):
    def test_mutant_arbalester_parenthetical_merge(self) -> None:
        raw = ["Disease", "poison (and push", "pull", "slide when chained)"]
        self.assertEqual(
            _repair_immunity_segments(raw),
            ["Disease", "poison (and push, pull, slide when chained)"],
        )

    def test_postprocess_dedupes_and_normalizes(self) -> None:
        out = _postprocess_immunity_strings(
            ["Disease", "poison (and push", "pull", "slide when chained)"]
        )
        self.assertEqual(
            out,
            ["Disease", "poison (and push, pull, slide when chained)"],
        )


if __name__ == "__main__":
    unittest.main()

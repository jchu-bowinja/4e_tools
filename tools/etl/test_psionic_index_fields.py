import unittest

from build_rules_index import (
    HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS,
    PARAGON_MC_NON_PSIONIC_TO_PSIONIC_AT_WILL_PENALTY,
    PSIONIC_POWER_POINTS_BY_LEVEL,
)


class PsionicIndexFieldsTest(unittest.TestCase):
    def test_power_points_by_level_table(self):
        self.assertEqual(PSIONIC_POWER_POINTS_BY_LEVEL["1"], 2)
        self.assertEqual(PSIONIC_POWER_POINTS_BY_LEVEL["7"], 6)
        self.assertEqual(PSIONIC_POWER_POINTS_BY_LEVEL["13"], 7)
        self.assertEqual(PSIONIC_POWER_POINTS_BY_LEVEL["27"], 15)
        self.assertEqual(len(PSIONIC_POWER_POINTS_BY_LEVEL), 30)

    def test_hybrid_breakpoints(self):
        self.assertEqual(HYBRID_PSIONIC_AUGMENTATION_BREAKPOINTS, [7, 13, 17, 23, 27])

    def test_paragon_mc_at_will_penalty(self):
        self.assertEqual(PARAGON_MC_NON_PSIONIC_TO_PSIONIC_AT_WILL_PENALTY, 1)


if __name__ == "__main__":
    unittest.main()

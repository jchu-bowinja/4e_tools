import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  bonusClassAtWillSlotFromRaceBuild,
  HUMAN_POWER_OPTION_RACE_KEY,
  ID_RACIAL_TRAIT_BONUS_AT_WILL,
  ID_RACIAL_TRAIT_HEROIC_EFFORT,
  ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION
} from "../../src/rules/grantedPowersQuery";
import type { RulesIndex } from "../../src/rules/models";
import { parseRacialTraitIdsFromRace } from "../../src/rules/racialTraits";

const rulesIndexPath = "generated/rules_index.json";

describe.skipIf(!existsSync(rulesIndexPath))("bonus third class at-will (generated index)", () => {
  let index: RulesIndex;

  beforeAll(() => {
    const raw = readFileSync(rulesIndexPath, "utf-8");
    index = JSON.parse(raw) as RulesIndex;
  });

  it("loads a non-empty rules index", () => {
    expect(index.races?.length).toBeGreaterThan(0);
    expect(index.racialTraits?.length).toBeGreaterThan(0);
  });

  it("Human lists Human Power Selection (2966); bonus at-will follows selection vs Heroic Effort", () => {
    const humanRace = index.races.find((r) =>
      parseRacialTraitIdsFromRace(r).includes(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION)
    );
    expect(humanRace, "expected a race with Human Power Selection trait in generated index").toBeDefined();
    if (!humanRace) return;

    expect(parseRacialTraitIdsFromRace(humanRace)).toContain(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION);

    expect(bonusClassAtWillSlotFromRaceBuild(index, { raceId: humanRace.id })).toBe(true);
    expect(bonusClassAtWillSlotFromRaceBuild(index, { raceId: humanRace.id, raceSelections: {} })).toBe(true);

    expect(
      bonusClassAtWillSlotFromRaceBuild(index, {
        raceId: humanRace.id,
        raceSelections: { [HUMAN_POWER_OPTION_RACE_KEY]: ID_RACIAL_TRAIT_HEROIC_EFFORT }
      })
    ).toBe(false);

    expect(
      bonusClassAtWillSlotFromRaceBuild(index, {
        raceId: humanRace.id,
        raceSelections: { [HUMAN_POWER_OPTION_RACE_KEY]: ID_RACIAL_TRAIT_BONUS_AT_WILL }
      })
    ).toBe(true);
  });

  it("Bonus At-Will racial trait (356) is present in the racial trait dataset", () => {
    const bonus = index.racialTraits.find((t) => t.id === ID_RACIAL_TRAIT_BONUS_AT_WILL);
    expect(bonus, "trait ID_FMP_RACIAL_TRAIT_356 should exist in a full Character Builder extract").toBeDefined();
  });
});

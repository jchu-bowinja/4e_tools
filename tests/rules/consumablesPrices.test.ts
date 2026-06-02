import { describe, expect, it } from "vitest";
import { ritualMarketPriceGp, ritualScrollMarketPriceGp } from "../../src/rules/consumablesPrices";
import type { RitualItem } from "../../src/rules/models";

function ritual(overrides: Partial<RitualItem> = {}): RitualItem {
  return {
    id: "r1",
    name: "Knock",
    slug: "knock",
    raw: {},
    marketPriceGp: 50,
    ...overrides
  };
}

describe("consumablesPrices", () => {
  it("ritual scroll purchase matches ritual book market price", () => {
    const item = ritual({ marketPriceGp: 175 });
    expect(ritualScrollMarketPriceGp(item)).toBe(ritualMarketPriceGp(item));
    expect(ritualScrollMarketPriceGp(item)).toBe(175);
  });
});

import { describe, expect, it } from "vitest";
import { estimateLabelWidthFromStrings } from "../../src/ui/tableLayout";

describe("estimateLabelWidthFromStrings", () => {
  it("returns 0 for empty labels", () => {
    expect(estimateLabelWidthFromStrings([], "0.76rem")).toBe(0);
  });

  it("uses the longest label for width estimate", () => {
    const narrow = estimateLabelWidthFromStrings(["AC", "DEX"], "0.76rem");
    const wide = estimateLabelWidthFromStrings(["Fortitude", "Initiative"], "0.76rem");
    expect(wide).toBeGreaterThan(narrow);
  });

  it("includes header text when provided in the label list", () => {
    const without = estimateLabelWidthFromStrings(["AC", "Will"], "0.76rem");
    const withHeader = estimateLabelWidthFromStrings(["AC", "Will", "DEFENSE"], "0.76rem");
    expect(withHeader).toBeGreaterThanOrEqual(without);
  });
});

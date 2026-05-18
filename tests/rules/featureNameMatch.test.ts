import { describe, expect, it } from "vitest";
import { featureNameMatches, normalizeFeatureName } from "../../src/rules/featureNameMatch";

describe("featureNameMatch", () => {
  it("matches across parentheticals and casing", () => {
    expect(featureNameMatches("Child Of The Night", "Child of the Night")).toBe(true);
    expect(featureNameMatches("Channel Divinity", "Channel Divinity (Invoker)")).toBe(true);
  });

  it("normalizes feature names", () => {
    expect(normalizeFeatureName("Child of the Night (Multiclass)")).toBe("child of the night");
  });
});

import { describe, expect, it } from "vitest";
import { parseRulesDescriptionText } from "../../src/features/builder/RulesRichText";

describe("parseRulesDescriptionText", () => {
  it("splits 4e star bullets into paragraph + list", () => {
    const text =
      "Strength (Str) measures power. \u2726 First point. \u2726 Second point.";
    const blocks = parseRulesDescriptionText(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "Strength (Str) measures power." });
    expect(blocks[1]).toEqual({ kind: "list", items: ["First point.", "Second point."] });
  });

  it("returns one paragraph when no star bullets", () => {
    const blocks = parseRulesDescriptionText("Just prose without bullets.");
    expect(blocks).toEqual([{ kind: "paragraph", text: "Just prose without bullets." }]);
  });

  it("parses line-based markdown-style bullets", () => {
    const text = "Intro line.\n\n* One\n* Two";
    const blocks = parseRulesDescriptionText(text);
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "Intro line." });
    expect(blocks[1]).toEqual({ kind: "list", items: ["One", "Two"] });
  });
});

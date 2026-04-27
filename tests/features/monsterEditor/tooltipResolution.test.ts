import { describe, expect, it } from "vitest";
import { resolveTooltipText } from "../../../src/data/tooltipGlossary";
import { splitTooltipTerms } from "../../../src/features/monsterEditor/MonsterEditorApp";

describe("monster editor tooltip term resolution", () => {
  it("split 'vs' phrases try lookup keys in order from the glossary only", () => {
    const terms = splitTooltipTerms("Acrobatics (Dex) vs Reflex");
    expect(terms).toEqual(["Acrobatics (Dex)", "Reflex"]);

    const resolved = resolveTooltipText({
      terms,
      glossaryByName: {
        acrobatics: "Balance and tumbling skill text.",
        reflex: "Reflex defense glossary."
      }
    });
    expect(resolved).toBe("Balance and tumbling skill text.");
  });

  it("returns null when the glossary has no matching entries", () => {
    const terms = splitTooltipTerms("Acrobatics (Dex) vs Reflex");
    expect(
      resolveTooltipText({
        terms,
        glossaryByName: {}
      })
    ).toBe(null);
  });
});

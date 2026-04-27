import { describe, expect, it } from "vitest";
import {
  parseAttackLineVsDefenseHighlightSegments,
  splitMonsterAttackRangeLineForGlossary
} from "../../../src/features/monsterEditor/monsterTextUtils";

describe("splitMonsterAttackRangeLineForGlossary", () => {
  it("splits range wording before the first digit", () => {
    expect(splitMonsterAttackRangeLineForGlossary("Area burst 3 within 10")).toEqual({
      kind: "prefix",
      glossary: "Area burst",
      tail: "3 within 10"
    });
    expect(splitMonsterAttackRangeLineForGlossary("Ranged 10")).toEqual({
      kind: "prefix",
      glossary: "Ranged",
      tail: "10"
    });
  });

  it("keeps attack bonus segments whole", () => {
    expect(splitMonsterAttackRangeLineForGlossary("+15 vs AC")).toEqual({
      kind: "full",
      text: "+15 vs AC"
    });
  });

  it("uses entire string when there is no digit", () => {
    expect(splitMonsterAttackRangeLineForGlossary("Melee touch")).toEqual({
      kind: "prefix",
      glossary: "Melee touch",
      tail: ""
    });
  });
});

describe("parseAttackLineVsDefenseHighlightSegments", () => {
  it("splits defense names for glossary hover when every chunk matches bonus vs defense", () => {
    expect(parseAttackLineVsDefenseHighlightSegments("29 vs reflex")).toEqual([
      { kind: "text", value: "29 vs " },
      { kind: "defenseTerm", value: "reflex" }
    ]);
    expect(parseAttackLineVsDefenseHighlightSegments("29 vs reflex * 29 vs fortitude")).toEqual([
      { kind: "text", value: "29 vs " },
      { kind: "defenseTerm", value: "reflex" },
      { kind: "text", value: " * " },
      { kind: "text", value: "29 vs " },
      { kind: "defenseTerm", value: "fortitude" }
    ]);
    expect(parseAttackLineVsDefenseHighlightSegments("+15 vs AC")).toEqual([
      { kind: "text", value: "+15 vs " },
      { kind: "defenseTerm", value: "AC" }
    ]);
  });

  it("returns null when not a uniform vs-defense attack line", () => {
    expect(parseAttackLineVsDefenseHighlightSegments("Area burst 3")).toBe(null);
    expect(parseAttackLineVsDefenseHighlightSegments("29 vs reflex * bad")).toBe(null);
  });
});

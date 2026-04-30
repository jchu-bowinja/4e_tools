import { describe, expect, it } from "vitest";
import type { MonsterEntryFile } from "../monsterEditor/storage";
import { formatXpInteger, monsterXpDisplay, parseMonsterXpToNumber } from "./encounterMonsterQuickSummary";

function stub(xp: MonsterEntryFile["xp"]): Pick<MonsterEntryFile, "xp"> {
  return { xp };
}

describe("parseMonsterXpToNumber", () => {
  it("parses numbers and comma strings", () => {
    expect(parseMonsterXpToNumber(stub(500))).toBe(500);
    expect(parseMonsterXpToNumber(stub("1,250"))).toBe(1250);
    expect(parseMonsterXpToNumber(stub(" 300 "))).toBe(300);
  });

  it("returns null for empty or non-numeric", () => {
    expect(parseMonsterXpToNumber(stub(""))).toBeNull();
    expect(parseMonsterXpToNumber(stub("—"))).toBeNull();
    expect(parseMonsterXpToNumber(stub("Variable"))).toBeNull();
  });
});

describe("monsterXpDisplay", () => {
  it("formats numeric XP with grouping", () => {
    expect(monsterXpDisplay(stub(1200))).toBe(formatXpInteger(1200));
  });

  it("shows raw text when not numeric", () => {
    expect(monsterXpDisplay(stub("see DM"))).toBe("see DM");
  });
});

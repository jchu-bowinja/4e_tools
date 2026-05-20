import { describe, expect, it } from "vitest";
import { findSuspiciousWeaknesses, readMonsterImportWarnings } from "../../../src/features/monsterEditor/monsterDataQuality";

describe("monsterDataQuality", () => {
  it("reads importWarnings from sections", () => {
    expect(readMonsterImportWarnings({ importWarnings: ["line one", "  ", "line two"] })).toEqual([
      "line one",
      "line two"
    ]);
    expect(readMonsterImportWarnings(undefined)).toEqual([]);
  });

  it("flags suspicious weakness name fragments", () => {
    const hits = findSuspiciousWeaknesses([
      { name: "Radiant", amount: 5 },
      { name: "against", amount: 10, details: "close attacks" },
      { name: "his", amount: 0 }
    ]);
    expect(hits.map((h) => h.label)).toEqual(["10 against close attacks", "his"]);
  });
});

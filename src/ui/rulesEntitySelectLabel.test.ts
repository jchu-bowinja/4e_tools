import { describe, expect, it } from "vitest";
import { formatRulesEntitySelectOptionLabel, rulesEntityNameColumnWidth } from "./rulesEntitySelectLabel";

describe("rulesEntitySelectLabel", () => {
  it("computes max name width", () => {
    expect(rulesEntityNameColumnWidth([{ name: "Elf" }, { name: "Dragonborn" }])).toBe(10);
  });

  it("pads name and appends source", () => {
    const label = formatRulesEntitySelectOptionLabel("Elf", "PHB", 10);
    expect(label.endsWith("\u00a0PHB")).toBe(true);
    expect(label.startsWith("Elf")).toBe(true);
    expect(label.length).toBeGreaterThan("Elf".length + "PHB".length);
  });

  it("returns name only when source is empty", () => {
    expect(formatRulesEntitySelectOptionLabel("Human", undefined, 6)).toBe("Human");
  });
});

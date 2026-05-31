import { describe, expect, it } from "vitest";
import {
  categoryGrantsBonusClassAtWill,
  categoryIsDilettanteAtWill,
  isDynamicPowerSelectCategory,
  parsePowerSelectCategory,
  resolvePowerIdsFromCategory
} from "../../src/rules/powerSelectCategory";
import type { RulesIndex } from "../../src/rules/models";

const emptyIndex = { powers: [], classes: [] } as unknown as RulesIndex;

describe("powerSelectCategory", () => {
  it("parses static power id lists", () => {
    const parsed = parsePowerSelectCategory("ID_FMP_POWER_1|ID_FMP_POWER_2");
    expect(parsed.kind).toBe("staticPowerIds");
    expect(parsed.powerIds).toEqual(["ID_FMP_POWER_1", "ID_FMP_POWER_2"]);
  });

  it("parses bonus class at-will and dilettante tokens", () => {
    expect(parsePowerSelectCategory("$$CLASS,at-will,1").kind).toBe("classAtWillBonus");
    expect(parsePowerSelectCategory("$$NOT_CLASS,at-will,1").kind).toBe("dilettanteAtWill");
  });

  it("detects dynamic categories and bonus-at-will helpers", () => {
    expect(isDynamicPowerSelectCategory("$$CLASS,at-will,1")).toBe(true);
    expect(categoryGrantsBonusClassAtWill("$$CLASS,at-will,1")).toBe(true);
    expect(categoryIsDilettanteAtWill("$$NOT_CLASS,at-will,1")).toBe(true);
  });

  it("resolvePowerIdsFromCategory returns static ids or dynamic for dilettante", () => {
    expect(resolvePowerIdsFromCategory("ID_FMP_POWER_9", emptyIndex, {})).toEqual(["ID_FMP_POWER_9"]);
    expect(resolvePowerIdsFromCategory("$$NOT_CLASS,at-will,1", emptyIndex, {})).toBe("dynamic");
    expect(resolvePowerIdsFromCategory("$$CLASS,at-will,1", emptyIndex, {})).toEqual([]);
  });
});

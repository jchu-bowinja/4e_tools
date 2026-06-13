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

  it("parses class power pool tokens (Essentials / spellbook)", () => {
    const enc = parsePowerSelectCategory("$$CLASS,ID_INTERNAL_CATEGORY_ENCOUNTER,1");
    expect(enc.kind).toBe("classPowerPool");
    expect(enc.poolUsage).toBe("encounter");
    expect(enc.poolLevel).toBe(1);
    expect(parsePowerSelectCategory("$$CLASS,daily,5").poolUsage).toBe("daily");
    expect(parsePowerSelectCategory("$$CLASS,utility,10").poolUsage).toBe("utility");
  });

  it("parses explicit class id pools and two-part at-will", () => {
    const skald = parsePowerSelectCategory("ID_FMP_CLASS_104,daily,1");
    expect(skald.kind).toBe("explicitClassPowerPool");
    expect(skald.poolClassId).toBe("ID_FMP_CLASS_104");
    expect(parsePowerSelectCategory("$$Class,at-will").kind).toBe("classPowerPool");
    expect(parsePowerSelectCategory("$$Class,at-will").poolLevel).toBe(1);
  });

  it("parses level-scoped class encounter pool ($$LEVEL)", () => {
    const parsed = parsePowerSelectCategory("$$LEVEL,ID_FMP_CLASS_9,encounter");
    expect(parsed.kind).toBe("levelScopedClassPowerPool");
    expect(parsed.poolClassId).toBe("ID_FMP_CLASS_9");
    expect(parsed.poolUsage).toBe("encounter");
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

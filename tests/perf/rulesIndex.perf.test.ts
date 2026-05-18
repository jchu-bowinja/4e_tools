import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateRulesIndexShape } from "../../src/data/loadRules";
import type { RulesIndex } from "../../src/rules/models";
import { PERF_BUDGET_MS } from "./budgets";
import { expectWithinBudget, hasRulesIndex, measureMs, RULES_INDEX_PATH } from "./harness";

describe.skipIf(!hasRulesIndex())("rules index load performance", () => {
  it("parses and validates rules_index.json within budget", () => {
    const elapsed = measureMs(() => {
      const raw = JSON.parse(readFileSync(RULES_INDEX_PATH, "utf8")) as RulesIndex;
      const index = validateRulesIndexShape(raw);
      expect(index.powers.length).toBeGreaterThan(0);
      expect(index.feats.length).toBeGreaterThan(0);
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.rulesIndexParseAndValidate, "rules index parse + validate");
  });
});

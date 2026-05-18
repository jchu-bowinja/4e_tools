import { describe, expect, it } from "vitest";
import { emptyResourceEditorOverlay, mergeRulesOverlay } from "../../src/features/resourceEditor/overlay";
import { PERF_BUDGET_MS } from "./budgets";
import { expectWithinBudget, hasRulesIndex, loadRulesIndexForPerf, measureMs } from "./harness";

describe.skipIf(!hasRulesIndex())("resource editor performance", () => {
  it("mergeRulesOverlay on full index completes within budget", () => {
    const index = loadRulesIndexForPerf();
    const overlay = emptyResourceEditorOverlay();
    const elapsed = measureMs(() => {
      const merged = mergeRulesOverlay(index, overlay);
      expect(merged.powers.length).toBe(index.powers.length);
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.mergeRulesOverlay, "mergeRulesOverlay");
  });
});

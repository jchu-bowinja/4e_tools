/**
 * Shared helpers for performance regression tests under `tests/perf/`.
 * Run with `npm run test:perf`. Budgets live in `./budgets.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { expect } from "vitest";
import { validateRulesIndexShape } from "../../src/data/loadRules";
import type { RulesIndex } from "../../src/rules/models";

export const RULES_INDEX_PATH = "generated/rules_index.json";

export function hasRulesIndex(): boolean {
  return existsSync(RULES_INDEX_PATH);
}

let cachedRulesIndex: RulesIndex | undefined;

/** Parsed rules index, cached for the vitest worker. */
export function loadRulesIndexForPerf(): RulesIndex {
  if (!cachedRulesIndex) {
    const raw = JSON.parse(readFileSync(RULES_INDEX_PATH, "utf8")) as RulesIndex;
    cachedRulesIndex = validateRulesIndexShape(raw);
  }
  return cachedRulesIndex;
}

export function measureMs(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

export function expectWithinBudget(elapsedMs: number, budgetMs: number, label: string): void {
  expect(
    elapsedMs,
    `${label} took ${elapsedMs.toFixed(1)}ms (budget ${budgetMs}ms)`
  ).toBeLessThan(budgetMs);
}

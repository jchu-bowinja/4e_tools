/**
 * Millisecond budgets for performance regression tests against `generated/rules_index.json`.
 * Increase only when a change genuinely requires more work; document why in the PR.
 */
export const PERF_BUDGET_MS = {
  /** JSON.parse + validateRulesIndexShape (simulates post-fetch processing). */
  rulesIndexParseAndValidate: 3000,
  /** Full feat list prereq resolution for default build. */
  resolveFeatOptions: 3000,
  /** Full character legality pass for default build. */
  validateCharacterBuild: 2500,
  /** All paragon path prereq checks with cached context. */
  paragonPrereqSweep: 600,
  /** Theme + paragon + epic destiny picker legality (builder tabs). */
  supportOptionLegalityAll: 900,
  /** Character sheet combat power grouping. */
  groupCombatPowers: 300,
  /** Derived stats for a mid-level sheet state. */
  computeSheetDerivedData: 800,
  /** Resource editor overlay merge on full index. */
  mergeRulesOverlay: 150
} as const;

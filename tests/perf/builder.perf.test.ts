import { describe, expect, it } from "vitest";
import { defaultBuild } from "../../src/features/builder/defaultBuild";
import { resolveFeatOptions } from "../../src/rules/optionResolver";
import { buildPrereqCharacterContext } from "../../src/rules/prereqContext";
import { hybridBaseClassNames } from "../../src/rules/prereqEvaluator";
import { validateCharacterBuild } from "../../src/rules/characterValidator";
import { evaluateSupportOptionLegality } from "../../src/rules/supportOptionLegality";
import { PERF_BUDGET_MS } from "./budgets";
import { expectWithinBudget, hasRulesIndex, loadRulesIndexForPerf, measureMs } from "./harness";

describe.skipIf(!hasRulesIndex())("character builder performance", () => {
  it("resolveFeatOptions completes within budget", () => {
    const index = loadRulesIndexForPerf();
    const elapsed = measureMs(() => {
      const options = resolveFeatOptions(index, defaultBuild);
      expect(options.length).toBe(index.feats.length);
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.resolveFeatOptions, "resolveFeatOptions");
  });

  it("validateCharacterBuild completes within budget", () => {
    const index = loadRulesIndexForPerf();
    const elapsed = measureMs(() => {
      const result = validateCharacterBuild(index, defaultBuild);
      expect(result).toBeDefined();
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.validateCharacterBuild, "validateCharacterBuild");
  });

  it("evaluates all paragon path prereqs within budget when context is cached", () => {
    const index = loadRulesIndexForPerf();
    const build = defaultBuild;
    const raceNames = new Map(index.races.map((r) => [r.id, r.name]));
    const classNames = new Map(index.classes.map((c) => [c.id, c.name]));
    const skillNames = new Map(index.skills.map((s) => [s.id, s.name]));
    const hybridNames = hybridBaseClassNames(index, build);
    const options = {
      index,
      context: buildPrereqCharacterContext(index, build),
      additionalClassNamesForMatch: hybridNames.length ? hybridNames : undefined
    };

    const elapsed = measureMs(() => {
      for (const path of index.paragonPaths) {
        evaluateSupportOptionLegality(path.prereqTokens, 11, build, raceNames, classNames, skillNames, options);
      }
    });
    expect(index.paragonPaths.length).toBeGreaterThan(100);
    expectWithinBudget(elapsed, PERF_BUDGET_MS.paragonPrereqSweep, "paragon prereq sweep");
  });

  it("evaluates theme, paragon, and epic destiny picker legality within budget", () => {
    const index = loadRulesIndexForPerf();
    const build = defaultBuild;
    const raceNames = new Map(index.races.map((r) => [r.id, r.name]));
    const classNames = new Map(index.classes.map((c) => [c.id, c.name]));
    const skillNames = new Map(index.skills.map((s) => [s.id, s.name]));
    const hybridNames = hybridBaseClassNames(index, build);
    const options = {
      index,
      context: buildPrereqCharacterContext(index, build),
      additionalClassNamesForMatch: hybridNames.length ? hybridNames : undefined
    };

    const elapsed = measureMs(() => {
      for (const theme of index.themes) {
        evaluateSupportOptionLegality(theme.prereqTokens, 0, build, raceNames, classNames, skillNames, options);
      }
      for (const path of index.paragonPaths) {
        evaluateSupportOptionLegality(path.prereqTokens, 11, build, raceNames, classNames, skillNames, options);
      }
      for (const destiny of index.epicDestinies) {
        evaluateSupportOptionLegality(destiny.prereqTokens, 21, build, raceNames, classNames, skillNames, options);
      }
    });
    expectWithinBudget(elapsed, PERF_BUDGET_MS.supportOptionLegalityAll, "support option legality (all tiers)");
  });
});

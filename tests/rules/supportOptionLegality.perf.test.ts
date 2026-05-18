import { readFileSync, existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { defaultBuild } from "../../src/features/builder/defaultBuild";
import { buildPrereqCharacterContext } from "../../src/rules/prereqContext";
import { evaluatePrereqs, hybridBaseClassNames } from "../../src/rules/prereqEvaluator";
import type { RulesIndex } from "../../src/rules/models";

const rulesIndexPath = "generated/rules_index.json";

describe.skipIf(!existsSync(rulesIndexPath))("support option legality performance", () => {
  it("evaluates all paragon path prereqs within a reasonable time when context is cached", () => {
    const index = JSON.parse(readFileSync(rulesIndexPath, "utf8")) as RulesIndex;
    const build = defaultBuild;
    const raceNames = new Map(index.races.map((r) => [r.id, r.name]));
    const classNames = new Map(index.classes.map((c) => [c.id, c.name]));
    const skillNames = new Map(index.skills.map((s) => [s.id, s.name]));
    const hybridNames = hybridBaseClassNames(index, build);
    const context = buildPrereqCharacterContext(index, build);
    const options = {
      index,
      context,
      additionalClassNamesForMatch: hybridNames.length ? hybridNames : undefined
    };

    const started = Date.now();
    for (const path of index.paragonPaths) {
      evaluatePrereqs(path.prereqTokens, build, raceNames, classNames, skillNames, options);
    }
    const elapsed = Date.now() - started;
    expect(index.paragonPaths.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(500);
  });
});

import { readFileSync, existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { defaultBuild } from "../../src/features/builder/defaultBuild";
import type { RulesIndex } from "../../src/rules/models";
import { resolveFeatOptions } from "../../src/rules/optionResolver";

const rulesIndexPath = "generated/rules_index.json";

describe.skipIf(!existsSync(rulesIndexPath))("resolveFeatOptions performance", () => {
  it("resolves all feat options within a reasonable time", () => {
    const index = JSON.parse(readFileSync(rulesIndexPath, "utf8")) as RulesIndex;
    const started = Date.now();
    const options = resolveFeatOptions(index, defaultBuild);
    const elapsed = Date.now() - started;
    expect(options.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000);
  });
});
